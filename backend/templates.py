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
        name="标准 B2B 详情八图",
        slots=[
            _slot(1, "overview", "产品定位总览", "说明商品定位、核心价值和采购对象", "完整商品配合有层次的 B2B 信息布局", "仅使用已确认的标题和卖点"),
            _slot(2, "product_introduction", "产品介绍", "说明商品是什么、怎样构成以及适合怎样使用", "商品全貌、结构轮廓和使用动作形成直观介绍", "不要求用户补充 SKU、型号或规格数据"),
            _slot(3, "benefit", "核心卖点", "把真实功能转化为买家可理解的采购价值", "卖点证据与商品主体共同出现", "不得生成未提供的测试数据"),
            _slot(4, "structure_usage", "结构与使用", "直观展示结构细节和基本使用方式", "局部结构、握持或操作动作与商品主体对应", "不生成尺寸、容量和测试数值"),
            _slot(5, "material_craft", "材质与工艺", "呈现图片中可识别的材质质感和工艺细节", "材质微距与制作场景建立明确对应", "不得猜测材质等级或工艺参数"),
            _slot(6, "application", "应用场景", "展示适用人群、行业、环境和使用方式", "使用自然场景，商品仍是视觉焦点", "无明确要求时不添加文字"),
            _slot(7, "quality_process", "品质控制", "用通用品控动作建立可信度", "来料、过程或成品检查以真实动作呈现", "不得伪造认证、报告、合格结论或检测数据"),
            _slot(8, "packaging_cooperation", "包装与合作", "展示包装、定制沟通和交付协同的通用过程", "包装样式与合作流程形成收束画面", "不得擅自承诺 MOQ、价格、箱规、账期或交期"),
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
