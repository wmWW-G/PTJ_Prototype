"""有图和无图生成依赖关系测试。"""

from dataclasses import dataclass
from typing import Sequence

import pytest

from backend.domain import (
    BinaryAsset,
    GeneratedBinary,
    GenerationRequest,
    ImageSpec,
    ProductContext,
    PromptPlan,
    ReferenceAsset,
    VisualTemplateDefinition,
)
from backend.limiter import AsyncRateLimiter
from backend.orchestrator import GenerationOrchestrator
from backend.templates import TemplateDefinition


class FakePlanner:
    """按模板槽位生成稳定 Prompt 的 Planner 替身。"""

    def __init__(self) -> None:
        self.analysis_reference_names: list[str] = []
        self.last_visual_template: VisualTemplateDefinition | None = None

    async def analyze_product(
        self,
        *,
        references: Sequence[BinaryAsset],
        **_kwargs: object,
    ) -> ProductContext:
        """记录商品分析收到的图片，并返回固定商品上下文。"""

        self.analysis_reference_names = [reference.name for reference in references]

        return ProductContext(
            product_name="测试商品",
            product_description="白色测试商品",
            visual_style="电商摄影",
        )

    async def plan_variant(
        self,
        *,
        template: TemplateDefinition,
        visual_template: VisualTemplateDefinition,
        **_kwargs: object,
    ) -> PromptPlan:
        """根据真实模板返回同数量 Prompt。"""

        self.last_visual_template = visual_template

        return PromptPlan(
            global_consistency_prompt="保持商品一致",
            image_prompts=[
                {
                    "index": slot.index,
                    "role": slot.role,
                    "prompt": f"prompt-{slot.index}",
                }
                for slot in template.slots
            ],
        )


@dataclass
class Call:
    """记录一次供应商调用方式和参考图名称。"""

    method: str
    references: list[str]
    prompt: str


class FakeProvider:
    """记录调用顺序并返回可识别图片的供应商替身。"""

    def __init__(self) -> None:
        self.calls: list[Call] = []

    async def generate(self, prompt: str, spec: ImageSpec) -> GeneratedBinary:
        """记录纯文生图并将首张标记为 anchor。"""

        self.calls.append(Call("generate", [], prompt))
        return GeneratedBinary(data=b"anchor", mime_type="image/png")

    async def edit(
        self,
        prompt: str,
        references: Sequence[BinaryAsset],
        spec: ImageSpec,
    ) -> GeneratedBinary:
        """记录图生图使用的参考图名称。"""

        self.calls.append(Call("edit", [reference.name for reference in references], prompt))
        return GeneratedBinary(data=f"image-{prompt}".encode(), mime_type="image/png")


class FakeRouter:
    """总是返回同一 FakeProvider 的路由器。"""

    def __init__(self, provider: FakeProvider) -> None:
        self.provider = provider

    def get(self, _model: str) -> FakeProvider:
        """忽略模型名并返回替身。"""

        return self.provider


class FakeStorage:
    """模拟参考图下载和结果保存。"""

    async def load_reference(self, asset: ReferenceAsset) -> BinaryAsset:
        """根据上传文件名返回可区分商品图与 Logo 的测试资产。"""

        name = asset.filename.rsplit(".", 1)[0]
        return BinaryAsset(data=name.encode(), mime_type="image/png", name=name)

    async def save_generated(
        self,
        generated: GeneratedBinary,
        *,
        job_id: str,
        variant_index: int,
        image_index: int,
    ) -> str:
        """返回稳定的测试 URL。"""

        return f"https://blob.example/{job_id}/{variant_index}/{image_index}.png"


def _orchestrator(
    provider: FakeProvider,
    planner: FakePlanner | None = None,
) -> GenerationOrchestrator:
    """组装使用全部替身依赖的编排器。"""

    return GenerationOrchestrator(
        planner=planner or FakePlanner(),
        providers=FakeRouter(provider),
        storage=FakeStorage(),
        limiters={
            "nano_banana_2": AsyncRateLimiter(
                max_concurrency=6,
                requests_per_minute=1000,
                retry_delays=(0, 0),
            )
        },
    )


