import type {
  CustomVisualRoleSelection,
  ImageType,
  LayoutRecipeId,
} from "../tasks/types";

/** LocalStorage 中保存个人单图模板的固定键名。 */
export const PERSONAL_TEMPLATE_STORAGE_KEY = "ptj.prototype.personal-templates.v1";

/** 前后端共同登记的布局配方白名单，防止本机 JSON 注入任意 Prompt。 */
export const LAYOUT_RECIPE_IDS = [
  "commercial_overview",
  "detail_callouts",
  "benefit_evidence",
  "variant_matrix",
  "craft_options",
  "application_matrix",
  "quality_proof",
  "packaging_trade",
] as const satisfies readonly LayoutRecipeId[];

/** 当前只有套图和详情图支持自定义模板。 */
export type PersonalTemplateImageType = Extract<ImageType, "set" | "listing">;

/**
 * 保存在浏览器本机的个人单图模板。
 *
 * 除了候选图和修改要求，同时保留整套职责顺序。这样用户刷新
 * 页面后再次打开模板时，不会丢失当时的套图或详情图结构。
 */
export interface PersonalVisualTemplate {
  /** 浏览器本机内唯一的模板 ID。 */
  id: string;
  /** 模板所属的图片类型。 */
  imageType: PersonalTemplateImageType;
  /** 被修改图片在整套中的零基索引。 */
  slotIndex: number;
  /** 被修改图片的职责标题。 */
  slotTitle: string;
  /** 用户交给 AI 的自然语言修改要求。 */
  instruction: string;
  /** 已采用的真实生图 URL，用于下次预览和继续编辑。 */
  previewImageUrl: string;
  /** 保存当时的整套职责顺序。 */
  customRoles: CustomVisualRoleSelection[];
  /** ISO 8601 格式的保存时间。 */
  createdAt: string;
}

/** 新增个人模板时由界面提供的业务字段。 */
export type SavePersonalVisualTemplateInput = Omit<PersonalVisualTemplate, "id" | "createdAt">;

/**
 * 检查 LocalStorage 中的职责来源是否符合最小结构。
 *
 * @param value 从 JSON 中读取的未知值。
 * @returns 值包含合法模板 ID 和非负整数下标时返回 true。
 * @throws 不抛出异常；任何不完整值都直接返回 false。
 */
function isCustomRoleSelection(value: unknown): value is CustomVisualRoleSelection {
  if (!value || typeof value !== "object") return false;
  const role = value as Partial<CustomVisualRoleSelection>;
  return typeof role.template_id === "string"
    && role.template_id.length > 0
    && Number.isInteger(role.role_index)
    && (role.role_index ?? -1) >= 0
    && (role.layout_recipe_id === undefined
      || (typeof role.layout_recipe_id === "string"
        && LAYOUT_RECIPE_IDS.includes(role.layout_recipe_id as LayoutRecipeId)));
}

/**
 * 校验一条本机模板，防止损坏或旧版 JSON 进入界面。
 *
 * @param value LocalStorage 数组中的一条未知记录。
 * @returns 所有必要字段、槽位范围和职责数量都合法时返回 true。
 * @throws 不抛出异常；不兼容记录会被安全过滤。
 */
function isPersonalVisualTemplate(value: unknown): value is PersonalVisualTemplate {
  if (!value || typeof value !== "object") return false;
  const template = value as Partial<PersonalVisualTemplate>;
  const expectedRoleCount = template.imageType === "listing"
    ? 8
    : template.imageType === "set"
      ? 6
      : 0;
  return expectedRoleCount > 0
    && typeof template.id === "string"
    && template.id.length > 0
    && Number.isInteger(template.slotIndex)
    && (template.slotIndex ?? -1) >= 0
    && (template.slotIndex ?? expectedRoleCount) < expectedRoleCount
    && typeof template.slotTitle === "string"
    && template.slotTitle.length > 0
    && typeof template.instruction === "string"
    && template.instruction.length > 0
    && typeof template.previewImageUrl === "string"
    && template.previewImageUrl.length > 0
    && Array.isArray(template.customRoles)
    && template.customRoles.length === expectedRoleCount
    && template.customRoles.every(isCustomRoleSelection)
    && typeof template.createdAt === "string"
    && template.createdAt.length > 0;
}

/**
 * 读取并校验全部本机个人模板。
 *
 * @returns 按保存时间从新到旧排列的模板副本；无存储或存储损坏时返回空数组。
 * @throws 不主动抛出异常；无法解析时会记录警告并安全回退。
 */
export function listPersonalVisualTemplates(): PersonalVisualTemplate[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(PERSONAL_TEMPLATE_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new TypeError("个人模板存储不是数组");
    return parsed
      .filter(isPersonalVisualTemplate)
      .map((template) => ({
        ...template,
        customRoles: template.customRoles.map((role) => ({ ...role })),
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch (error) {
    console.warn("[批图匠] 个人模板读取失败，已回退为空列表", error);
    return [];
  }
}

/**
 * 把用户已采用的单图和当前整套结构持久化到 LocalStorage。
 *
 * @param input 界面中已确认的图片类型、槽位、修改要求、图片 URL 和职责顺序。
 * @returns 已补齐唯一 ID 和保存时间的完整模板。
 * @throws 职责数量或槽位不合法时抛出 RangeError；浏览器禁用存储或容量不足时由 localStorage 抛出异常。
 */
export function savePersonalVisualTemplate(
  input: SavePersonalVisualTemplateInput,
): PersonalVisualTemplate {
  const expectedRoleCount = input.imageType === "listing" ? 8 : 6;
  if (input.customRoles.length !== expectedRoleCount) {
    throw new RangeError(`个人模板需要 ${expectedRoleCount} 个职责`);
  }
  if (!Number.isInteger(input.slotIndex) || input.slotIndex < 0 || input.slotIndex >= expectedRoleCount) {
    throw new RangeError("个人模板槽位超出范围");
  }
  if (!input.customRoles.every(isCustomRoleSelection)) {
    throw new RangeError("个人模板包含未登记的布局配方");
  }

  const now = new Date().toISOString();
  const randomPart = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
  const template: PersonalVisualTemplate = {
    ...input,
    id: `personal-template-${Date.now()}-${randomPart}`,
    customRoles: input.customRoles.map((role) => ({ ...role })),
    createdAt: now,
  };
  const existingTemplates = listPersonalVisualTemplates();
  localStorage.setItem(
    PERSONAL_TEMPLATE_STORAGE_KEY,
    JSON.stringify([template, ...existingTemplates]),
  );
  console.info("[批图匠] 个人模板已保存", {
    id: template.id,
    imageType: template.imageType,
    slotIndex: template.slotIndex,
  });
  return template;
}
