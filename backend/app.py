"""FastAPI 应用、依赖组装与 NDJSON 生图接口。"""

from __future__ import annotations

import logging
from typing import AsyncIterator, Protocol

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .domain import (
    MODEL_ASPECT_RATIOS,
    MODEL_RESOLUTIONS,
    GenerationRequest,
    ImagePrompt,
    PromptRefinementRequest,
    StreamEvent,
)
from .google_client import GoogleVertexClient
from .limiter import AsyncRateLimiter
from .orchestrator import GenerationOrchestrator
from .planner import PromptPlanner
from .providers import GoogleImageProvider, OpenRouterImageProvider, ProviderRouter
from .settings import Settings
from .storage import MAX_UPLOAD_BYTES, BlobStorage, InvalidAssetError
from .templates import TEMPLATES
from .visual_templates import VISUAL_TEMPLATES


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


class UploadStorageProtocol(Protocol):
    """上传路由所需的最小存储接口。"""

    async def upload_reference(
        self,
        filename: str,
        content: bytes,
        mime_type: str,
    ) -> object:
        """上传参考图并返回可序列化 Pydantic 模型。"""


class OrchestratorProtocol(Protocol):
    """流式路由所需的最小编排接口。"""

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamEvent]:
        """逐条产生任务事件。"""

    async def refine_prompt(self, request: PromptRefinementRequest) -> ImagePrompt:
        """根据用户意见重写一张结构化 Prompt。"""


def _build_orchestrator(settings: Settings, storage: BlobStorage) -> GenerationOrchestrator:
    """根据 Vercel 环境变量组装真实 Planner、Adapter 和限流器。

    Args:
        settings: 已读取的服务器配置。
        storage: 同一应用共享的 Blob 存储。

    Returns:
        可执行真实 Google/OpenRouter 调用的生成编排器。

    Raises:
        ValueError: Google 服务账号 JSON 不合法时抛出。
        google.auth.exceptions.GoogleAuthError: 凭证字段不完整时抛出。
    """

    google_client = GoogleVertexClient(
        project=settings.google_cloud_project,
        location=settings.google_cloud_location,
        service_account_json=settings.google_service_account_json,
    )
    planner = PromptPlanner(
        client=google_client,
        model=settings.google_prompt_planner_model,
    )
    google_provider = GoogleImageProvider(google_client)
    openrouter_provider = OpenRouterImageProvider(
        api_key=settings.openrouter_api_key,
        model=settings.openrouter_gpt_image_2_model,
        base_url=settings.openrouter_base_url,
        site_url=settings.openrouter_site_url,
        app_name=settings.openrouter_app_name,
    )
    return GenerationOrchestrator(
        planner=planner,
        providers=ProviderRouter(
            {
                "nano_banana_2": google_provider,
                "nano_banana_pro": google_provider,
                "gpt_image_2_openrouter": openrouter_provider,
            }
        ),
        storage=storage,
        limiters={
            "nano_banana_2": AsyncRateLimiter(max_concurrency=4, requests_per_minute=60),
            "nano_banana_pro": AsyncRateLimiter(max_concurrency=3, requests_per_minute=40),
            # OpenRouter 实际限额取决于当前 Key 的额度与上游路由。保守使用三路
            # 并发和六次/分钟，并优先遵守响应中的 Retry-After，避免批量套图突发。
            "gpt_image_2_openrouter": AsyncRateLimiter(
                max_concurrency=3,
                requests_per_minute=6,
                retry_delays=(10.0, 30.0),
                retry_jitter_seconds=1.5,
            ),
        },
    )


