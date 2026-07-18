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
)
from backend.limiter import AsyncRateLimiter
from backend.orchestrator import GenerationOrchestrator
from backend.templates import TemplateDefinition


class FakePlanner:
    """按模板槽位生成稳定 Prompt 的 Planner 替身。"""

    async def analyze_product(self, **_kwargs: object) -> ProductContext:
        """返回固定商品上下文。"""

        return ProductContext(
            product_name="测试商品",
            product_description="白色测试商品",
            visual_style="电商摄影",
        )

    async def plan_variant(
        self,
        *,
        template: TemplateDefinition,
        **_kwargs: object,
    ) -> PromptPlan:
        """根据真实模板返回同数量 Prompt。"""

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


class FakeProvider:
    """记录调用顺序并返回可识别图片的供应商替身。"""

    def __init__(self) -> None:
        self.calls: list[Call] = []

    async def generate(self, prompt: str, spec: ImageSpec) -> GeneratedBinary:
        """记录纯文生图并将首张标记为 anchor。"""

        self.calls.append(Call("generate", []))
        return GeneratedBinary(data=b"anchor", mime_type="image/png")

    async def edit(
        self,
        prompt: str,
        references: Sequence[BinaryAsset],
        spec: ImageSpec,
    ) -> GeneratedBinary:
        """记录图生图使用的参考图名称。"""

        self.calls.append(Call("edit", [reference.name for reference in references]))
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

    async def load_reference(self, _asset: ReferenceAsset) -> BinaryAsset:
        """返回名为 original 的用户原图。"""

        return BinaryAsset(data=b"original", mime_type="image/png", name="original")

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


def _orchestrator(provider: FakeProvider) -> GenerationOrchestrator:
    """组装使用全部替身依赖的编排器。"""

    return GenerationOrchestrator(
        planner=FakePlanner(),
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
