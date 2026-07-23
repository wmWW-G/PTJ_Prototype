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
  /** 用户可见的顺序名称，例如“我的模板01”。 */
  name: string;
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
export type SavePersonalVisualTemplateInput = Omit<PersonalVisualTemplate, "id" | "name" | "createdAt">;

/**
 * 校验新增或更新个人模板时的业务字段。
 *
 * @param input 界面准备持久化的图片类型、槽位、图片和整套职责。
 * @returns 校验通过时无返回值。
 * @throws 职责数量、槽位或布局配方不合法时抛出 RangeError。
 */
function validatePersonalTemplateInput(input: SavePersonalVisualTemplateInput): void {
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
}

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
    && (template.name === undefined
      || (typeof template.name === "string" && template.name.length > 0))
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
    const validTemplates = parsed
      .filter(isPersonalVisualTemplate)
      .map((template, index) => ({
        ...template,
        // 兼容已经写入浏览器的 v1 记录；旧记录按当前存储顺序补齐可读名称。
        name: template.name ?? `我的模板${String(index + 1).padStart(2, "0")}`,
        customRoles: template.customRoles.map((role) => ({ ...role })),
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return validTemplates;
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
  validatePersonalTemplateInput(input);

  const now = new Date().toISOString();
  const randomPart = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
  const existingTemplates = listPersonalVisualTemplates();
  const largestNameIndex = existingTemplates.reduce((largest, existingTemplate) => {
    const match = /^我的模板(\d+)$/.exec(existingTemplate.name);
    return match ? Math.max(largest, Number(match[1])) : largest;
  }, 0);
  const template: PersonalVisualTemplate = {
    ...input,
    id: `personal-template-${Date.now()}-${randomPart}`,
    // 名称由存储层统一编号，避免套图与详情图界面各自维护计数而产生重名。
    name: `我的模板${String(largestNameIndex + 1).padStart(2, "0")}`,
    customRoles: input.customRoles.map((role) => ({ ...role })),
    createdAt: now,
  };
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

/**
 * 覆盖更新一条已经保存的个人模板，同时保留原名称和唯一 ID。
 *
 * @param templateId 要更新的个人模板 ID。
 * @param input 编辑器中最新的图片、指令和整套职责。
 * @returns 更新后的完整个人模板。
 * @throws 模板不存在时抛出 RangeError；业务字段不合法或 LocalStorage 写入失败时继续抛出对应异常。
 */
export function updatePersonalVisualTemplate(
  templateId: string,
  input: SavePersonalVisualTemplateInput,
): PersonalVisualTemplate {
  validatePersonalTemplateInput(input);
  const existingTemplates = listPersonalVisualTemplates();
  const existingTemplate = existingTemplates.find((template) => template.id === templateId);
  if (!existingTemplate) {
    throw new RangeError("要编辑的个人模板不存在");
  }

  const updatedTemplate: PersonalVisualTemplate = {
    ...existingTemplate,
    ...input,
    id: existingTemplate.id,
    name: existingTemplate.name,
    customRoles: input.customRoles.map((role) => ({ ...role })),
    // 更新时间决定“我的模板”列表顺序，最近编辑的模板会回到列表前面。
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(
    PERSONAL_TEMPLATE_STORAGE_KEY,
    JSON.stringify([
      updatedTemplate,
      ...existingTemplates.filter((template) => template.id !== templateId),
    ]),
  );
  console.info("[批图匠] 个人模板已更新", {
    id: updatedTemplate.id,
    imageType: updatedTemplate.imageType,
    slotIndex: updatedTemplate.slotIndex,
  });
  return updatedTemplate;
}
