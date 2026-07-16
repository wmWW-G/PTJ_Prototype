"""完整生图任务的异步依赖编排与 NDJSON 事件生产。"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import AsyncIterator, Protocol, Sequence

from .domain import (
    BinaryAsset,
    GeneratedBinary,
    GenerationRequest,
    ImagePrompt,
    ImageSpec,
    ProductContext,
    PromptPlan,
    ProviderError,
    ReferenceAsset,
    StreamEvent,
    TemplateDefinition,
    VisualTemplateDefinition,
)
from .limiter import AsyncRateLimiter
from .providers import ImageProvider
from .templates import get_template
from .visual_templates import get_visual_template


logger = logging.getLogger(__name__)


class PlannerProtocol(Protocol):
    """编排器依赖的 Prompt Planner 最小接口。"""

    async def analyze_product(
        self,
        *,
        user_requirement: str,
        references: Sequence[BinaryAsset],
        language: str,
        visual_template: VisualTemplateDefinition,
        supplemental_info: dict[str, str],
    ) -> ProductContext:
        """分析商品上下文。"""

    async def plan_variant(
        self,
        *,
        template: TemplateDefinition,
        context: ProductContext,
        user_requirement: str,
        language: str,
        target_model: str,
        variant_index: int,
        visual_template: VisualTemplateDefinition,
        supplemental_info: dict[str, str],
    ) -> PromptPlan:
        """生成单版 Prompt 计划。"""


class ProviderRouterProtocol(Protocol):
    """按模型名查找供应商 Adapter 的接口。"""

    def get(self, model: str) -> ImageProvider:
        """返回已注册 Adapter。"""


class StorageProtocol(Protocol):
    """编排器依赖的对象存储最小接口。"""

    async def load_reference(self, asset: ReferenceAsset) -> BinaryAsset:
        """下载并校验用户参考图。"""

    async def save_generated(
        self,
        generated: GeneratedBinary,
        *,
        job_id: str,
        variant_index: int,
        image_index: int,
    ) -> str:
        """保存结果并返回可展示 URL。"""


@dataclass(slots=True)
class _ImageExecutionResult:
    """单张并发任务的内部结果。"""

    image_index: int
    role: str
    success: bool
    elapsed_ms: int
    image_url: str | None = None
    actual_width: int | None = None
    actual_height: int | None = None
    error: str | None = None
    retries: list[tuple[int, str, float]] = field(default_factory=list)


class GenerationOrchestrator:
    """执行模板规划、多方案循环、有图并发和无图锚点分发。"""

    def __init__(
        self,
        *,
        planner: PlannerProtocol,
        providers: ProviderRouterProtocol,
        storage: StorageProtocol,
        limiters: dict[str, AsyncRateLimiter],
    ) -> None:
        """注入全部可替换依赖。

        Args:
            planner: 商品分析和 Prompt 规划服务。
            providers: 模型 Adapter 路由器。
            storage: 参考图读取和结果存储服务。
            limiters: 每个统一模型名对应的限流器。

        Returns:
            无。

        Raises:
            不主动抛出异常；运行时缺少限流器会在 stream 中转为失败事件。
        """

        self._planner = planner
        self._providers = providers
        self._storage = storage
        self._limiters = limiters

    async def _execute_image(
        self,
        *,
        job_id: str,
        variant_index: int,
        image_prompt: ImagePrompt,
        global_prompt: str,
        spec: ImageSpec,
        provider: ImageProvider,
        limiter: AsyncRateLimiter,
        references: Sequence[BinaryAsset],
        use_generate: bool,
    ) -> tuple[_ImageExecutionResult, GeneratedBinary | None]:
        """生成、重试并保存单个槽位图片。

        Args:
            job_id: 当前任务 UUID。
            variant_index: 当前方案序号。
            image_prompt: 当前模板槽位 Prompt。
            global_prompt: 全套一致性约束。
            spec: 统一模型参数。
            provider: 已路由的供应商 Adapter。
            limiter: 当前模型的限流器。
            references: 原始参考图或基准图。
            use_generate: ``True`` 表示纯文生图，``False`` 表示图生图。

        Returns:
            内部执行结果，以及成功时的原始图片二进制。

        Raises:
            asyncio.CancelledError: 前端中止或函数取消时透传。
            其他供应商错误会转为失败结果，不从本方法抛出。
        """

        started = time.monotonic()
        retries: list[tuple[int, str, float]] = []
        full_prompt = f"{global_prompt}\n\n{image_prompt.prompt}"

        async def operation() -> GeneratedBinary:
            """按依赖类型选择文生图或图生图。"""

            if use_generate:
                return await provider.generate(full_prompt, spec)
            return await provider.edit(full_prompt, references, spec)

        async def on_retry(attempt: int, exc: ProviderError, delay: float) -> None:
            """记录重试信息，稍后作为流事件返回。"""

            retries.append((attempt, str(exc), delay))

        try:
            generated = await limiter.run(operation, on_retry=on_retry)
            image_url = await self._storage.save_generated(
                generated,
                job_id=job_id,
                variant_index=variant_index,
                image_index=image_prompt.index,
            )
            return (
                _ImageExecutionResult(
                    image_index=image_prompt.index,
                    role=image_prompt.role,
                    success=True,
                    elapsed_ms=int((time.monotonic() - started) * 1000),
                    image_url=image_url,
                    actual_width=generated.actual_width,
                    actual_height=generated.actual_height,
                    retries=retries,
                ),
                generated,
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - 任务级边界必须把单图异常转为部分失败。
            logger.exception(
                "单张图片生成失败 job=%s variant=%s image=%s",
                job_id,
                variant_index,
                image_prompt.index,
            )
            return (
                _ImageExecutionResult(
                    image_index=image_prompt.index,
                    role=image_prompt.role,
                    success=False,
                    elapsed_ms=int((time.monotonic() - started) * 1000),
                    error=str(exc),
                    retries=retries,
                ),
                None,
            )

    def _result_events(
        self,
        *,
        job_id: str,
        variant_index: int,
        result: _ImageExecutionResult,
        anchor: bool = False,
    ) -> list[StreamEvent]:
        """把内部单图结果转换为可序列化事件。

        Args:
            job_id: 当前任务编号。
            variant_index: 当前方案序号。
            result: 单图执行结果。
            anchor: 是否为无图模式的图 1 基准图。

        Returns:
            零到多条 retrying 事件加一条完成或失败事件。

        Raises:
            不抛出异常。
        """

        events = [
            StreamEvent(
                type="image_retrying",
                job_id=job_id,
                variant_index=variant_index,
                image_index=result.image_index,
                status="retrying",
                message=message,
                data={"attempt": attempt, "delay_seconds": delay},
            )
            for attempt, message, delay in result.retries
        ]
        if result.success:
            events.append(
                StreamEvent(
                    type="anchor_completed" if anchor else "image_completed",
                    job_id=job_id,
                    variant_index=variant_index,
                    image_index=result.image_index,
                    status="completed",
                    image_url=result.image_url,
                    data={
                        "role": result.role,
                        "elapsed_ms": result.elapsed_ms,
                        "retry_count": len(result.retries),
                        "actual_width": result.actual_width,
                        "actual_height": result.actual_height,
                    },
                )
            )
        else:
            events.append(
                StreamEvent(
                    type="image_failed",
                    job_id=job_id,
                    variant_index=variant_index,
                    image_index=result.image_index,
                    status="failed",
                    message=result.error,
                    data={
                        "role": result.role,
                        "elapsed_ms": result.elapsed_ms,
                        "retry_count": len(result.retries),
                    },
                )
            )
        return events

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamEvent]:
        """执行完整任务并逐步产出前端可消费事件。

        Args:
            request: 已由 Pydantic 校验的完整任务请求。

        Yields:
            从 job_started 到 job_completed/job_failed 的有序事件。

        Raises:
            asyncio.CancelledError: 客户端断开导致任务取消时透传。
            其他业务异常在任务级边界转为 job_failed 事件。
        """

        job_id = uuid.uuid4().hex
        yield StreamEvent(type="job_started", job_id=job_id, status="planning")
        try:
            template = get_template(request.template_id)
            visual_template = get_visual_template(request.visual_template_id)
            allowed_info_keys = {field.key for field in visual_template.fields}
            supplemental_info = {
                key: value
                for key, value in request.supplemental_info.items()
                if key in allowed_info_keys
            }
            if template.image_type != request.image_type:
                raise ValueError("图片类型与服务器模板不匹配")
            provider = self._providers.get(request.model)
            limiter = self._limiters[request.model]

            # 原始参考图只下载一次；后续每个槽位共享同一二进制集合。
            references = [
                await self._storage.load_reference(asset)
                for asset in request.reference_assets
            ]
            yield StreamEvent(type="planning", job_id=job_id, status="planning")
            context = await self._planner.analyze_product(
                user_requirement=request.user_requirement,
                references=references,
                language=request.language,
                visual_template=visual_template,
                supplemental_info=supplemental_info,
            )
            spec = ImageSpec(
                model=request.model,
                aspect_ratio=request.aspect_ratio,
                resolution=request.resolution,
                quality=request.quality,
            )

            overall_success = 0
            overall_failed = 0
            for variant_index in range(1, request.variant_count + 1):
                plan = await self._planner.plan_variant(
                    template=template,
                    context=context,
                    user_requirement=request.user_requirement,
                    language=request.language,
                    target_model=request.model,
                    variant_index=variant_index,
                    visual_template=visual_template,
                    supplemental_info=supplemental_info,
                )
                yield StreamEvent(
                    type="plan_ready",
                    job_id=job_id,
                    variant_index=variant_index,
                    status="ready",
                    data={"plan": plan.model_dump(), "slot_count": len(template.slots)},
                )
                yield StreamEvent(
                    type="variant_started",
                    job_id=job_id,
                    variant_index=variant_index,
                    status="generating",
                )

                remaining_prompts = plan.image_prompts
                active_references: Sequence[BinaryAsset] = references

                if not references:
                    # 无图模式唯一串行依赖：必须先生成图 1，后续全部共享这张基准图。
                    anchor_prompt = plan.image_prompts[0]
                    yield StreamEvent(
                        type="anchor_started",
                        job_id=job_id,
                        variant_index=variant_index,
                        image_index=anchor_prompt.index,
                        status="generating",
                    )
                    anchor_result, anchor_binary = await self._execute_image(
                        job_id=job_id,
                        variant_index=variant_index,
                        image_prompt=anchor_prompt,
                        global_prompt=plan.global_consistency_prompt,
                        spec=spec,
                        provider=provider,
                        limiter=limiter,
                        references=(),
                        use_generate=True,
                    )
                    for event in self._result_events(
                        job_id=job_id,
                        variant_index=variant_index,
                        result=anchor_result,
                        anchor=True,
                    ):
                        yield event
                    if not anchor_result.success or anchor_binary is None:
                        overall_failed += len(plan.image_prompts)
                        yield StreamEvent(
                            type="variant_completed",
                            job_id=job_id,
                            variant_index=variant_index,
                            status="failed",
                            message="基准图生成失败，当前方案无法继续",
                        )
                        continue
                    overall_success += 1
                    active_references = [
                        BinaryAsset(
                            data=anchor_binary.data,
                            mime_type=anchor_binary.mime_type,
                            name="anchor",
                        )
                    ]
                    remaining_prompts = plan.image_prompts[1:]

                # 所有互不依赖的槽位现在同时开始，实际并发由模型限流器控制。
                tasks: list[asyncio.Task[tuple[_ImageExecutionResult, GeneratedBinary | None]]] = []
                for image_prompt in remaining_prompts:
                    yield StreamEvent(
                        type="image_started",
                        job_id=job_id,
                        variant_index=variant_index,
                        image_index=image_prompt.index,
                        status="generating",
                        data={"role": image_prompt.role},
                    )
                    tasks.append(
                        asyncio.create_task(
                            self._execute_image(
                                job_id=job_id,
                                variant_index=variant_index,
                                image_prompt=image_prompt,
                                global_prompt=plan.global_consistency_prompt,
                                spec=spec,
                                provider=provider,
                                limiter=limiter,
                                references=active_references,
                                use_generate=False,
                            )
                        )
                    )
                variant_success = 1 if not references else 0
                variant_failed = 0
                for completed in asyncio.as_completed(tasks):
                    result, _generated = await completed
                    if result.success:
                        variant_success += 1
                        overall_success += 1
                    else:
                        variant_failed += 1
                        overall_failed += 1
                    for event in self._result_events(
                        job_id=job_id,
                        variant_index=variant_index,
                        result=result,
                    ):
                        yield event
                variant_status = (
                    "completed"
                    if variant_failed == 0
                    else "partial_success"
                    if variant_success > 0
                    else "failed"
                )
                yield StreamEvent(
                    type="variant_completed",
                    job_id=job_id,
                    variant_index=variant_index,
                    status=variant_status,
                    data={"completed": variant_success, "failed": variant_failed},
                )

            final_status = (
                "completed"
                if overall_failed == 0
                else "partial_success"
                if overall_success > 0
                else "failed"
            )
            yield StreamEvent(
                type="job_completed",
                job_id=job_id,
                status=final_status,
                data={"completed": overall_success, "failed": overall_failed},
            )
        except asyncio.CancelledError:
            logger.info("生图任务被取消 job=%s", job_id)
            raise
        except Exception as exc:  # noqa: BLE001 - 顶层流必须输出统一失败事件。
            logger.exception("生图任务失败 job=%s", job_id)
            yield StreamEvent(
                type="job_failed",
                job_id=job_id,
                status="failed",
                message=str(exc),
            )
