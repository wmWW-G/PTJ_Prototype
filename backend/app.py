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

        nonlocal runtime_orchestrator
        # 配置按当前供应商检查，避免 OpenRouter 暂未配置时连带阻断两个 Google
        # 图片模型。Planner 和 Blob 是三款模型的共同依赖，因此始终检查。
        missing = runtime_settings.missing_for_model(request.model)
        if missing:
            raise HTTPException(
                status_code=503,
                detail={"message": "真实生图尚未完成服务端配置", "missing": missing},
            )
        if runtime_orchestrator is None:
            try:
                # 默认存储一定是 BlobStorage；只有测试替身才会同时注入 orchestrator。
                if not isinstance(runtime_storage, BlobStorage):
                    raise RuntimeError("生产编排器需要 BlobStorage")
                runtime_orchestrator = _build_orchestrator(runtime_settings, runtime_storage)
            except Exception as exc:  # noqa: BLE001 - 配置解析错误需转成明确 503。
                logger.exception("真实生图服务初始化失败")
                raise HTTPException(status_code=503, detail="真实生图服务初始化失败") from exc

        async def event_lines() -> AsyncIterator[str]:
            """把 Pydantic 事件编码为一行一个 JSON。"""

            assert runtime_orchestrator is not None
            async for event in runtime_orchestrator.stream(request):
                yield event.model_dump_json(exclude_none=True) + "\n"

        return StreamingResponse(
            event_lines(),
            media_type="application/x-ndjson",
            headers={"Cache-Control": "no-cache, no-transform"},
        )

    return app


app = create_app()
