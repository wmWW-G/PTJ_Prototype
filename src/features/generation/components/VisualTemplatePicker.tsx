import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImageIcon,
  Layers3,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { assetPath } from "../../../lib/assetPath";
import type { CustomVisualRoleSelection, ImageType } from "../../tasks/types";
import type { VisualTemplateCapability } from "../liveTypes";
import styles from "./VisualTemplatePicker.module.css";

/** 静态回退模板；后端能力接口暂时不可用时页面仍然完整可操作。 */
export const DEFAULT_VISUAL_TEMPLATES: Record<string, VisualTemplateCapability> = {
  standard_product: {
    id: "standard_product",
    image_types: ["main", "set", "poster"],
    name: "标准商品套图",
    category: "商品展示",
    description: "主图、卖点、细节和场景均衡，适合大多数商品。",
    art_direction: "现代电商商品摄影，主体清楚、背景克制、层级明确。",
    information_focus: ["商品主体", "核心卖点", "材质细节", "使用场景"],
    role_highlights: ["商品主视觉", "核心卖点", "细节特写", "使用场景", "功能展示", "组合总览"],
    preview_images: [
      "demo/generated/mug-front.jpg",
      "demo/generated/mug-handle.jpg",
      "demo/generated/mug-rim.jpg",
      "demo/generated/mug-home.jpg",
      "demo/generated/mug-office.jpg",
      "demo/generated/mug-combo.jpg",
    ],
    fields: [
      { key: "product_name", label: "产品名称", placeholder: "例如：防烫陶瓷马克杯", required: false },
      { key: "core_selling_points", label: "核心卖点", placeholder: "例如：防烫手柄、可进洗碗机", required: false },
      { key: "target_audience", label: "目标人群", placeholder: "例如：办公室白领、礼品采购商", required: false },
      { key: "usage_scenarios", label: "使用场景", placeholder: "例如：办公室、居家早餐", required: false },
      { key: "visible_copy", label: "希望出现的文案", placeholder: "只填写必须准确出现的文字", required: false },
    ],
  },
  supplier_strength: {
    id: "supplier_strength",
    image_types: ["set"],
    name: "企业实力套图",
    category: "企业实力",
    description: "工厂、品控、服务和资质信息丰富，适合 B2B 采购展示。",
    art_direction: "海外 B2B 供应商信息图，用工厂、仓库、质检、团队和产品形成高信息密度拼贴。",
    information_focus: ["工厂规模与历史", "OEM/ODM 能力", "质量控制", "交付与服务", "认证与合作背书"],
    role_highlights: ["企业总览", "仓储与交付", "品控流程", "研发与定制", "认证背书", "产能与服务"],
    preview_images: [
      "demo/generated/ai-supplier-factory.jpg",
      "demo/generated/ai-supplier-warehouse.jpg",
      "demo/generated/ai-supplier-quality.jpg",
      "demo/generated/ai-supplier-design.jpg",
      "demo/generated/ai-supplier-warehouse.jpg",
      "demo/generated/ai-supplier-factory.jpg",
    ],
    fields: [
      { key: "company_name", label: "公司名称", placeholder: "例如：Ningbo Example Manufacturing Co., Ltd.", required: false },
      { key: "established_years", label: "成立时间 / 经验", placeholder: "例如：成立于 1995 年，30 年制造经验", required: false },
      { key: "oem_odm", label: "OEM / ODM 能力", placeholder: "例如：支持来样、包装和结构定制", required: false },
      { key: "factory_capacity", label: "工厂与产能", placeholder: "例如：厂房面积、月产能、设备数量", required: false },
      { key: "certifications", label: "认证 / 检测", placeholder: "例如：FSC、BSCI、EN71；只填真实拥有的", required: false },
      { key: "service_capabilities", label: "服务能力", placeholder: "例如：打样、质检、仓储、交付支持", required: false },
      { key: "cooperative_brands", label: "合作客户 / 市场", placeholder: "例如：合作品牌或主要出口市场", required: false },
      { key: "visible_copy", label: "希望出现的文案", placeholder: "只填写必须准确出现的标题或短句", required: false },
    ],
  },
  minimal_premium: {
    id: "minimal_premium",
    image_types: ["set"],
    name: "极简质感套图",
    category: "极简质感",
    description: "少文字、强材质和留白，适合强调高级感的商品。",
    art_direction: "高端编辑式商品摄影，大面积留白、柔和定向光和克制色彩。",
    information_focus: ["材质与工艺", "产品轮廓", "品牌语气", "核心价值"],
    role_highlights: ["极简主视觉", "材质微距", "轮廓侧影", "高级场景", "单一卖点", "品牌收束"],
    preview_images: [
      "demo/generated/mug-front.jpg",
      "demo/generated/mug-rim.jpg",
      "demo/generated/mug-handle.jpg",
      "demo/generated/mug-office.jpg",
      "demo/generated/mug-home.jpg",
      "demo/generated/mug-combo.jpg",
    ],
    fields: [
      { key: "product_name", label: "产品名称", placeholder: "例如：骨瓷咖啡杯", required: false },
      { key: "material_craft", label: "材质 / 工艺", placeholder: "例如：高温骨瓷、釉下彩", required: false },
      { key: "brand_tone", label: "品牌气质", placeholder: "例如：安静、理性、北欧高级感", required: false },
      { key: "core_selling_points", label: "核心卖点", placeholder: "建议只填 1–3 个最重要卖点", required: false },
      { key: "visible_copy", label: "希望出现的文案", placeholder: "例如：Quietly refined", required: false },
    ],
  },
  lifestyle_story: {
    id: "lifestyle_story",
    image_types: ["set"],
    name: "场景故事套图",
    category: "商品展示",
    description: "用真实使用场景串联整套，突出人群、情绪和生活方式。",
    art_direction: "自然生活方式广告摄影，以同一人物、空间和色调形成连续故事。",
    information_focus: ["目标人群", "使用场景", "情绪氛围", "商品带来的变化"],
    role_highlights: ["场景开篇", "人物使用", "关键细节", "功能瞬间", "情绪氛围", "商品收束"],
    preview_images: [
      "demo/generated/mug-home.jpg",
      "demo/generated/mug-office.jpg",
      "demo/generated/mug-front.jpg",
      "demo/generated/mug-combo.jpg",
      "demo/generated/mug-handle.jpg",
      "demo/generated/mug-rim.jpg",
    ],
    fields: [
      { key: "target_audience", label: "目标人群", placeholder: "例如：城市独居青年", required: false },
      { key: "usage_scenarios", label: "使用场景", placeholder: "例如：清晨早餐、通勤办公室", required: false },
      { key: "emotion_tone", label: "情绪氛围", placeholder: "例如：温暖、松弛、有生活气息", required: false },
      { key: "core_selling_points", label: "核心卖点", placeholder: "需要通过场景体现的卖点", required: false },
      { key: "visible_copy", label: "希望出现的文案", placeholder: "只填写必须准确出现的文字", required: false },
    ],
  },
  b2b_procurement_listing: {
    id: "b2b_procurement_listing",
    image_types: ["listing"],
    name: "采购决策详情",
    category: "B2B 采购",
    description: "用产品介绍、卖点、结构、场景、品质和合作信息，帮助海外买家低门槛理解商品并判断是否询盘。",
    art_direction: "阿里国际站 B2B 详情页风格，八张依次讲清产品定位、产品介绍、采购价值、结构使用、材质工艺、应用场景、品质控制和包装合作。",
    information_focus: ["产品定位", "产品介绍", "采购价值", "结构使用", "材质工艺", "应用场景", "品质控制", "包装合作"],
    role_highlights: [
      "产品与应用总览",
      "产品介绍",
      "核心卖点与采购价值",
      "结构细节与使用说明",
      "材质质感与制作工艺",
      "使用场景与终端适配",
      "品质控制与信任背书",
      "包装定制与合作流程",
    ],
    role_compositions: [
      "用产品主视觉搭配真实应用场景或采购对象，建立用途总览。",
      "用商品全貌、不同角度和简单结构关系说明产品是什么、如何构成和怎样使用。",
      "用可验证卖点配合功能证据，说明买家为什么值得采购。",
      "用局部结构、握持或操作动作说明基本使用方式，不生成参数。",
      "用材质微距、制作动作和成品质感说明工艺。",
      "用真实行业或终端场景说明适用范围并保持商品一致。",
      "用来料、过程或成品检查的真实动作建立可信度，不生成证书和数据。",
      "展示通用包装样式，并用询盘、打样、生产和出运组成合作流程。",
    ],
    preview_images: [
      "demo/generated/b2b/procurement/01-product-overview.jpg",
      "demo/generated/b2b/procurement/02-product-introduction.jpg",
      "demo/generated/b2b/procurement/03-buyer-value.jpg",
      "demo/generated/b2b/procurement/04-structure-usage.jpg",
      "demo/generated/b2b/procurement/05-material-craft.jpg",
      "demo/generated/b2b/procurement/06-application-scenes.jpg",
      "demo/generated/b2b/procurement/07-quality-process.jpg",
      "demo/generated/b2b/procurement/08-packaging-cooperation.jpg",
    ],
    fields: [
      { key: "product_name", label: "产品名称", placeholder: "例如：双层防烫陶瓷杯", required: false },
      { key: "buyer_application", label: "采购用途 / 应用场景", placeholder: "例如：咖啡店、企业礼赠、酒店客房", required: false },
      { key: "material_craft", label: "材质 / 工艺", placeholder: "例如：高温陶瓷、哑光釉面", required: false },
      { key: "customization_options", label: "定制方向", placeholder: "例如：颜色、Logo、包装", required: false },
      { key: "packaging_shipping", label: "包装 / 合作", placeholder: "例如：礼盒、内托、打样沟通", required: false },
      { key: "visible_copy", label: "希望出现的文案", placeholder: "只填写必须准确出现的标题或短句", required: false },
    ],
  },
  b2b_oem_listing: {
    id: "b2b_oem_listing",
    image_types: ["listing"],
    name: "OEM/ODM 定制详情",
    category: "定制能力",
    description: "集中说明材质、颜色、Logo、包装、打样和量产流程，适合承接定制询盘。",
    art_direction: "专业 OEM/ODM 提案页风格，八张从定制总览、产品开发、材质颜色、Logo 包装一路讲到品质与交付。",
    information_focus: ["定制范围", "产品开发", "材质颜色", "结构配件", "Logo 工艺", "包装定制", "打样量产", "品质交付"],
    role_highlights: [
      "定制能力总览",
      "款式与产品开发",
      "材质与颜色方向",
      "结构与配件定制",
      "Logo 与表面工艺",
      "包装与说明书定制",
      "打样确认与量产流程",
      "品质管理与交付协同",
    ],
    role_compositions: [
      "产品居中，四周用真实定制维度形成能力总览。",
      "用草图、结构稿、打样件和成品形成产品开发路径。",
      "使用材质样片、色卡和产品变体的工作台构图，不生成色号或等级。",
      "并列展示结构、配件或组合方式，不生成尺寸参数。",
      "用局部特写展示丝印、贴花、激光或铭牌位置。",
      "展示彩盒、礼盒、内托、说明书或标签方案。",
      "以询盘、设计确认、打样、修改、确认和量产组成连续流程。",
      "以原料、过程、成品、包装和出运检查组成品质与交付协同。",
    ],
    preview_images: [
      "demo/generated/b2b/oem/01-customization-overview.jpg",
      "demo/generated/b2b/oem/02-product-development.jpg",
      "demo/generated/b2b/oem/03-material-color.jpg",
      "demo/generated/b2b/oem/04-structure-accessories.jpg",
      "demo/generated/b2b/oem/05-logo-surface-craft.jpg",
      "demo/generated/b2b/oem/06-packaging-manual.jpg",
      "demo/generated/b2b/oem/07-sampling-production.jpg",
      "demo/generated/b2b/oem/08-quality-delivery.jpg",
    ],
    fields: [
      { key: "product_name", label: "产品名称", placeholder: "例如：可定制陶瓷马克杯", required: false },
      { key: "oem_scope", label: "OEM / ODM 范围", placeholder: "例如：来图定制、结构开发、包装设计", required: false },
      { key: "material_options", label: "材质 / 颜色方向", placeholder: "例如：哑光、亮面、暖白、深色", required: false },
      { key: "logo_packaging", label: "Logo / 包装工艺", placeholder: "例如：丝印、贴花、彩盒、礼盒", required: false },
      { key: "sample_process", label: "打样确认流程", placeholder: "例如：设计稿确认后打样，样品确认后量产", required: false },
      { key: "visible_copy", label: "希望出现的文案", placeholder: "只填写必须准确出现的标题或短句", required: false },
    ],
  },
  b2b_fulfillment_listing: {
    id: "b2b_fulfillment_listing",
    image_types: ["listing"],
    name: "工厂履约详情",
    category: "履约保障",
    description: "展示团队、制造、质检、仓储和交付协同，适合用真实场景建立海外采购信任。",
    art_direction: "可信的外贸工厂能力详情页，八张完整说明工厂团队、制造工艺、来料检查、过程品控、成品检验、检测能力、仓储装柜和项目履约。",
    information_focus: ["工厂团队", "制造工艺", "来料检验", "过程品控", "成品检验", "检测能力", "仓储装柜", "履约服务"],
    role_highlights: [
      "工厂与团队总览",
      "产线设备与制造工艺",
      "原材料与来料检验",
      "生产过程质量控制",
      "成品与出货检验",
      "质量体系与检测能力",
      "包装仓储与装柜流程",
      "项目协同与履约服务",
    ],
    role_compositions: [
      "使用真实工厂外景、车间和团队宽幅拼贴建立企业总览，不展示规模数字。",
      "用关键设备、工序节点和操作人员建立制造流程。",
      "展示供应商筛选、来料抽检和入库动作。",
      "展示首件、巡检、过程记录和异常处理。",
      "展示成品抽检、功能测试、包装检查和放行流程。",
      "用实验室、检具和检测动作表达质量体系与检测能力。",
      "用内包装、外箱、托盘、仓储和装柜说明包装物流。",
      "用项目沟通、订单跟进、出运协同和售后响应组成服务闭环。",
    ],
    preview_images: [
      "demo/generated/b2b/fulfillment/01-factory-team.jpg",
      "demo/generated/b2b/fulfillment/02-production-craft.jpg",
      "demo/generated/b2b/fulfillment/03-incoming-inspection.jpg",
      "demo/generated/b2b/fulfillment/04-process-qc.jpg",
      "demo/generated/b2b/fulfillment/05-final-inspection.jpg",
      "demo/generated/b2b/fulfillment/06-testing-capability.jpg",
      "demo/generated/b2b/fulfillment/07-warehouse-loading.jpg",
      "demo/generated/b2b/fulfillment/08-project-fulfillment.jpg",
    ],
    fields: [
      { key: "company_name", label: "公司名称", placeholder: "例如：Ningbo Example Manufacturing Co., Ltd.", required: false },
      { key: "qc_process", label: "质量检验流程", placeholder: "例如：来料、过程、成品与出货检验", required: false },
      { key: "packaging_shipping", label: "包装 / 装运", placeholder: "例如：彩盒、外箱、托盘、装柜", required: false },
      { key: "lead_time_service", label: "项目协同 / 服务", placeholder: "例如：打样沟通、订单跟进、售后响应", required: false },
      { key: "visible_copy", label: "希望出现的文案", placeholder: "只填写必须准确出现的标题或短句", required: false },
    ],
  },
};

