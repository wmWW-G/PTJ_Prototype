"""FastAPI 健康、上传、能力和 NDJSON 路由测试。"""

from collections.abc import AsyncIterator

from fastapi.testclient import TestClient

from backend.app import create_app
from backend.domain import GenerationRequest, ReferenceAsset, StreamEvent
from backend.settings import Settings


class FakeStorage:
    """只实现 API 上传路由需要的方法。"""

    async def upload_reference(
        self,
        filename: str,
        content: bytes,
        mime_type: str,
    ) -> ReferenceAsset:
        """返回稳定的参考图描述。"""

        return ReferenceAsset(
            url=f"https://blob.example/ptj/reference/{filename}",
            mime_type=mime_type,
            filename=filename,
        )


class FakeOrchestrator:
    """返回两条固定流事件的生成编排器。"""

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamEvent]:
        """模拟一个立刻完成的任务。"""

        yield StreamEvent(type="job_started", job_id="job-1", status="planning")
        yield StreamEvent(type="job_completed", job_id="job-1", status="completed")


def _client(*, configured: bool = False) -> TestClient:
    """创建隔离依赖的测试客户端。"""

    settings = Settings(
        google_cloud_project="project" if configured else "",
        google_service_account_json="{}" if configured else "",
        azure_openai_endpoint="https://azure.example" if configured else "",
        azure_openai_api_key="azure-key" if configured else "",
        azure_gpt_image_2_deployment="gpt-image-2" if configured else "",
        blob_read_write_token="blob-token" if configured else "",
        blob_allowed_host="blob.example" if configured else "",
    )
    return TestClient(
        create_app(
            settings=settings,
            storage=FakeStorage(),
            orchestrator=FakeOrchestrator(),
        )
    )


def test_upload_rejects_files_larger_than_four_mb() -> None:
    """单次 Vercel 请求必须为协议和函数开销留出空间。"""

    response = _client().post(
        "/api/uploads",
        files={
            "file": (
                "large.png",
                b"x" * (4 * 1024 * 1024 + 1),
                "image/png",
            )
        },
    )
    assert response.status_code == 413


def test_health_lists_missing_configuration_without_values() -> None:
    """健康检查只显示缺失变量名，绝不能输出配置值。"""

    payload = _client().get("/api/health").json()
    assert payload["configured"] is False
    assert "values" not in payload
    assert "AZURE_OPENAI_API_KEY" in payload["missing"]


def test_capabilities_expose_server_template_counts() -> None:
    """前端预计张数必须来自服务端模板，而非复制一份业务逻辑。"""

    payload = _client().get("/api/capabilities").json()
    assert payload["templates"]["product_set_01"]["slot_count"] == 6
    assert payload["templates"]["listing_01"]["slot_count"] == 5


def test_capabilities_use_customer_facing_gpt_image_name() -> None:
    """能力接口不应把内部 Azure 供应商信息拼进前端模型名称。"""

    payload = _client().get("/api/capabilities").json()

    assert payload["models"]["gpt_image_2_azure"]["label"] == "GPT-Image-2"


def test_stream_is_ndjson() -> None:
    """真实生图使用逐行 JSON，让前端逐张刷新结果。"""

    response = _client(configured=True).post(
        "/api/generations/stream",
        json={
            "mode": "text-to-image",
            "image_type": "main",
            "template_id": "main_01",
            "model": "nano_banana_2",
            "aspect_ratio": "1:1",
            "resolution": "2K",
            "user_requirement": "生成商品主图",
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    lines = [line for line in response.text.strip().splitlines()]
    assert len(lines) == 2
