"""FastAPI 健康、上传、能力和 NDJSON 路由测试。"""

from collections.abc import AsyncIterator

from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

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
        openrouter_api_key="openrouter-key" if configured else "",
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
    assert "OPENROUTER_API_KEY" in payload["missing"]


def test_capabilities_expose_server_template_counts() -> None:
    """前端预计张数必须来自服务端模板，而非复制一份业务逻辑。"""

    payload = _client().get("/api/capabilities").json()
    assert payload["templates"]["product_set_01"]["slot_count"] == 6
    assert payload["templates"]["listing_01"]["slot_count"] == 5
    assert payload["max_variant_count"] == 10
    assert payload["max_output_images"] == 60


def test_generation_request_allows_up_to_ten_variants() -> None:
    """完整方案数量 1–10 必须和前端下拉选项保持一致。"""

    common = {
        "image_type": "set",
        "template_id": "product_set_01",
        "model": "nano_banana_2",
        "aspect_ratio": "1:1",
        "resolution": "1K",
        "user_requirement": "生成多版商品套图",
    }

    request = GenerationRequest.model_validate({**common, "variant_count": 10})
    assert request.variant_count == 10

    with pytest.raises(ValidationError):
        GenerationRequest.model_validate({**common, "variant_count": 11})


def test_capabilities_use_customer_facing_gpt_image_name() -> None:
    """能力接口使用客户名，并返回每个模型各自的官方比例集合。"""

    payload = _client().get("/api/capabilities").json()

    assert payload["models"]["gpt_image_2_openrouter"]["label"] == "GPT-Image-2"
    assert len(payload["models"]["nano_banana_2"]["aspect_ratios"]) == 14
    assert len(payload["models"]["nano_banana_pro"]["aspect_ratios"]) == 10
    assert "21:9" in payload["models"]["gpt_image_2_openrouter"]["aspect_ratios"]
    assert payload["models"]["nano_banana_2"]["resolutions"][0] == "512"


def test_generation_request_rejects_model_capability_mismatches() -> None:
    """服务端必须拦住前端历史状态中不属于当前模型的比例和清晰度。"""

    common = {
        "image_type": "main",
        "template_id": "main_01",
        "user_requirement": "生成商品主图",
    }
    flash_request = GenerationRequest.model_validate(
        {
            **common,
            "model": "nano_banana_2",
            "aspect_ratio": "1:8",
            "resolution": "512",
        }
    )
    assert flash_request.aspect_ratio == "1:8"
    assert flash_request.resolution == "512"

    with pytest.raises(ValidationError, match="不支持画面比例 1:8"):
        GenerationRequest.model_validate(
            {
                **common,
                "model": "nano_banana_pro",
                "aspect_ratio": "1:8",
                "resolution": "1K",
            }
        )

    with pytest.raises(ValidationError, match="不支持清晰度 512"):
        GenerationRequest.model_validate(
            {
                **common,
                "model": "nano_banana_pro",
                "aspect_ratio": "1:1",
                "resolution": "512",
            }
        )


def test_legacy_azure_model_name_is_migrated_to_openrouter() -> None:
    """旧浏览器任务仍可提交，但领域层必须改为 OpenRouter 模型名。"""

    request = GenerationRequest.model_validate(
        {
            "image_type": "main",
            "template_id": "main_01",
            "model": "gpt_image_2_azure",
            "aspect_ratio": "1:1",
            "resolution": "1K",
            "quality": "low",
            "user_requirement": "迁移旧任务",
        }
    )

    assert request.model == "gpt_image_2_openrouter"


def test_capabilities_expose_optional_visual_templates() -> None:
    """前端模板抽屉必须由服务端拿到视觉模板和可选信息字段。"""

    payload = _client().get("/api/capabilities").json()
    supplier = payload["visual_templates"]["supplier_strength"]

    assert supplier["name"] == "企业实力套图"
    assert supplier["category"] == "企业实力"
    assert len(supplier["preview_images"]) == 6
    assert supplier["generated_anchor_strategy"] == "independent"
    assert len(set(supplier["role_compositions"])) == 6
    assert "company_name" in [field["key"] for field in supplier["fields"]]
    assert all(field["required"] is False for field in supplier["fields"])


def test_stream_is_ndjson() -> None:
    """统一接口不传 mode 时仍使用逐行 JSON 返回实时结果。"""

    response = _client(configured=True).post(
        "/api/generations/stream",
        json={
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


def test_generation_mode_is_inferred_from_reference_assets() -> None:
    """后端必须只根据参考图是否存在决定文生图或图生图。

    旧客户端即使仍发送了错误的 ``mode``，也不能覆盖统一入口的自动判断。
    """

    common = {
        "image_type": "main",
        "template_id": "main_01",
        "model": "nano_banana_2",
        "aspect_ratio": "1:1",
        "resolution": "2K",
        "user_requirement": "生成商品主图",
    }
    without_reference = GenerationRequest(
        **common,
        mode="image-to-image",
    )
    with_reference = GenerationRequest(
        **common,
        mode="text-to-image",
        reference_assets=[
            ReferenceAsset(
                url="https://blob.example/ptj/reference/product.png",
                mime_type="image/png",
                filename="product.png",
            )
        ],
    )

    assert without_reference.mode == "text-to-image"
    assert with_reference.mode == "image-to-image"