/** 模板职责库中的一条可选项。 */
interface CustomRolePoolItem extends CustomVisualRoleSelection {
  templateName: string;
  role: string;
  composition: string;
  previewImage: string;
}

/** 把职责来源转换成稳定键，供查找、去重与 React key 共用。 */
function customRoleKey(role: CustomVisualRoleSelection): string {
  return `${role.template_id}:${role.role_index}`;
}

/**
 * 根据当前图片类型的所有预设模板生成可选职责池。
 *
 * @param templates 已按图片类型过滤的预设模板。
 * @returns 保留来源模板、标题、构图和真实预览图的职责列表。
 */
function buildCustomRolePool(
  templates: VisualTemplateCapability[],
): CustomRolePoolItem[] {
  return templates.flatMap((template) => template.role_highlights.map((role, roleIndex) => ({
    template_id: template.id,
    role_index: roleIndex,
    templateName: template.name,
    role,
    composition: template.role_compositions?.[roleIndex]
      ?? "围绕这一主题生成独立画面，并保持整套商品与视觉风格一致。",
    // 正常模板都会带对应预览图；这里仍保留空数组防护，避免第三方能力数据
    // 不完整时出现除以 0 导致的非法数组下标。
    previewImage: template.preview_images.length > 0
      ? template.preview_images[roleIndex % template.preview_images.length]
      : "",
  })));
}