@pytest.mark.asyncio
async def test_reference_mode_uses_original_references_for_every_slot() -> None:
    """有图套图的六个槽位必须始终共享用户原图。"""

    provider = FakeProvider()
    request = GenerationRequest(
        image_type="set",
        template_id="product_set_01",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成六张商品套图",
        reference_assets=[
            ReferenceAsset(
                url="https://blob.example/ptj/reference/original.png",
                mime_type="image/png",
                filename="original.png",
            )
        ],
    )

    events = [event async for event in _orchestrator(provider).stream(request)]

    assert [call.references for call in provider.calls] == [["original"]] * 6
    assert any(event.type == "job_completed" for event in events)


@pytest.mark.asyncio
async def test_logo_is_appended_without_entering_product_analysis() -> None:
    """Logo 应作为最后一张生成参考图，并把原样保留与位置约束写入 Prompt。"""

    provider = FakeProvider()
    request = GenerationRequest(
        image_type="main",
        template_id="main_01",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成白色咖啡杯主图",
        reference_assets=[
            ReferenceAsset(
                url="https://blob.example/ptj/reference/original.png",
                mime_type="image/png",
                filename="original.png",
            )
        ],
        logo_asset=ReferenceAsset(
            url="https://blob.example/ptj/reference/acme-logo.png",
            mime_type="image/png",
            filename="acme-logo.png",
        ),
        logo_position="top-right",
    )

    events = [event async for event in _orchestrator(provider).stream(request)]

    assert provider.calls[0].references == ["original", "brand-logo"]
    assert "最后一张参考图是用户上传的品牌 Logo" in provider.calls[0].prompt
    assert "放在右上角" in provider.calls[0].prompt
    assert any(event.type == "job_completed" for event in events)


@pytest.mark.asyncio
async def test_style_reference_controls_layout_without_entering_product_analysis() -> None:
    """参考设计图应参与最终构图，但商品分析只能读取用户自己的产品素材。"""

    provider = FakeProvider()
    planner = FakePlanner()
    request = GenerationRequest(
        image_type="main",
        template_id="main_01",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成白色咖啡杯主图",
        reference_assets=[
            ReferenceAsset(
                url="https://blob.example/ptj/reference/product.png",
                mime_type="image/png",
                filename="product.png",
            )
        ],
        style_reference_assets=[
            ReferenceAsset(
                url="https://blob.example/ptj/reference/competitor-layout.png",
                mime_type="image/png",
                filename="competitor-layout.png",
            )
        ],
    )

    events = [event async for event in _orchestrator(provider, planner).stream(request)]

    assert planner.analysis_reference_names == ["product"]
    assert provider.calls[0].references == ["product", "style-reference-1"]
    assert "只能学习其构图层级、镜头视角、光线、配色和留白节奏" in provider.calls[0].prompt
    assert "不得复制其中的商品外观、品牌、Logo、文字、水印" in provider.calls[0].prompt
    assert any(event.type == "job_completed" for event in events)


@pytest.mark.asyncio
async def test_text_mode_generates_anchor_before_fan_out() -> None:
    """无图套图必须先文生图 1，其余五张都使用同一个图 1。"""

    provider = FakeProvider()
    request = GenerationRequest(
        image_type="set",
        template_id="product_set_01",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成六张商品套图",
    )

    events = [event async for event in _orchestrator(provider).stream(request)]

    assert provider.calls[0].method == "generate"
    assert len(provider.calls) == 6
    assert all(call.references == ["anchor"] for call in provider.calls[1:])
    assert any(event.type == "anchor_completed" for event in events)


