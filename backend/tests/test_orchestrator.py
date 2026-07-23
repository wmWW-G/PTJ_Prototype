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


def _high_information_units() -> list[dict[str, str]]:
    """创建满足参考图级别 high 契约的九条可视信息模块。"""

    return [
        {"kind": "hero", "content": "完整商品主体", "source": "visual_evidence"},
        {"kind": "detail_callout", "content": "帽檐走线特写", "source": "visual_evidence"},
        {"kind": "detail_callout", "content": "调节扣特写", "source": "visual_evidence"},
        {"kind": "supporting_visual", "content": "侧面辅助角度", "source": "layout_instruction"},
        {"kind": "variant", "content": "颜色变体矩阵", "source": "layout_instruction"},
        {"kind": "label", "content": "透气面料", "source": "verified_input"},
        {"kind": "label", "content": "可调节帽围", "source": "verified_input"},
        {"kind": "label", "content": "弯曲帽檐", "source": "visual_evidence"},
        {"kind": "badge", "content": "支持 Logo 定制", "source": "verified_input"},
    ]


class FakePlanner:
    """按模板槽位生成稳定 Prompt 的 Planner 替身。"""

    def __init__(self) -> None:
        self.analysis_reference_names: list[str] = []
        self.last_visual_template: VisualTemplateDefinition | None = None
        self.analysis_calls = 0
        self.plan_calls = 0

    async def analyze_product(
        self,
        *,
        references: Sequence[BinaryAsset],
        **_kwargs: object,
    ) -> ProductContext:
        """记录商品分析收到的图片，并返回固定商品上下文。"""

        self.analysis_calls += 1
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

        self.plan_calls += 1
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
async def test_planning_only_returns_prompts_without_calling_image_provider() -> None:
    """Prompt 确认阶段只能调用 Planner，绝不能提前消耗图片模型额度。"""

    provider = FakeProvider()
    request = GenerationRequest(
        image_type="set",
        template_id="product_set_01",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成六张商品套图",
        planning_only=True,
    )

    events = [event async for event in _orchestrator(provider).stream(request)]

    assert provider.calls == []
    assert [event.type for event in events].count("plan_ready") == 1
    assert not any(event.type in {"variant_started", "anchor_started", "image_started"} for event in events)
    assert events[-1].type == "job_completed"
    assert events[-1].status == "planned"


@pytest.mark.asyncio
async def test_confirmed_plans_skip_planner_and_drive_image_generation() -> None:
    """用户确认后的 Prompt 必须直接执行，不能在生图前被 Planner 偷偷重写。"""

    provider = FakeProvider()
    planner = FakePlanner()
    request = GenerationRequest(
        image_type="main",
        template_id="main_01",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成商品主图",
        confirmed_plans=[
            PromptPlan(
                global_consistency_prompt="保持商品真实外观",
                image_prompts=[
                    {
                        "index": 1,
                        "role": "hero",
                        "title": "商品主视觉",
                        "prompt": "这是用户确认后的最终生图 Prompt",
                        "visible_text": [
                            "透气面料",
                            "可调节帽围",
                            "弯曲帽檐",
                            "金属调节扣",
                            "颜色选择",
                        ],
                        "information_units": _high_information_units(),
                    }
                ],
            )
        ],
    )

    events = [event async for event in _orchestrator(provider, planner).stream(request)]

    assert planner.analysis_calls == 0
    assert planner.plan_calls == 0
    assert len(provider.calls) == 1
    assert "这是用户确认后的最终生图 Prompt" in provider.calls[0].prompt
    assert any(event.type == "anchor_completed" for event in events)


