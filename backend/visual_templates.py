"""批图匠视觉模板注册表。

结构模板决定“生成几张、每张负责什么”，本模块的视觉模板决定
“整套大致长什么样、优先呈现哪些用户事实”。两者分开后，增加新风格
不会复制一整套生成流程。
"""

from __future__ import annotations

from .domain import (
    CustomVisualRoleSelection,
    ImageType,
    VisualTemplateDefinition,
    VisualTemplateField,
)


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
        image_types=["main", "set", "poster"],
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
        image_types=["set"],
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
        image_types=["set"],
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
        image_types=["set"],
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
    "b2b_procurement_listing": VisualTemplateDefinition(
        id="b2b_procurement_listing",
        image_types=["listing"],
        name="采购决策详情",
        category="B2B 采购",
        description="用产品介绍、卖点、结构、场景、品质和合作信息，帮助海外买家低门槛理解商品并判断是否询盘。",
        art_direction=(
            "阿里国际站 B2B 详情页风格，视觉专业、可信、信息层级清楚。八张详情图依次讲清"
            "产品定位、产品介绍、采购价值、结构使用、材质工艺、应用场景、品质控制和包装合作。"
            "优先使用商品图中能够直接识别的信息，不依赖用户补充 SKU、规格、认证、MOQ 或交期。"
        ),
        information_focus=["产品定位", "产品介绍", "采购价值", "结构使用", "材质工艺", "应用场景", "品质控制", "包装合作"],
        role_highlights=[
            "产品与应用总览",
            "产品介绍",
            "核心卖点与采购价值",
            "结构细节与使用说明",
            "材质质感与制作工艺",
            "使用场景与终端适配",
            "品质控制与信任背书",
            "包装定制与合作流程",
        ],
        role_compositions=[
            "用产品主视觉搭配 2–3 个真实应用场景或采购对象，建立用途总览；禁止虚构客户 Logo",
            "用商品全貌、不同角度和简单结构关系说明产品是什么、如何构成和怎样使用；不要求 SKU 或参数",
            "用 3–4 个可验证卖点配合功能证据，说明买家为什么值得采购；不得使用最高级或虚假对比",
            "用局部结构、握持或操作动作说明基本使用方式；不生成尺寸、容量和测试数值",
            "用材质微距、制作动作和成品质感说明工艺；不得猜测材质等级或工艺参数",
            "用 2–3 个真实行业或终端场景说明适用范围，商品必须保持一致且清晰可识别",
            "用来料、过程或成品检查的真实动作建立可信度；不伪造证书、报告、结论和检测数据",
            "展示通用包装样式，并用询盘、设计确认、打样、生产和出运组成合作流程；不承诺数量、价格或时效",
        ],
        generated_anchor_strategy="independent",
        preview_images=[
            "demo/generated/b2b/procurement/01-product-overview.jpg",
            "demo/generated/b2b/procurement/02-product-introduction.jpg",
            "demo/generated/b2b/procurement/03-buyer-value.jpg",
            "demo/generated/b2b/procurement/04-structure-usage.jpg",
            "demo/generated/b2b/procurement/05-material-craft.jpg",
            "demo/generated/b2b/procurement/06-application-scenes.jpg",
            "demo/generated/b2b/procurement/07-quality-process.jpg",
            "demo/generated/b2b/procurement/08-packaging-cooperation.jpg",
        ],
        fields=[
            _field("product_name", "产品名称", "例如：双层防烫陶瓷杯"),
            _field("buyer_application", "采购用途 / 应用场景", "例如：咖啡店、企业礼赠、酒店客房"),
            _field("material_craft", "材质 / 工艺", "例如：高温陶瓷、哑光釉面"),
            _field("customization_options", "定制方向", "例如：颜色、Logo、包装"),
            _field("packaging_shipping", "包装 / 合作", "例如：礼盒、内托、打样沟通"),
            _field("visible_copy", "希望出现的文案", "只填写必须准确出现的标题或短句"),
        ],
    ),
    "b2b_oem_listing": VisualTemplateDefinition(
        id="b2b_oem_listing",
        image_types=["listing"],
        name="OEM/ODM 定制详情",
        category="定制能力",
        description="集中说明材质、颜色、Logo、包装、打样和量产流程，适合承接定制询盘。",
        art_direction=(
            "专业 OEM/ODM 提案页风格，以真实商品为主体，用色板、材质样片、Logo 工艺、包装结构、"
            "样品确认和量产流程建立可定制感。八张图从定制总览一路讲到品质与交付；"
            "不依赖用户提供 MOQ、价格或交期等真实数值。"
        ),
        information_focus=["定制范围", "产品开发", "材质颜色", "结构配件", "Logo 工艺", "包装定制", "打样量产", "品质交付"],
        role_highlights=[
            "定制能力总览",
            "款式与产品开发",
            "材质与颜色方向",
            "结构与配件定制",
            "Logo 与表面工艺",
            "包装与说明书定制",
            "打样确认与量产流程",
            "品质管理与交付协同",
        ],
        role_compositions=[
            "产品居中，四周用少量真实定制维度形成能力总览；禁止用虚假品牌案例做背书",
            "用草图、结构稿、打样件和成品形成产品开发路径；没有研发素材时只展示用户确认的款式选择",
            "使用材质样片、色卡和产品变体的工作台构图，表达方向而不生成色号或等级",
            "并列展示结构、配件或组合方式，不生成尺寸或参数数值",
            "用局部特写展示丝印、贴花、激光或铭牌位置；未提供 Logo 时使用无品牌中性示意",
            "展示彩盒、礼盒、内托、说明书或标签方案；没有包装资料时只展示通用结构，不生成品牌内容",
            "以询盘、设计确认、打样、修改、确认和量产组成连续流程，不添加数量与时效",
            "以原料、过程、成品、包装和出运检查组成品质与交付协同，不伪造报告或承诺",
        ],
        generated_anchor_strategy="independent",
        preview_images=[
            "demo/generated/b2b/oem/01-customization-overview.jpg",
            "demo/generated/b2b/oem/02-product-development.jpg",
            "demo/generated/b2b/oem/03-material-color.jpg",
            "demo/generated/b2b/oem/04-structure-accessories.jpg",
            "demo/generated/b2b/oem/05-logo-surface-craft.jpg",
            "demo/generated/b2b/oem/06-packaging-manual.jpg",
            "demo/generated/b2b/oem/07-sampling-production.jpg",
            "demo/generated/b2b/oem/08-quality-delivery.jpg",
        ],
        fields=[
            _field("product_name", "产品名称", "例如：可定制陶瓷马克杯"),
            _field("oem_scope", "OEM / ODM 范围", "例如：来图定制、结构开发、包装设计"),
            _field("material_options", "材质 / 颜色方向", "例如：哑光、亮面、暖白、深色"),
            _field("logo_packaging", "Logo / 包装工艺", "例如：丝印、贴花、彩盒、礼盒"),
            _field("sample_process", "打样确认流程", "例如：设计稿确认后打样，样品确认后量产"),
            _field("visible_copy", "希望出现的文案", "只填写必须准确出现的标题或短句"),
        ],
    ),
    "b2b_fulfillment_listing": VisualTemplateDefinition(
        id="b2b_fulfillment_listing",
        image_types=["listing"],
        name="工厂履约详情",
        category="履约保障",
        description="展示团队、制造、质检、仓储和交付协同，适合用真实场景建立海外采购信任。",
        art_direction=(
            "可信的外贸工厂能力详情页，以真实工厂、生产设备、质检动作、包装仓储和装运场景为主。"
            "八张图完整说明工厂团队、制造工艺、来料检查、过程品控、成品检验、检测能力、仓储装柜和项目履约。"
            "不使用消费场景冒充生产实力，不生成证书、客户 Logo、产能数字、出口国家或交期承诺。"
        ),
        information_focus=["工厂团队", "制造工艺", "来料检验", "过程品控", "成品检验", "检测能力", "仓储装柜", "履约服务"],
        role_highlights=[
            "工厂与团队总览",
            "产线设备与制造工艺",
            "原材料与来料检验",
            "生产过程质量控制",
            "成品与出货检验",
            "质量体系与检测能力",
            "包装仓储与装柜流程",
            "项目协同与履约服务",
        ],
        role_compositions=[
            "使用真实工厂外景、车间和团队宽幅拼贴建立企业总览，不展示规模数字",
            "用关键设备、工序节点和操作人员建立制造流程，只展示用户提供或图片可见的工艺",
            "展示供应商筛选、来料抽检和入库动作，强调检验工具与记录，不伪造数值",
            "展示首件、巡检、过程记录和异常处理，画面以真实工位和质检动作建立可信度",
            "展示成品抽检、功能测试、包装检查和放行流程；未提供报告时不得生成报告页面",
            "用实验室、检具和检测动作表达质量体系与检测能力，不生成证书、报告或检测结论",
            "用内包装、外箱、托盘、仓储或装柜的连续画面说明包装物流，不虚构箱规和装载量",
            "用项目沟通、订单跟进、出运协同和售后响应组成服务闭环，不写时效与服务承诺",
        ],
        generated_anchor_strategy="independent",
        preview_images=[
            "demo/generated/b2b/fulfillment/01-factory-team.jpg",
            "demo/generated/b2b/fulfillment/02-production-craft.jpg",
            "demo/generated/b2b/fulfillment/03-incoming-inspection.jpg",
            "demo/generated/b2b/fulfillment/04-process-qc.jpg",
            "demo/generated/b2b/fulfillment/05-final-inspection.jpg",
            "demo/generated/b2b/fulfillment/06-testing-capability.jpg",
            "demo/generated/b2b/fulfillment/07-warehouse-loading.jpg",
            "demo/generated/b2b/fulfillment/08-project-fulfillment.jpg",
        ],
        fields=[
            _field("company_name", "公司名称", "例如：Ningbo Example Manufacturing Co., Ltd."),
            _field("qc_process", "质量检验流程", "例如：来料、过程、成品与出货检验"),
            _field("packaging_shipping", "包装 / 装运", "例如：彩盒、外箱、托盘、装柜"),
            _field("lead_time_service", "项目协同 / 服务", "例如：打样沟通、订单跟进、售后响应"),
            _field("visible_copy", "希望出现的文案", "只填写必须准确出现的标题或短句"),
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


def build_custom_visual_template(
    *,
    image_type: ImageType,
    selections: list[CustomVisualRoleSelection],
    expected_count: int,
) -> VisualTemplateDefinition:
    """从服务器登记的同类职责安全组装一套临时自定义模板。

    Args:
        image_type: 当前业务类型，只允许 ``set`` 或 ``listing``。
        selections: 用户按最终生成顺序选择的职责来源。
        expected_count: 当前服务器结构模板要求的固定图片数量。

    Returns:
        可直接交给 Planner 的临时 ``VisualTemplateDefinition``。

    Raises:
        ValueError: 类型不支持、数量不符、来源模板跨类型或职责下标越界时抛出。
    """

    if image_type not in {"set", "listing"}:
        raise ValueError("只有套图和详情图支持自定义模板")
    if len(selections) != expected_count:
        type_name = "套图" if image_type == "set" else "详情图"
        raise ValueError(f"自定义{type_name}必须选择 {expected_count} 个职责")

    role_highlights: list[str] = []
    role_compositions: list[str] = []
    preview_images: list[str] = []
    source_templates: list[VisualTemplateDefinition] = []
    fields_by_key: dict[str, VisualTemplateField] = {}

    for selection in selections:
        source = get_visual_template(selection.template_id)
        if image_type not in source.image_types:
            raise ValueError("自定义模板职责不能跨图片类型混用")
        if selection.role_index >= len(source.role_highlights):
            raise ValueError(f"模板 {source.name} 不存在所选职责")

        role_highlights.append(source.role_highlights[selection.role_index])
        role_compositions.append(
            source.role_compositions[selection.role_index]
            if selection.role_index < len(source.role_compositions)
            else "围绕当前职责生成独立画面，并保持整套商品与视觉风格一致"
        )
        if source.preview_images:
            preview_images.append(
                source.preview_images[selection.role_index % len(source.preview_images)]
            )
        source_templates.append(source)
        for field in source.fields:
            fields_by_key.setdefault(field.key, field)

    type_name = "套图" if image_type == "set" else "详情图"
    return VisualTemplateDefinition(
        id=f"custom_{image_type}",
        image_types=[image_type],
        name=f"自定义{type_name}",
        category="自定义",
        description=f"从现有{type_name}模板职责中自由组合的 {expected_count} 张专属结构。",
        art_direction=(
            f"按用户选择顺序生成 {expected_count} 张{type_name}；每张严格执行对应职责与构图，"
            "整套保持商品身份、配色和品牌气质一致，但不得把不同职责合并成同一张。"
        ),
        information_focus=role_highlights,
        role_highlights=role_highlights,
        role_compositions=role_compositions,
        generated_anchor_strategy=(
            "independent"
            if any(item.generated_anchor_strategy == "independent" for item in source_templates)
            else "reuse"
        ),
        preview_images=preview_images,
        fields=list(fields_by_key.values())[:16],
    )