@pytest.mark.asyncio
async def test_supplier_strength_text_mode_does_not_clone_overview_layout() -> None:
    """企业实力套图的后五张必须独立文生图。

    首张“企业总览”是已排版的复杂信息图，如果继续当作图生图参考，
    模型会把它的九宫格、地图和图标一起复制到其他职责图。
    """

    provider = FakeProvider()
    request = GenerationRequest(
        image_type="set",
        template_id="product_set_01",
        visual_template_id="supplier_strength",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成六张构图不同的企业实力套图",
    )

    events = [event async for event in _orchestrator(provider).stream(request)]

    assert len(provider.calls) == 6
    assert all(call.method == "generate" for call in provider.calls)
    assert all(call.references == [] for call in provider.calls)
    assert any(event.type == "job_completed" for event in events)


@pytest.mark.asyncio
async def test_rejects_visual_template_from_another_image_type() -> None:
    """详情图不能误用六张套图模板，避免职责数量和业务结构错配。"""

    provider = FakeProvider()
    request = GenerationRequest(
        image_type="listing",
        template_id="listing_01",
        visual_template_id="supplier_strength",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成八张 B2B 详情图",
    )

    events = [event async for event in _orchestrator(provider).stream(request)]

    assert provider.calls == []
    assert events[-1].type == "job_failed"
    assert events[-1].message == "当前生图模板不适用于所选图片类型"


@pytest.mark.asyncio
async def test_custom_set_preserves_user_selected_role_order() -> None:
    """自定义套图只能引用服务器现有职责，并按用户顺序交给 Planner。"""

    provider = FakeProvider()
    planner = FakePlanner()
    request = GenerationRequest(
        image_type="set",
        template_id="product_set_01",
        visual_template_id="custom_set",
        custom_visual_roles=[
            {"template_id": "supplier_strength", "role_index": 0},
            {"template_id": "standard_product", "role_index": 2},
            {"template_id": "minimal_premium", "role_index": 1},
            {"template_id": "lifestyle_story", "role_index": 3},
            {"template_id": "supplier_strength", "role_index": 4},
            {"template_id": "standard_product", "role_index": 5},
        ],
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成自由组合的六张商品套图",
    )

    events = [event async for event in _orchestrator(provider, planner).stream(request)]

    assert planner.last_visual_template is not None
    assert planner.last_visual_template.id == "custom_set"
    assert planner.last_visual_template.role_highlights == [
        "企业总览",
        "细节特写",
        "材质微距",
        "功能瞬间",
        "认证背书",
        "组合总览",
    ]
    assert any(event.type == "job_completed" for event in events)


@pytest.mark.asyncio
async def test_custom_template_rejects_cross_type_roles() -> None:
    """套图自定义模板不能混入详情图职责，避免绕过前端类型隔离。"""

    provider = FakeProvider()
    request = GenerationRequest(
        image_type="set",
        template_id="product_set_01",
        visual_template_id="custom_set",
        custom_visual_roles=[
            {"template_id": "b2b_procurement_listing", "role_index": 0},
            {"template_id": "standard_product", "role_index": 1},
            {"template_id": "standard_product", "role_index": 2},
            {"template_id": "standard_product", "role_index": 3},
            {"template_id": "standard_product", "role_index": 4},
            {"template_id": "standard_product", "role_index": 5},
        ],
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="尝试跨类型混用职责",
    )

    events = [event async for event in _orchestrator(provider).stream(request)]

    assert provider.calls == []
    assert events[-1].type == "job_failed"
    assert events[-1].message == "自定义模板职责不能跨图片类型混用"


@pytest.mark.asyncio
async def test_custom_listing_requires_exactly_eight_roles() -> None:
    """详情图的自定义模板必须保持固定八张，不能提交不完整结构。"""

    provider = FakeProvider()
    request = GenerationRequest(
        image_type="listing",
        template_id="listing_01",
        visual_template_id="custom_listing",
        custom_visual_roles=[
            {"template_id": "b2b_oem_listing", "role_index": index}
            for index in range(7)
        ],
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="提交不完整的详情图组合",
    )

    events = [event async for event in _orchestrator(provider).stream(request)]

    assert provider.calls == []
    assert events[-1].type == "job_failed"
    assert events[-1].message == "自定义详情图必须选择 8 个职责"