def create_app(
    *,
    settings: Settings | None = None,
    storage: UploadStorageProtocol | None = None,
    orchestrator: OrchestratorProtocol | None = None,
) -> FastAPI:
    """创建支持生产依赖或测试替身的 FastAPI 应用。

    Args:
        settings: 可选配置；默认从当前环境变量读取。
        storage: 可选存储替身；默认使用 Vercel Blob。
        orchestrator: 可选编排替身；默认在首个真实请求时延迟组装。

    Returns:
        已注册全部 `/api` 路由的 FastAPI 应用。

    Raises:
        不在创建阶段主动抛出配置异常，确保 health 始终可访问。
    """

    runtime_settings = settings or Settings.from_env()
    runtime_storage = storage or BlobStorage(
        token=runtime_settings.blob_read_write_token,
        allowed_host=runtime_settings.blob_allowed_host,
    )
    runtime_orchestrator = orchestrator

    def get_runtime_orchestrator(model: str) -> OrchestratorProtocol:
        """检查当前模型配置并按需初始化共享编排器。

        Args:
            model: 当前请求选择的图片模型；Prompt 优化也沿用它调整表达。

        Returns:
            测试替身或已经组装完成的生产编排器。

        Raises:
            HTTPException: 配置缺失或生产依赖初始化失败时抛出。
        """

        nonlocal runtime_orchestrator
        missing = runtime_settings.missing_for_model(model)  # type: ignore[arg-type]
        if missing:
            raise HTTPException(
                status_code=503,
                detail={"message": "真实生图尚未完成服务端配置", "missing": missing},
            )
        if runtime_orchestrator is None:
            try:
                if not isinstance(runtime_storage, BlobStorage):
                    raise RuntimeError("生产编排器需要 BlobStorage")
                runtime_orchestrator = _build_orchestrator(runtime_settings, runtime_storage)
            except Exception as exc:  # noqa: BLE001 - 配置解析错误需转成明确 503。
                logger.exception("真实生图服务初始化失败")
                raise HTTPException(status_code=503, detail="真实生图服务初始化失败") from exc
        return runtime_orchestrator

    app = FastAPI(
        title="批图匠真实生图 API",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(runtime_settings.allowed_origins),
        allow_origin_regex=runtime_settings.allowed_origin_regex or None,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/health")
    async def health() -> dict[str, object]:
        """返回不含任何密钥值的配置状态。

        Args:
            无。

        Returns:
            configured、missing 和非敏感模型信息。

        Raises:
            不抛出异常。
        """

        return {"ok": True, **runtime_settings.safe_status()}

    @app.get("/api/capabilities")
    async def capabilities() -> dict[str, object]:
        """返回前端动态控件、模板张数和模型能力。

        Args:
            无。

        Returns:
            模型能力表、模板槽位数和上传约束。

        Raises:
            不抛出异常。
        """

        return {
            "models": {
                "nano_banana_2": {
                    "label": "Nano Banana 2",
                    "aspect_ratios": list(MODEL_ASPECT_RATIOS["nano_banana_2"]),
                    "resolutions": list(MODEL_RESOLUTIONS["nano_banana_2"]),
                    "quality": False,
                    "preview_resolutions": ["4K"],
                },
                "nano_banana_pro": {
                    "label": "Nano Banana Pro",
                    "aspect_ratios": list(MODEL_ASPECT_RATIOS["nano_banana_pro"]),
                    "resolutions": list(MODEL_RESOLUTIONS["nano_banana_pro"]),
                    "quality": False,
                    "preview_resolutions": ["4K"],
                },
                "gpt_image_2_openrouter": {
                    "label": "GPT-Image-2",
                    # GPT 原生支持 3:1 内的灵活尺寸；这里返回常用合法预设。
                    # OpenRouter 当前未开放尺寸字段，Adapter 仍只把比例写入 Prompt。
                    "aspect_ratios": list(MODEL_ASPECT_RATIOS["gpt_image_2_openrouter"]),
                    "resolutions": list(MODEL_RESOLUTIONS["gpt_image_2_openrouter"]),
                    "quality": True,
                    "qualities": ["low", "medium", "high"],
                },
            },
            "templates": {
                template_id: {
                    "name": template.name,
                    "image_type": template.image_type,
                    "slot_count": len(template.slots),
                    "slots": [slot.model_dump() for slot in template.slots],
                }
                for template_id, template in TEMPLATES.items()
            },
            "visual_templates": {
                template_id: template.model_dump()
                for template_id, template in VISUAL_TEMPLATES.items()
            },
            "uploads": {
                "max_file_bytes": MAX_UPLOAD_BYTES,
                "max_files": 10,
                "mime_types": ["image/png", "image/jpeg", "image/webp"],
            },
            "max_variant_count": 10,
            # 详情图固定为 8 张，且产品保留最多 10 个完整方案的能力，
            # 因此能力上限同步到 80，避免前端展示的数量与服务端声明冲突。
            "max_output_images": 80,
        }

    @app.post("/api/uploads")
    async def upload_reference(file: UploadFile = File(...)) -> object:
        """上传一张不超过 4 MB 的 PNG/JPEG/WebP 参考图。

        Args:
            file: 浏览器 multipart 上传的单个文件。

        Returns:
            包含 URL、MIME 和安全文件名的参考图描述。

        Raises:
            HTTPException: 类型非法、文件过大、为空或 Blob 上传失败时抛出。
        """

        # 多读 1 字节即可识别超限，避免把任意大文件完整读入函数内存。
        content = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="单张图片不能超过 4 MB")
        try:
            return await runtime_storage.upload_reference(
                file.filename or "image",
                content,
                file.content_type or "application/octet-stream",
            )
        except InvalidAssetError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001 - 对象存储异常不能泄露内部响应。
            logger.exception("参考图上传失败")
            raise HTTPException(status_code=502, detail="参考图存储失败") from exc

    @app.post("/api/generations/stream")
    async def stream_generation(request: GenerationRequest) -> StreamingResponse:
        """执行真实生图并以 NDJSON 持续返回任务事件。

        Args:
            request: 已校验的统一生图请求。

        Returns:
            `application/x-ndjson` 流，每行是一条 StreamEvent。

        Raises:
            HTTPException: 服务器缺少必要 Vercel 环境变量或依赖组装失败时抛出。
        """

        active_orchestrator = get_runtime_orchestrator(request.model)

        async def event_lines() -> AsyncIterator[str]:
            """把 Pydantic 事件编码为一行一个 JSON。"""

            async for event in active_orchestrator.stream(request):
                yield event.model_dump_json(exclude_none=True) + "\n"

        return StreamingResponse(
            event_lines(),
            media_type="application/x-ndjson",
            headers={"Cache-Control": "no-cache, no-transform"},
        )

    @app.post("/api/generations/plan")
    async def plan_generation(request: GenerationRequest) -> StreamingResponse:
        """只规划逐张生图 Prompt，不允许调用图片生成模型。

        该路由与真实生图路由分离，并在服务器端强制改写
        ``planning_only``，因此不依赖浏览器是否正确传参。对旧版后端请求
        该新地址时只会得到 404，不会误落入真实生图流程。

        Args:
            request: 待规划的统一生图请求；服务器会忽略客户端传入的
                ``planning_only`` 和 ``confirmed_plans`` 值。

        Returns:
            ``application/x-ndjson`` 流，包含 ``plan_ready`` 与最终
            ``job_completed(planned)`` 事件。

        Raises:
            HTTPException: 服务器缺少 Planner 所需配置或依赖组装失败时抛出。
        """

        planning_request = request.model_copy(
            update={"planning_only": True, "confirmed_plans": []},
        )
        active_orchestrator = get_runtime_orchestrator(planning_request.model)

        async def event_lines() -> AsyncIterator[str]:
            """把 Prompt 规划事件编码为一行一个 JSON。"""

            async for event in active_orchestrator.stream(planning_request):
                yield event.model_dump_json(exclude_none=True) + "\n"

        return StreamingResponse(
            event_lines(),
            media_type="application/x-ndjson",
            headers={"Cache-Control": "no-cache, no-transform"},
        )

    @app.post("/api/generations/refine-prompt", response_model=ImagePrompt)
    async def refine_generation_prompt(request: PromptRefinementRequest) -> ImagePrompt:
        """让 Prompt Planner 根据用户意见重写一张图片的提示词。

        Args:
            request: 当前单图 Prompt、整套约束、原需求和改进意见。

        Returns:
            保留槽位身份、内容已经优化的结构化 Prompt。

        Raises:
            HTTPException: 配置缺失、服务初始化或 Planner 优化失败时抛出。
        """

        active_orchestrator = get_runtime_orchestrator(request.target_model)
        try:
            return await active_orchestrator.refine_prompt(request)
        except Exception as exc:  # noqa: BLE001 - 不向前端泄露供应商响应细节。
            logger.exception("单张 Prompt 优化失败")
            raise HTTPException(status_code=502, detail="AI 没能完成这张 Prompt 的优化，请重试") from exc

    return app


app = create_app()
