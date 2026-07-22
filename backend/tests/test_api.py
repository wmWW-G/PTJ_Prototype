"""FastAPI 健康、上传、能力和 NDJSON 路由测试。"""

from collections.abc import AsyncIterator

from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

from backend.app import create_app
from backend.domain import GenerationRequest, ImagePrompt, ReferenceAsset, StreamEvent
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

    def __init__(self) -> None:
        self.last_request: GenerationRequest | None = None

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamEvent]:
        """模拟一个立刻完成的任务。"""

        self.last_request = request
        yield StreamEvent(type="job_started", job_id="job-1", status="planning")
        yield StreamEvent(type="job_completed", job_id="job-1", status="completed")

    async def refine_prompt(self, request: object) -> ImagePrompt:
        """模拟 LLM 根据用户意见返回重写后的单张 Prompt。"""

        return ImagePrompt(
            index=2,
            role="detail",
            title="结构细节",
            prompt="放大帽檐走线，并使用圆形细节特写",
            negative_prompt="不要改变帽子结构",
        )


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


def test_cors_allows_vite_when_local_dev_port_changes() -> None:
    """Vite 从 5173 顺延到 5174 时，浏览器仍应能调用生图接口。

    本地同时运行多个原型时，Vite 会自动选择下一个空闲端口。这个测试锁定
    真实故障：页面位于 ``127.0.0.1:5174`` 时，预检请求不能被 CORS 拒绝。
    """

    response = _client().options(
        "/api/generations/stream",
        headers={
            "Origin": "http://127.0.0.1:5174",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5174"


def test_capabilities_expose_server_template_counts() -> None:
    """前端预计张数必须来自服务端模板，而非复制一份业务逻辑。"""

    payload = _client().get("/api/capabilities").json()
    assert payload["templates"]["product_set_01"]["slot_count"] == 6
    assert payload["templates"]["listing_01"]["slot_count"] == 8
    assert payload["max_variant_count"] == 10
    assert payload["max_output_images"] == 80


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


def test_generation_request_rejects_duplicate_custom_roles() -> None:
    """同一来源职责不能重复占位，避免用户误生成两张完全相同的职责图。"""

    with pytest.raises(ValidationError, match="自定义模板不能重复选择同一职责"):
        GenerationRequest.model_validate(
            {
                "image_type": "set",
                "template_id": "product_set_01",
                "visual_template_id": "custom_set",
                "custom_visual_roles": [
                    {"template_id": "standard_product", "role_index": 0},
                    {"template_id": "standard_product", "role_index": 0},
                ],
                "model": "nano_banana_2",
                "aspect_ratio": "1:1",
                "resolution": "1K",
                "user_requirement": "重复职责测试",
            }
        )


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
    assert supplier["image_types"] == ["set"]
    assert len(supplier["preview_images"]) == 6
    assert supplier["generated_anchor_strategy"] == "independent"
    assert len(set(supplier["role_compositions"])) == 6
    assert "company_name" in [field["key"] for field in supplier["fields"]]
    assert all(field["required"] is False for field in supplier["fields"])

    procurement = payload["visual_templates"]["b2b_procurement_listing"]
    oem = payload["visual_templates"]["b2b_oem_listing"]
    fulfillment = payload["visual_templates"]["b2b_fulfillment_listing"]
    assert procurement["image_types"] == ["listing"]
    assert oem["image_types"] == ["listing"]
    assert fulfillment["image_types"] == ["listing"]
    assert len(procurement["role_highlights"]) == 8
    assert len(procurement["role_compositions"]) == 8
    assert len(procurement["preview_images"]) == 8
    assert len(oem["role_highlights"]) == 8
    assert len(oem["preview_images"]) == 8
    assert len(fulfillment["role_highlights"]) == 8
    assert len(fulfillment["preview_images"]) == 8
    assert procurement["generated_anchor_strategy"] == "independent"


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


def test_plan_endpoint_forces_planning_only_without_using_live_stream_route() -> None:
    """独立规划入口必须在旧后端上安全 404，在新后端上强制禁止图片生成。"""

    orchestrator = FakeOrchestrator()
    settings = Settings(
        google_cloud_project="project",
        google_service_account_json="{}",
        openrouter_api_key="openrouter-key",
        blob_read_write_token="blob-token",
        blob_allowed_host="blob.example",
    )
    client = TestClient(create_app(
        settings=settings,
        storage=FakeStorage(),
        orchestrator=orchestrator,
    ))

    response = client.post(
        "/api/generations/plan",
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
    assert orchestrator.last_request is not None
    assert orchestrator.last_request.planning_only is True


def test_refine_prompt_endpoint_returns_llm_rewritten_prompt() -> None:
    """前端应能把单张修改意见提交给 LLM，并取得新的结构化 Prompt。"""

    response = _client(configured=True).post(
        "/api/generations/refine-prompt",
        json={
            "image_prompt": {
                "index": 2,
                "role": "detail",
                "title": "结构细节",
                "prompt": "展示帽子结构",
                "negative_prompt": "不要改变帽子结构",
            },
            "global_consistency_prompt": "整套保持同一顶帽子",
            "user_requirement": "生成帽子商品套图",
            "feedback": "放大帽檐走线，增加圆形细节特写",
            "language": "zh-CN",
            "target_model": "gpt_image_2_openrouter",
        },
    )

    assert response.status_code == 200
    assert response.json()["prompt"] == "放大帽檐走线，并使用圆形细节特写"


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


def test_generation_mode_is_inferred_from_logo_asset() -> None:
    """只有 Logo 图片时也必须走图像编辑能力，才能保留用户上传的品牌图形。"""

    request = GenerationRequest(
        image_type="main",
        template_id="main_01",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成带品牌 Logo 的商品主图",
        logo_asset=ReferenceAsset(
            url="https://blob.example/ptj/reference/brand-logo.png",
            mime_type="image/png",
            filename="brand-logo.png",
        ),
    )

    assert request.mode == "image-to-image"
    assert request.logo_position == "bottom-right"


def test_generation_mode_is_inferred_from_style_reference() -> None:
    """只有参考设计图和文字时也必须走图像编辑，才能学习目标构图。"""

    request = GenerationRequest(
        image_type="main",
        template_id="main_01",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成白色咖啡杯主图",
        style_reference_assets=[
            ReferenceAsset(
                url="https://blob.example/ptj/reference/design.png",
                mime_type="image/png",
                filename="design.png",
            )
        ],
    )

    assert request.mode == "image-to-image"
