"""结构化 Prompt Planner 测试。"""

import json
from typing import Any

import pytest

from backend.domain import ImagePrompt, ProductContext, PromptPlanError
from backend.planner import PromptPlanner
from backend.templates import get_template
from backend.visual_templates import get_visual_template


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


@pytest.mark.asyncio
async def test_planner_includes_visual_template_and_verified_optional_information() -> None:
    """模板风格与用户补充事实必须进入 Planner，且空字段不能被当成事实。"""

    client = FakeGoogleClient([_valid_plan(6)])
    planner = PromptPlanner(client=client, model="gemini-3.5-flash")

    plan = await planner.plan_variant(
        template=get_template("product_set_01"),
        visual_template=get_visual_template("supplier_strength"),
        supplemental_info={
            "company_name": "Happy Arts & Crafts Ningbo Ltd.",
            "certifications": "FSC、BSCI、EN71",
            "factory_capacity": "",
        },
        context=ProductContext(
            product_name="木制益智玩具",
            product_description="面向海外采购商的木制益智玩具",
            visual_style="B2B 企业实力信息图",
        ),
        user_requirement="生成企业实力套图",
        language="zh-CN",
        target_model="nano_banana_2",
        variant_index=1,
    )

    payload = client.requests[0][1]
    instruction = json.loads(payload["contents"][0]["parts"][0]["text"])
    assert instruction["visual_template"]["id"] == "supplier_strength"
    assert instruction["verified_supplemental_info"] == {
        "company_name": "Happy Arts & Crafts Ningbo Ltd.",
        "certifications": "FSC、BSCI、EN71",
    }
    assert "可见文字只能来自用户明确提供的内容" in instruction["rules"]
    assert [item["title"] for item in instruction["slot_visual_directions"]] == [
        "企业总览",
        "仓储与交付",
        "品控流程",
        "研发与定制",
        "认证背书",
        "产能与服务",
    ]
    compositions = [
        item["required_composition"]
        for item in instruction["slot_visual_directions"]
    ]
    assert len(set(compositions)) == 6
    assert "禁止九宫格" in compositions[0]
    assert "研发工作台" in compositions[3]
    assert "不生成证书" in compositions[4]
    assert any("全局一致性只约束商品身份" in rule for rule in instruction["rules"])
    assert [item.title for item in plan.image_prompts] == [
        "企业总览",
        "仓储与交付",
        "品控流程",
        "研发与定制",
        "认证背书",
        "产能与服务",
    ]
    assert [item.role for item in plan.image_prompts] == [
        slot.role for slot in get_template("product_set_01").slots
    ]


@pytest.mark.asyncio
async def test_procurement_listing_template_binds_ten_b2b_roles() -> None:
    """采购详情模板的十个职责必须逐张进入 Planner，不能退回通用详情主题。"""

    client = FakeGoogleClient([_valid_plan(8)])
    planner = PromptPlanner(client=client, model="gemini-3.5-flash")

    plan = await planner.plan_variant(
        template=get_template("listing_01"),
        visual_template=get_visual_template("b2b_procurement_listing"),
        supplemental_info={
            "buyer_application": "海外咖啡店批量采购",
            "packaging_shipping": "中性彩盒与打样沟通",
        },
        context=ProductContext(
            product_name="白色陶瓷马克杯",
            product_description="适合餐饮渠道采购的防烫陶瓷杯",
            visual_style="B2B 采购详情页",
        ),
        user_requirement="生成阿里国际站详情图",
        language="zh-CN",
        target_model="nano_banana_2",
        variant_index=1,
    )

    payload = client.requests[0][1]
    instruction = json.loads(payload["contents"][0]["parts"][0]["text"])
    assert [item["title"] for item in instruction["slot_visual_directions"]] == [
        "产品与应用总览",
        "产品介绍",
        "核心卖点与采购价值",
        "结构细节与使用说明",
        "材质质感与制作工艺",
        "使用场景与终端适配",
        "品质控制与信任背书",
        "包装定制与合作流程",
    ]
    assert len({
        item["required_composition"]
        for item in instruction["slot_visual_directions"]
    }) == 8
    assert instruction["verified_supplemental_info"] == {
        "buyer_application": "海外咖啡店批量采购",
        "packaging_shipping": "中性彩盒与打样沟通",
    }
    assert [item.title for item in plan.image_prompts] == [
        "产品与应用总览",
        "产品介绍",
        "核心卖点与采购价值",
        "结构细节与使用说明",
        "材质质感与制作工艺",
        "使用场景与终端适配",
        "品质控制与信任背书",
        "包装定制与合作流程",
    ]


@pytest.mark.asyncio
async def test_refine_image_prompt_applies_feedback_without_changing_slot_identity() -> None:
    """单张优化必须重写画面内容，同时保持该张图的序号、职责和标题。"""

    client = FakeGoogleClient([
        {
            "prompt": "改为俯拍构图，增加三种颜色并保持商品主体一致",
            "negative_prompt": "不要改变商品结构",
            "visible_text": ["3 COLORS"],
        }
    ])
    planner = PromptPlanner(client=client, model="gemini-3.5-flash")
    original = ImagePrompt(
        index=4,
        role="color_options",
        title="颜色款式",
        prompt="展示两种颜色",
        negative_prompt="不要改变商品结构",
    )

    refined = await planner.refine_image_prompt(
        image_prompt=original,
        global_consistency_prompt="整套保持黑白极简风格",
        user_requirement="生成帽子商品套图",
        feedback="颜色太少，改成俯拍并展示三种颜色",
        language="zh-CN",
        target_model="gpt_image_2_openrouter",
    )

    assert refined.index == 4
    assert refined.role == "color_options"
    assert refined.title == "颜色款式"
    assert refined.prompt == "改为俯拍构图，增加三种颜色并保持商品主体一致"
    request_text = client.requests[0][1]["contents"][0]["parts"][0]["text"]
    assert "颜色太少，改成俯拍并展示三种颜色" in request_text