/**
 * 为前端摘要和选填信息区组装自定义模板快照。
 *
 * 后端仍会根据同一组来源重新构建并校验，前端快照只负责即时预览，不能改变
 * 服务器登记的职责标题或构图内容。
 */
function buildCustomTemplateCapability(
  imageType: Extract<ImageType, "set" | "listing">,
  templates: VisualTemplateCapability[],
  selections: CustomVisualRoleSelection[],
): VisualTemplateCapability {
  const rolePool = buildCustomRolePool(templates);
  const roleByKey = new Map(rolePool.map((role) => [customRoleKey(role), role]));
  const selectedRoles = selections
    .map((selection) => roleByKey.get(customRoleKey(selection)))
    .filter((role): role is CustomRolePoolItem => Boolean(role));
  const sourceIds = new Set(selectedRoles.map((role) => role.template_id));
  const fields = templates
    .filter((template) => sourceIds.has(template.id))
    .flatMap((template) => template.fields)
    .filter((field, index, items) => items.findIndex((item) => item.key === field.key) === index)
    .slice(0, 16);
  const typeName = imageType === "set" ? "套图" : "详情图";

  return {
    id: `custom_${imageType}`,
    image_types: [imageType],
    name: `自定义${typeName}`,
    category: "自定义",
    description: `从现有${typeName}模板职责中自由组合，并按已选顺序生成。`,
    art_direction: "每张严格执行所选职责和构图，整套保持商品身份、配色与品牌气质一致。",
    information_focus: selectedRoles.map((role) => role.role),
    role_highlights: selectedRoles.map((role) => role.role),
    role_compositions: selectedRoles.map((role) => role.composition),
    preview_images: selectedRoles.map((role) => role.previewImage).filter(Boolean),
    fields,
  };
}

