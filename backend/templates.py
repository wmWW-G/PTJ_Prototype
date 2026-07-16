"""服务器端图片模板仓库。

模板决定“一版有几张、每张负责什么”。Prompt 模型只能填充模板，不能擅自改张数，
因此这里是生成数量和产品结构的唯一事实来源。
"""

from .domain import TemplateDefinition, TemplateSlot, UnsupportedTemplateError


def _slot(
    index: int,
    role: str,
    title: str,
    objective: str,
    composition: str,
    text_policy: str,
) -> TemplateSlot:
    """用统一字段创建模板槽位。

    Args:
        index: 槽位顺序，从 1 开始。
        role: 稳定的机器可读角色名。
        title: 给产品和日志展示的中文名称。
        objective: 这张图必须完成的业务目标。
        composition: 默认构图约束。
        text_policy: 画面文字的允许范围和准确性要求。

    Returns:
        已通过 Pydantic 校验的模板槽位。

    Raises:
        pydantic.ValidationError: 字段缺失或不符合模型约束时抛出。
    """

    return TemplateSlot(
        index=index,
        role=role,
        title=title,
        objective=objective,
        composition=composition,
        text_policy=text_policy,
    )


TEMPLATES: dict[str, TemplateDefinition] = {
    "product_set_01": TemplateDefinition(
        id="product_set_01",
        image_type="set",
        name="标准商品六图套图",
        slots=[
            _slot(1, "main_image", "商品主图", "清楚展示完整商品和第一视觉印象", "商品居中，主体突出，背景简洁", "默认不生成文字；如用户明确要求，只使用已提供文案"),
            _slot(2, "angle_detail", "角度与细节", "展示关键结构、材质或不同观察角度", "保持完整商品身份，使用近景或辅助角度", "不编造规格、材质或认证"),
            _slot(3, "selling_point", "核心卖点", "用视觉方式表达最重要的真实卖点", "商品与卖点视觉证据同画面呈现", "只能使用用户提供的卖点文案"),
            _slot(4, "usage_scene", "使用场景", "展示目标用户和真实使用环境", "商品保持清晰，场景服务于商品", "无明确要求时不添加文字"),
            _slot(5, "function_customization", "功能或定制", "展示功能、操作、定制或 OEM 能力", "用局部特写或有层次的信息构图", "不得虚构功能、参数和定制范围"),
            _slot(6, "packaging_trust", "包装与品牌信任", "展示包装、配件或品牌采购信任感", "商品、包装或品牌元素整齐陈列", "不得虚构认证、销量、客户或工厂数据"),
        ],
    ),
    "listing_01": TemplateDefinition(
        id="listing_01",
        image_type="listing",
        name="标准详情五图",
        slots=[
            _slot(1, "overview", "产品总览", "说明商品定位与核心价值", "完整商品配合有层次的电商信息布局", "仅使用已确认的标题和卖点"),
            _slot(2, "material_craft", "材质与工艺", "呈现真实材质、结构与工艺细节", "特写与完整商品建立明确对应", "不得猜测材质或工艺参数"),
            _slot(3, "benefit", "功能与利益点", "把真实功能转化为买家可理解的利益", "功能演示和商品主体共同出现", "不得生成未提供的测试数据"),
            _slot(4, "application", "应用场景", "展示适用人群、环境和使用方式", "使用自然场景，商品仍是视觉焦点", "无明确要求时不添加文字"),
            _slot(5, "procurement", "规格与采购", "展示已提供的规格、包装、定制或采购信息", "信息分区清楚，预留可读文案区域", "缺少信息时留白，不得编造"),
        ],
    ),
    "main_01": TemplateDefinition(
        id="main_01",
        image_type="main",
        name="标准商品主图",
        slots=[
            _slot(1, "main_image", "商品主图", "生成清楚、有商业质感的商品主视觉", "主体完整、比例自然、背景干净", "默认不添加文字或虚构品牌元素"),
        ],
    ),
    "poster_01": TemplateDefinition(
        id="poster_01",
        image_type="poster",
        name="标准营销海报",
        slots=[
            _slot(1, "poster", "营销海报", "围绕商品生成有视觉冲击力的营销画面", "商品主体、主题背景与文案安全区层次明确", "只生成用户提供的准确文案；建议后期叠字"),
        ],
    ),
}


def get_template(template_id: str) -> TemplateDefinition:
    """按 ID 读取服务器模板。

    Args:
        template_id: 前端提交的稳定模板编号。

    Returns:
        对应的服务器模板定义。

    Raises:
        UnsupportedTemplateError: 模板不存在时抛出，避免静默改变图片数量。
    """

    try:
        return TEMPLATES[template_id]
    except KeyError as exc:
        raise UnsupportedTemplateError(f"未登记的模板：{template_id}") from exc
