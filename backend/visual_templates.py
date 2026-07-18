"""批图匠视觉模板注册表。

结构模板决定“生成几张、每张负责什么”，本模块的视觉模板决定
“整套大致长什么样、优先呈现哪些用户事实”。两者分开后，增加新风格
不会复制一整套生成流程。
"""

from __future__ import annotations

from .domain import VisualTemplateDefinition, VisualTemplateField


def _field(key: str, label: str, placeholder: str) -> VisualTemplateField:
    """创建一个统一为选填的模板信息字段。

    Args:
        key: 后端稳定字段名。
        label: 前端展示名称。
        placeholder: 帮助用户理解可填写内容的示例。

    Returns:
        ``required=False`` 的字段定义。

    Raises:
        Pydantic 校验失败时抛出 ``ValidationError``。
    """

    return VisualTemplateField(
        key=key,
        label=label,
        placeholder=placeholder,
        required=False,
    )


VISUAL_TEMPLATES: dict[str, VisualTemplateDefinition] = {
    "standard_product": VisualTemplateDefinition(
        id="standard_product",
        name="标准商品套图",
        category="商品展示",
        description="主图、卖点、细节和场景均衡，适合大多数商品。",
        art_direction=(
            "现代电商商品摄影，主体清楚、背景克制、层级明确。整套统一配色、"
            "光线和字体留白，信息图与场景图保持同一品牌气质。"
        ),
        information_focus=["商品主体", "核心卖点", "材质细节", "使用场景"],
        role_highlights=["商品主视觉", "核心卖点", "细节特写", "使用场景", "功能展示", "组合总览"],
        preview_images=[
            "demo/generated/mug-front.jpg",
            "demo/generated/mug-handle.jpg",
            "demo/generated/mug-rim.jpg",
            "demo/generated/mug-home.jpg",
            "demo/generated/mug-office.jpg",
            "demo/generated/mug-combo.jpg",
        ],
        fields=[
            _field("product_name", "产品名称", "例如：防烫陶瓷马克杯"),
            _field("core_selling_points", "核心卖点", "例如：防烫手柄、可进洗碗机"),
            _field("target_audience", "目标人群", "例如：办公室白领、礼品采购商"),
            _field("usage_scenarios", "使用场景", "例如：办公室、居家早餐"),
            _field("visible_copy", "希望出现的文案", "只填写必须准确出现的文字"),
        ],
    ),
    "supplier_strength": VisualTemplateDefinition(
        id="supplier_strength",
        name="企业实力套图",
        category="企业实力",
        description="工厂、品控、服务和资质信息丰富，适合 B2B 采购展示。",
        art_direction=(
            "海外 B2B 供应商视觉风格，整套统一商品身份、蓝灰配色和专业可信的品牌气质；"
            "六张必须使用明显不同的版式骨架，每张只选一种主要信息结构。"
            "禁止所有图片重复九宫格、世界地图、同一组图标或同一背景。"
        ),
        information_focus=["工厂规模与历史", "OEM/ODM 能力", "质量控制", "交付与服务", "认证与合作背书"],
        role_highlights=["企业总览", "仓储与交付", "品控流程", "研发与定制", "认证背书", "产能与服务"],
        role_compositions=[
            "使用单张工厂或企业环境大图作主视觉，搭配一个商品焦点和少量能力摘要；禁止九宫格",
            "使用仓库、包装、装车或装柜的横向交付流程，用时间线或三段式组织画面",
            "使用来料检验、过程检验、成品检验的三段质检流程，以检测场景为主；禁止世界地图",
            "使用设计草图、材质色板、3D 打样与实物样品的研发工作台构图；禁止普通办公桌消费场景",
            "仅展示用户明确提供的真实认证；如未提供，使用实验室或质量体系场景，不生成证书、认证 Logo 或虚构文字",
            "使用生产线、关键设备与服务步骤的宽幅组合，展示从生产到交付支持；禁止重复商品矩阵",
        ],
        # 企业总览本身是一张复杂成品图，如果它被当成后续图的视觉基准，
        # 图生图模型会同时复制商品和整张版式。因此纯文生图时让六个职责独立构图。
        generated_anchor_strategy="independent",
        preview_images=[
            "demo/generated/ai-supplier-factory.jpg",
            "demo/generated/ai-supplier-warehouse.jpg",
            "demo/generated/ai-supplier-quality.jpg",
            "demo/generated/ai-supplier-design.jpg",
            "demo/generated/ai-supplier-warehouse.jpg",
            "demo/generated/ai-supplier-factory.jpg",
        ],
        fields=[
            _field("company_name", "公司名称", "例如：Ningbo Example Manufacturing Co., Ltd."),
            _field("established_years", "成立时间 / 经验", "例如：成立于 1995 年，30 年制造经验"),
            _field("oem_odm", "OEM / ODM 能力", "例如：支持来样、包装和结构定制"),
            _field("factory_capacity", "工厂与产能", "例如：厂房面积、月产能、设备数量"),
            _field("certifications", "认证 / 检测", "例如：FSC、BSCI、EN71；只填真实拥有的"),
            _field("service_capabilities", "服务能力", "例如：打样、质检、仓储、交付支持"),
            _field("cooperative_brands", "合作客户 / 市场", "例如：合作品牌或主要出口市场"),
            _field("visible_copy", "希望出现的文案", "只填写必须准确出现的标题或短句"),
        ],
    ),
    "minimal_premium": VisualTemplateDefinition(
        id="minimal_premium",
        name="极简质感套图",
        category="极简质感",
        description="少文字、强材质和留白，适合强调高级感的商品。",
        art_direction=(
            "高端编辑式商品摄影，大面积留白、柔和定向光、精细材质微距和克制色彩。"
            "信息层级少而准，不使用拥挤拼贴。"
        ),
        information_focus=["材质与工艺", "产品轮廓", "品牌语气", "核心价值"],
        role_highlights=["极简主视觉", "材质微距", "轮廓侧影", "高级场景", "单一卖点", "品牌收束"],
        preview_images=[
            "demo/generated/mug-front.jpg",
            "demo/generated/mug-rim.jpg",
            "demo/generated/mug-handle.jpg",
            "demo/generated/mug-office.jpg",
            "demo/generated/mug-home.jpg",
            "demo/generated/mug-combo.jpg",
        ],
        fields=[
            _field("product_name", "产品名称", "例如：骨瓷咖啡杯"),
            _field("material_craft", "材质 / 工艺", "例如：高温骨瓷、釉下彩"),
            _field("brand_tone", "品牌气质", "例如：安静、理性、北欧高级感"),
            _field("core_selling_points", "核心卖点", "建议只填 1–3 个最重要卖点"),
            _field("visible_copy", "希望出现的文案", "例如：Quietly refined"),
        ],
    ),
    "lifestyle_story": VisualTemplateDefinition(
        id="lifestyle_story",
        name="场景故事套图",
        category="商品展示",
        description="用真实使用场景串联整套，突出人群、情绪和生活方式。",
        art_direction=(
            "自然生活方式广告摄影，以同一人物、空间、时段和色调形成连续故事。"
            "商品始终可识别，场景服务于卖点，不喧宾夺主。"
        ),
        information_focus=["目标人群", "使用场景", "情绪氛围", "商品带来的变化"],
        role_highlights=["场景开篇", "人物使用", "关键细节", "功能瞬间", "情绪氛围", "商品收束"],
        preview_images=[
            "demo/generated/mug-home.jpg",
            "demo/generated/mug-office.jpg",
            "demo/generated/mug-front.jpg",
            "demo/generated/mug-combo.jpg",
            "demo/generated/mug-handle.jpg",
            "demo/generated/mug-rim.jpg",
        ],
        fields=[
            _field("target_audience", "目标人群", "例如：城市独居青年"),
            _field("usage_scenarios", "使用场景", "例如：清晨早餐、通勤办公室"),
            _field("emotion_tone", "情绪氛围", "例如：温暖、松弛、有生活气息"),
            _field("core_selling_points", "核心卖点", "需要通过场景体现的卖点"),
            _field("visible_copy", "希望出现的文案", "只填写必须准确出现的文字"),
        ],
    ),
}


def get_visual_template(template_id: str) -> VisualTemplateDefinition:
    """按稳定 ID 返回视觉模板。

    Args:
        template_id: 前端选择的视觉模板 ID。

    Returns:
        对应的不可变业务定义对象。

    Raises:
        ValueError: 模板 ID 未登记时抛出。
    """

    try:
        return VISUAL_TEMPLATES[template_id]
    except KeyError as exc:
        raise ValueError(f"未登记的视觉模板：{template_id}") from exc