@pytest.mark.asyncio
async def test_confirmed_high_density_plan_reaches_provider_with_visible_contract() -> None:
    """合法 high 计划必须把结构化信息与画面文案写入实际图片模型 Prompt。"""

    provider = FakeProvider()
    request = GenerationRequest(
        image_type="set",
        template_id="product_set_01",
        visual_template_id="dense_product_set",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成高信息量棒球帽套图",
        confirmed_plans=[
            PromptPlan(
                global_consistency_prompt="保持商品一致",
                image_prompts=[
                    {
                        "index": index,
                        "role": f"role-{index}",
                        "prompt": f"生成第 {index} 张",
                        "visible_text": [
                            "透气面料",
                            "可调节帽围",
                            "弯曲帽檐",
                            "金属调节扣",
                            "颜色选择",
                        ],
                        "information_units": _high_information_units(),
                    }
                    for index in range(1, 7)
                ],
            )
        ],
    )

    events = [event async for event in _orchestrator(provider).stream(request)]

    assert len(provider.calls) == 6
    assert "内部构图类型=detail_callout（类型名不得作为画面文字）" in provider.calls[0].prompt
    assert "帽檐走线特写" in provider.calls[0].prompt
    assert "透气面料" in provider.calls[0].prompt
    assert "内部构图信息单元（类型名不得作为画面可见文本）" in provider.calls[0].prompt
    assert "仅尝试呈现以下已确认文案，不得添加其他硬信息，优先保持清晰可读" in provider.calls[0].prompt
    # 即使用户提交的是已确认计划，实际图片模型也必须收到统一的参考图级
    # 图文框架，不能只靠 Planner 曾经把规则写进单张 prompt。
    assert "至少 4 个辅助视觉模块" in provider.calls[0].prompt
    assert "每个模块必须同时包含图片、短标签和一句解释" in provider.calls[0].prompt
    assert "目标有效内容占比约 80%" in provider.calls[0].prompt
    plan_event = next(event for event in events if event.type == "plan_ready")
    visible_global_prompt = plan_event.data["plan"]["global_consistency_prompt"]
    assert "至少 4 个辅助视觉模块" in visible_global_prompt
    assert "不承诺精确叠字或字符准确率" not in provider.calls[0].prompt
    assert any(event.type == "job_completed" for event in events)


@pytest.mark.asyncio
async def test_confirmed_high_density_plan_is_rejected_before_provider_when_contract_is_broken() -> None:
    """用户确认或单图优化后删掉高密度信息时，后端必须在生图前阻断。"""

    provider = FakeProvider()
    request = GenerationRequest(
        image_type="set",
        template_id="product_set_01",
        visual_template_id="dense_product_set",
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="提交不完整高密度套图",
        confirmed_plans=[
            PromptPlan(
                global_consistency_prompt="保持商品一致",
                image_prompts=[
                    {"index": index, "role": f"role-{index}", "prompt": f"生成第 {index} 张"}
                    for index in range(1, 7)
                ],
            )
        ],
    )

    events = [event async for event in _orchestrator(provider).stream(request)]

    assert provider.calls == []
    assert events[-1].type == "job_failed"
    assert "高信息密度" in (events[-1].message or "")


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
    plan_event = next(event for event in events if event.type == "plan_ready")
    visible_global_prompt = plan_event.data["plan"]["global_consistency_prompt"]
    assert "最后一张参考图是用户上传的品牌 Logo" in visible_global_prompt
    assert "放在右上角" in visible_global_prompt
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
async def test_custom_set_passes_registered_recipe_and_high_density_to_planner() -> None:
    """选中白名单构图配方后，Planner 必须收到配方文本和高密度契约。"""

    provider = FakeProvider()
    planner = FakePlanner()
    request = GenerationRequest(
        image_type="set",
        template_id="product_set_01",
        visual_template_id="custom_set",
        custom_visual_roles=[
            {
                "template_id": "standard_product",
                "role_index": index,
                "layout_recipe_id": "detail_callouts" if index == 0 else None,
            }
            for index in range(6)
        ],
        model="nano_banana_2",
        aspect_ratio="1:1",
        resolution="2K",
        user_requirement="生成含细节引线标签的六张高密度商品套图",
    )

    events = [event async for event in _orchestrator(provider, planner).stream(request)]

    assert planner.last_visual_template is not None
    assert "2–3 个圆形或几何放大特写" in planner.last_visual_template.role_compositions[0]
    assert planner.last_visual_template.density_profile.level == "high"
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
