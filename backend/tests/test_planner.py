"""结构化 Prompt Planner 测试。"""

import json
from typing import Any

import pytest

from backend.domain import ProductContext, PromptPlanError
from backend.planner import PromptPlanner
from backend.templates import get_template


class FakeGoogleClient:
    """按顺序返回预设 JSON 的 Google 客户端替身。"""

    def __init__(self, replies: list[dict[str, Any] | str]) -> None:
        self.replies = replies
        self.requests: list[tuple[str, dict[str, Any]]] = []

    async def generate_content(self, model: str, payload: dict[str, Any]) -> dict[str, Any]:
        """记录请求并包装为 Gemini 文本响应。"""

        self.requests.append((model, payload))
        reply = self.replies.pop(0)
        text = reply if isinstance(reply, str) else json.dumps(reply, ensure_ascii=False)
        return {
            "candidates": [
                {"content": {"parts": [{"text": text}]}}
            ]
        }


def _valid_plan(count: int) -> dict[str, Any]:
    """创建指定槽位数量的合法 Planner 返回值。"""

    return {
        "global_consistency_prompt": "保持同一商品外观、颜色、材质和品牌元素。",
        "image_prompts": [
            {
                "index": index,
                "role": f"role_{index}",
                "prompt": f"生成第 {index} 张商品图",
                "negative_prompt": "不要改变商品结构",
                "visible_text": [],
            }
            for index in range(1, count + 1)
        ],
    }


def _valid_context() -> dict[str, Any]:
    """创建最小合法商品分析结果。"""

    return {
        "product_name": "白色马克杯",
        "product_description": "一只白色陶瓷马克杯",
        "selling_points": ["简约", "陶瓷质感"],
        "visual_style": "高级电商摄影",
        "must_keep": ["白色杯身", "弧形手柄"],
        "prohibited_claims": [],
    }


@pytest.mark.asyncio
async def test_analyze_product_accepts_json_inside_markdown_fence() -> None:
    """Gemini 偶发包裹 JSON 代码围栏时仍应解析成功。"""

    raw_reply = f"```json\n{json.dumps(_valid_context(), ensure_ascii=False)}\n```"
    client = FakeGoogleClient([raw_reply])
    planner = PromptPlanner(client=client, model="gemini-3.5-flash")

    context = await planner.analyze_product(user_requirement="白色陶瓷马克杯")

    assert context.product_name == "白色马克杯"


@pytest.mark.asyncio
async def test_analyze_product_retries_invalid_json_once() -> None:
    """首次结构化输出损坏时应修复一次，不能立即终止整套生图。"""

    client = FakeGoogleClient(["这不是 JSON", _valid_context()])
    planner = PromptPlanner(client=client, model="gemini-3.5-flash")

    context = await planner.analyze_product(user_requirement="白色陶瓷马克杯")

    assert context.product_name == "白色马克杯"
    assert len(client.requests) == 2


@pytest.mark.asyncio
async def test_planner_retries_wrong_slot_count_once() -> None:
    """首次数量错误时应修复一次，并接受第二次的合法计划。"""

    client = FakeGoogleClient([_valid_plan(0), _valid_plan(6)])
    planner = PromptPlanner(client=client, model="gemini-3.5-flash")

    plan = await planner.plan_variant(
        template=get_template("product_set_01"),
        context=ProductContext(
            product_name="便携榨汁杯",
            product_description="象牙白圆柱形便携榨汁杯",
            visual_style="高级简约电商摄影",
        ),
        user_requirement="突出便携性",
        language="zh-CN",
        target_model="nano_banana_2",
        variant_index=1,
    )

    assert len(plan.image_prompts) == 6
    assert len(client.requests) == 2


@pytest.mark.asyncio
async def test_planner_rejects_wrong_slot_count_after_retry() -> None:
    """连续两次数量错误必须停止，不能继续烧生图费用。"""

    client = FakeGoogleClient([_valid_plan(0), _valid_plan(0)])
    planner = PromptPlanner(client=client, model="gemini-3.5-flash")

    with pytest.raises(PromptPlanError):
        await planner.plan_variant(
            template=get_template("product_set_01"),
            context=ProductContext(
                product_name="商品",
                product_description="商品描述",
                visual_style="电商摄影",
            ),
            user_requirement="生成套图",
            language="zh-CN",
            target_model="nano_banana_2",
            variant_index=1,
        )