interface VisualTemplatePickerProps {
  imageType: ImageType;
  value: string;
  customRoles: CustomVisualRoleSelection[];
  supplementalInfo: Record<string, string>;
  templates: Record<string, VisualTemplateCapability>;
  onChange: (templateId: string) => void;
  onCustomRolesChange: (value: CustomVisualRoleSelection[]) => void;
  onInfoChange: (value: Record<string, string>) => void;
}

/**
 * 展示当前视觉模板，并通过右侧抽屉让用户预览和切换整套风格。
 *
 * @param props.value 已提交使用的模板 ID。
 * @param props.supplementalInfo 用户填写的可选模板信息。
 * @param props.templates 后端或静态回退提供的模板表。
 * @param props.onChange 用户确认新模板时触发。
 * @param props.onInfoChange 任一选填字段变化时触发。
 * @returns 紧凑模板摘要、选填信息面板和选择抽屉。
 */
export function VisualTemplatePicker({
  imageType,
  value,
  customRoles,
  supplementalInfo,
  templates,
  onChange,
  onCustomRolesChange,
  onInfoChange,
}: VisualTemplatePickerProps) {
  const templateList = useMemo(
    () => Object.values(templates).filter((template) => (
      // 兼容旧版本能力接口：未声明适用范围的历史模板原本全部属于套图。
      template.image_types?.includes(imageType) ?? imageType === "set"
    )),
    [imageType, templates],
  );
  const templatedImageType = imageType as Extract<ImageType, "set" | "listing">;
  const customTemplateId = `custom_${templatedImageType}`;
  const requiredRoleCount = templateList[0]?.role_highlights.length
    ?? (imageType === "listing" ? 8 : 6);
  const rolePool = useMemo(() => buildCustomRolePool(templateList), [templateList]);
  const customTemplate = useMemo(
    () => buildCustomTemplateCapability(templatedImageType, templateList, customRoles),
    [customRoles, templateList, templatedImageType],
  );
  const selected = value === customTemplateId
    ? customTemplate
    : templateList.find((template) => template.id === value)
      ?? templateList[0]
      ?? DEFAULT_VISUAL_TEMPLATES.standard_product;
  const [isOpen, setIsOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(selected.id);
  const [category, setCategory] = useState("推荐");
  const [detailTemplateId, setDetailTemplateId] = useState<string | null>(null);
  const [previewRoleIndex, setPreviewRoleIndex] = useState<number | null>(null);
  const [isCustomBuilderOpen, setIsCustomBuilderOpen] = useState(false);
  const [draftCustomRoles, setDraftCustomRoles] = useState<CustomVisualRoleSelection[]>([]);
  const categories = ["推荐", "自定义", ...new Set(templateList.map((item) => item.category))];
  const visibleTemplates = category === "推荐"
    ? templateList
    : category === "自定义"
      ? []
    : templateList.filter((item) => item.category === category);
  const showCustomCard = category === "推荐" || category === "自定义";
  const filledCount = selected.fields.filter((field) => supplementalInfo[field.key]?.trim()).length;
  const detailTemplate = detailTemplateId
    ? templateList.find((template) => template.id === detailTemplateId) ?? null
    : null;
  const rolePoolByKey = new Map(rolePool.map((role) => [customRoleKey(role), role]));
  const draftCustomRoleItems = draftCustomRoles
    .map((role) => rolePoolByKey.get(customRoleKey(role)))
    .filter((role): role is CustomRolePoolItem => Boolean(role));
  const customCardImages = customTemplate.preview_images.length > 0
    ? customTemplate.preview_images.slice(0, 4)
    : rolePool.slice(0, 4).map((role) => role.previewImage).filter(Boolean);

  /** 打开抽屉时以当前模板为草稿，取消操作不会污染正式选择。 */
  function openDrawer() {
    setDraftValue(selected.id);
    setCategory("推荐");
    setDetailTemplateId(null);
    setPreviewRoleIndex(null);
    setIsCustomBuilderOpen(false);
    setIsOpen(true);
  }

  /** 关闭抽屉并清除详情层，确保下次打开仍从模板列表开始。 */
  function closeDrawer() {
    setDetailTemplateId(null);
    setPreviewRoleIndex(null);
    setIsCustomBuilderOpen(false);
    setIsOpen(false);
  }

  /** 确认草稿模板，同时保留名称相同的已填信息，减少重复输入。 */
  function confirmTemplate() {
    onChange(draftValue);
    closeDrawer();
  }

  /** 从详情页直接确认当前模板，省去返回列表后再次确认的步骤。 */
  function confirmDetailTemplate() {
    if (!detailTemplate) return;
    onChange(detailTemplate.id);
    closeDrawer();
  }

  /** 打开自定义组合器；首次使用时以当前预设为起点，减少从空白开始的成本。 */
  function openCustomBuilder() {
    const startingRoles = value === customTemplateId && customRoles.length > 0
      ? customRoles
      : selected.role_highlights.map((_, roleIndex) => ({
        template_id: selected.id,
        role_index: roleIndex,
      }));
    setDraftCustomRoles(startingRoles.slice(0, requiredRoleCount));
    setDetailTemplateId(null);
    setPreviewRoleIndex(null);
    setIsCustomBuilderOpen(true);
  }

  /** 点击职责卡时加入或移除；达到固定张数后必须先移除一项才能继续添加。 */
  function toggleCustomRole(role: CustomVisualRoleSelection) {
    const key = customRoleKey(role);
    setDraftCustomRoles((current) => {
      const existingIndex = current.findIndex((item) => customRoleKey(item) === key);
      if (existingIndex >= 0) return current.filter((_, index) => index !== existingIndex);
      if (current.length >= requiredRoleCount) return current;
      return [...current, { ...role }];
    });
  }

  /** 调整已选职责顺序；最终顺序会直接对应第 1–6 / 1–8 张图片。 */
  function moveCustomRole(index: number, direction: -1 | 1) {
    setDraftCustomRoles((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  /** 只有选满当前类型要求的固定张数后，才提交自定义模板与职责顺序。 */
  function confirmCustomTemplate() {
    if (draftCustomRoles.length !== requiredRoleCount) return;
    onCustomRolesChange(draftCustomRoles.map((role) => ({ ...role })));
    onChange(customTemplateId);
    closeDrawer();
  }

  /**
   * 更新一条选填信息。
   *
   * @param key 稳定字段名。
   * @param nextValue 用户最新输入。
   */
  function updateInfo(key: string, nextValue: string) {
    onInfoChange({ ...supplementalInfo, [key]: nextValue });
  }

  return (
    <section className={styles.templateSection} aria-label="生图模板">
      <div className={styles.sectionHeading}>
        <div>
          <span>生图模板</span>
          <small>预览整套图片的信息结构与视觉方向</small>
        </div>
        <button type="button" onClick={openDrawer}>更换模板</button>
      </div>

      <div className={styles.selectedTemplate}>
        <div className={styles.previewStrip} aria-hidden="true">
          {selected.preview_images.slice(0, 4).map((image) => (
            <img key={image} src={assetPath(image)} alt="" />
          ))}
        </div>
        <div className={styles.selectedCopy}>
          <div><strong>{selected.name}</strong><b>{selected.role_highlights.length} 张 / 版</b></div>
          <span>{selected.description}</span>
        </div>
      </div>

      <details className={styles.infoPanel}>
        <summary>
          <span>补充模板信息（选填）<small> · 已填写 {filledCount}/{selected.fields.length}</small></span>
          <ChevronDown size={16} />
        </summary>
        <p>不填写也可以生成；系统会根据商品图片和补充要求自动规划。</p>
        <div className={styles.infoGrid}>
          {selected.fields.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <input
                aria-label={field.label}
                value={supplementalInfo[field.key] ?? ""}
                placeholder={field.placeholder}
                required={field.required}
                maxLength={500}
                onChange={(event) => updateInfo(field.key, event.target.value)}
              />
            </label>
          ))}
        </div>
      </details>

      {isOpen && createPortal((
        <div className={styles.drawerLayer}>
          <button className={styles.backdrop} type="button" aria-label="关闭模板选择" onClick={closeDrawer} />
          <aside
            className={`${styles.drawer} ${detailTemplate || isCustomBuilderOpen ? styles.detailDrawer : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="选择生图模板"
          >
            <header>
              {isCustomBuilderOpen ? (
                <div className={styles.detailHeader}>
                  <button
                    type="button"
                    aria-label="返回模板列表"
                    onClick={() => setIsCustomBuilderOpen(false)}
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h2>自定义{imageType === "set" ? "套图" : "详情图"}</h2>
                    <span>从当前类型的现有职责中自由组合，并确定最终生成顺序。</span>
                  </div>
                </div>
              ) : detailTemplate ? (
                  <div className={styles.detailHeader}>
                  <button
                    type="button"
                    aria-label="返回模板列表"
                    onClick={() => {
                      setDetailTemplateId(null);
                      setPreviewRoleIndex(null);
                    }}
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h2>{detailTemplate.name.endsWith("详情")
                      ? detailTemplate.name
                      : `${detailTemplate.name}详情`}</h2>
                    <span>查看这套模板的完整画面结构和可补充信息。</span>
                  </div>
                </div>
              ) : (
                <div>
                  <strong>选择生图模板</strong>
                  <span>先看整套会怎么组织，再决定需要补充什么信息。</span>
                </div>
              )}
              <button type="button" aria-label="关闭" onClick={closeDrawer}><X size={19} /></button>
            </header>

            {isCustomBuilderOpen ? (
              <>
                <div className={styles.customBuilder}>
                  <section className={styles.customSelectionSummary}>
                    <div>
                      <span><Layers3 size={16} />已选职责</span>
                      <b className={draftCustomRoles.length === requiredRoleCount ? styles.selectionComplete : ""}>
                        {draftCustomRoles.length}/{requiredRoleCount}
                      </b>
                    </div>
                    <p>点击下方职责加入组合；这里的顺序就是最终第 1–{requiredRoleCount} 张图片的顺序。</p>
                    <div className={styles.selectionProgress} aria-hidden="true">
                      <i style={{ width: `${(draftCustomRoles.length / requiredRoleCount) * 100}%` }} />
                    </div>
                  </section>

                  <section className={styles.selectedRoleSequence} aria-label="已选职责顺序">
                    {draftCustomRoleItems.map((role, index) => (
                      <article key={customRoleKey(role)}>
                        <img src={assetPath(role.previewImage)} alt="" />
                        <b>{String(index + 1).padStart(2, "0")}</b>
                        <div>
                          <strong>{role.role}</strong>
                          <span>来自 {role.templateName}</span>
                        </div>
                        <div className={styles.sequenceActions}>
                          <button
                            type="button"
                            aria-label={`上移${role.role}`}
                            disabled={index === 0}
                            onClick={() => moveCustomRole(index, -1)}
                          ><ArrowUp size={14} /></button>
                          <button
                            type="button"
                            aria-label={`下移${role.role}`}
                            disabled={index === draftCustomRoleItems.length - 1}
                            onClick={() => moveCustomRole(index, 1)}
                          ><ArrowDown size={14} /></button>
                          <button
                            type="button"
                            aria-label={`移除${role.role}`}
                            onClick={() => toggleCustomRole(role)}
                          ><Trash2 size={14} /></button>
                        </div>
                      </article>
                    ))}
                    {draftCustomRoleItems.length === 0 && (
                      <div className={styles.emptySelection}>
                        <Layers3 size={20} />
                        <span>还没有选择职责</span>
                      </div>
                    )}
                  </section>

                  <section className={styles.customRoleLibrary}>
                    <div className={styles.libraryHeading}>
                      <div>
                        <h3>现有{imageType === "set" ? "套图" : "详情图"}职责库</h3>
                        <p>只能选择当前类型；选满后可移除或调整顺序。</p>
                      </div>
                      <b>{rolePool.length} 个可选职责</b>
                    </div>
                    {templateList.map((template) => (
                      <section key={template.id} className={styles.roleSourceGroup}>
                        <h4>{template.name}</h4>
                        <div className={styles.roleChoiceGrid}>
                          {template.role_highlights.map((role, roleIndex) => {
                            const selection = { template_id: template.id, role_index: roleIndex };
                            const selectedIndex = draftCustomRoles.findIndex(
                              (item) => customRoleKey(item) === customRoleKey(selection),
                            );
                            const active = selectedIndex >= 0;
                            const atLimit = !active && draftCustomRoles.length >= requiredRoleCount;
                            const previewImage = template.preview_images.length > 0
                              ? template.preview_images[roleIndex % template.preview_images.length]
                              : "";
                            return (
                              <button
                                key={`${template.id}:${roleIndex}`}
                                type="button"
                                aria-label={`${active ? "移除" : "选择"}职责：${role}，来自${template.name}`}
                                aria-pressed={active}
                                className={active ? styles.activeRoleChoice : ""}
                                disabled={atLimit}
                                onClick={() => toggleCustomRole(selection)}
                              >
                                {previewImage ? <img src={assetPath(previewImage)} alt="" /> : <ImageIcon size={20} />}
                                <span>
                                  <strong>{role}</strong>
                                  <small>{template.role_compositions?.[roleIndex] ?? "独立生成这一职责画面。"}</small>
                                </span>
                                <b>{active ? String(selectedIndex + 1).padStart(2, "0") : <Plus size={14} />}</b>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </section>
                </div>
                <footer>
                  <button
                    type="button"
                    disabled={draftCustomRoles.length !== requiredRoleCount}
                    onClick={confirmCustomTemplate}
                  >
                    {draftCustomRoles.length === requiredRoleCount
                      ? `使用自定义${imageType === "set" ? "套图" : "详情图"}`
                      : `还需选择 ${requiredRoleCount - draftCustomRoles.length} 项`}
                  </button>
                </footer>
              </>
            ) : detailTemplate ? (
              <>
                <div className={styles.detailView}>
                  <div className={styles.detailIntro}>
                    <div>
                      <span>{detailTemplate.category}</span>
                      <b>共 {detailTemplate.role_highlights.length} 张详情图</b>
                    </div>
                    <p>{detailTemplate.description}</p>
                    <small>{detailTemplate.art_direction}</small>
                  </div>

                  <section className={styles.detailSection}>
                    <h3>逐张查看画面与信息结构</h3>
                    <p>每张图负责一个采购决策模块，点击图片可放大查看。</p>
                    <ol className={styles.rolePreviewGrid}>
                      {detailTemplate.role_highlights.map((role, index) => (
                        <li key={role}>
                          <button type="button" onClick={() => setPreviewRoleIndex(index)}>
                            <div className={styles.rolePreviewImage}>
                              <img
                                src={assetPath(detailTemplate.preview_images[index % detailTemplate.preview_images.length])}
                                alt={`${detailTemplate.name}第 ${index + 1} 张：${role}`}
                              />
                              <b>{String(index + 1).padStart(2, "0")}</b>
                              <span><Eye size={13} />查看大图</span>
                            </div>
                            <strong>{role}</strong>
                            <p>{detailTemplate.role_compositions?.[index] ?? "围绕这一主题生成独立详情画面，并保持整套商品与视觉风格一致。"}</p>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <section className={styles.detailSection}>
                    <h3>重点表达信息</h3>
                    <div className={styles.detailFocus}>
                      {detailTemplate.information_focus.map((focus) => <span key={focus}>{focus}</span>)}
                    </div>
                  </section>

                  <section className={styles.detailSection}>
                    <h3>可补充信息（均选填）</h3>
                    <p>不填写也能生成；填写得越具体，整套内容会越贴近你的真实业务。</p>
                    <div className={styles.detailFields}>
                      {detailTemplate.fields.map((field) => (
                        <div key={field.key}><strong>{field.label}</strong><span>{field.placeholder}</span></div>
                      ))}
                    </div>
                  </section>
                </div>

                <footer>
                  <button type="button" onClick={confirmDetailTemplate}>选择并使用此模板</button>
                </footer>
              </>
            ) : (
              <>
                <div className={styles.categoryTabs} aria-label="模板分类">
                  {categories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={category === item ? styles.activeCategory : ""}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className={styles.templateGrid}>
                  {visibleTemplates.map((item) => {
                    const active = draftValue === item.id;
                    return (
                      <article key={item.id} className={`${styles.templateCard} ${active ? styles.activeCard : ""}`}>
                        <button
                          type="button"
                          className={styles.cardSelect}
                          aria-label={`选择${item.name}`}
                          aria-pressed={active}
                          onClick={() => setDraftValue(item.id)}
                        >
                          <div className={styles.cardPreview}>
                            {item.preview_images.slice(0, 4).map((image) => (
                              <img key={image} src={assetPath(image)} alt="" />
                            ))}
                            {active && <i><Check size={14} /></i>}
                          </div>
                          <strong>{item.name}</strong>
                          <span>{item.description}</span>
                          {active && (
                            <ul>
                              {item.information_focus.map((focus) => <li key={focus}>{focus}</li>)}
                            </ul>
                          )}
                          <b className={styles.cardCount}>{item.role_highlights.length} 张 / 版</b>
                        </button>
                        <button
                          type="button"
                          className={styles.detailButton}
                          aria-label={item.name.endsWith("详情")
                            ? `查看${item.name}`
                            : `查看${item.name}详情`}
                          onClick={() => {
                            setDetailTemplateId(item.id);
                            setPreviewRoleIndex(null);
                          }}
                        >
                          <Eye size={14} />查看详情
                        </button>
                      </article>
                    );
                  })}
                  {showCustomCard && (
                    <article className={`${styles.templateCard} ${styles.customTemplateCard}`}>
                      <button
                        type="button"
                        className={styles.cardSelect}
                        aria-label={`配置自定义${imageType === "set" ? "套图" : "详情图"}`}
                        onClick={openCustomBuilder}
                      >
                        <div className={styles.cardPreview}>
                          {customCardImages.map((image, index) => (
                            <img key={`${image}-${index}`} src={assetPath(image)} alt="" />
                          ))}
                          <i className={styles.customCardIcon}><Layers3 size={14} /></i>
                        </div>
                        <strong>自定义{imageType === "set" ? "套图" : "详情图"}</strong>
                        <span>从所有现有{imageType === "set" ? "套图" : "详情图"}职责中自由选择并调整顺序。</span>
                        <b className={styles.cardCount}>{requiredRoleCount} 张 / 版</b>
                      </button>
                      <button
                        type="button"
                        className={styles.detailButton}
                        onClick={openCustomBuilder}
                      >
                        <Layers3 size={14} />{customRoles.length === requiredRoleCount ? "继续编辑" : "开始组合"}
                      </button>
                    </article>
                  )}
                  {visibleTemplates.length === 0 && !showCustomCard && (
                    <div className={styles.emptyCategory}><ImageIcon size={22} /><span>该分类暂无模板</span></div>
                  )}
                </div>

                <footer>
                  <button type="button" onClick={confirmTemplate}>使用此模板</button>
                </footer>
              </>
            )}

            {detailTemplate && previewRoleIndex !== null && (
              <div className={styles.imageLightbox} role="dialog" aria-modal="true" aria-label="详情图大图预览">
                <button type="button" className={styles.lightboxBackdrop} aria-label="点击遮罩关闭大图预览" onClick={() => setPreviewRoleIndex(null)} />
                <section className={styles.lightboxPanel}>
                  <header>
                    <div>
                      <b>{String(previewRoleIndex + 1).padStart(2, "0")} / {detailTemplate.role_highlights.length}</b>
                      <h3>{detailTemplate.role_highlights[previewRoleIndex]}</h3>
                    </div>
                    <button type="button" aria-label="关闭大图预览" onClick={() => setPreviewRoleIndex(null)}><X size={19} /></button>
                  </header>
                  <img
                    src={assetPath(detailTemplate.preview_images[previewRoleIndex % detailTemplate.preview_images.length])}
                    alt={`${detailTemplate.name}第 ${previewRoleIndex + 1} 张大图`}
                  />
                  <p>{detailTemplate.role_compositions?.[previewRoleIndex] ?? "围绕这一主题生成独立详情画面，并保持整套商品与视觉风格一致。"}</p>
                  <footer>
                    <button
                      type="button"
                      aria-label="查看上一张"
                      disabled={previewRoleIndex === 0}
                      onClick={() => setPreviewRoleIndex((current) => current === null ? null : Math.max(0, current - 1))}
                    ><ChevronLeft size={18} />上一张</button>
                    <button
                      type="button"
                      aria-label="查看下一张"
                      disabled={previewRoleIndex === detailTemplate.role_highlights.length - 1}
                      onClick={() => setPreviewRoleIndex((current) => current === null ? null : Math.min(detailTemplate.role_highlights.length - 1, current + 1))}
                    >下一张<ChevronRight size={18} /></button>
                  </footer>
                </section>
              </div>
            )}
          </aside>
        </div>
      ), document.body)}
    </section>
  );
}
