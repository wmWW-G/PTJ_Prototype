import { afterEach, describe, expect, it } from "vitest";
import {
  listPersonalVisualTemplates,
  PERSONAL_TEMPLATE_STORAGE_KEY,
} from "./personalTemplateRepository";

/** 创建一条字段完整、可按需覆盖的本机套图模板记录。 */
function storedTemplate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "personal-template-1",
    imageType: "set",
    slotIndex: 1,
    slotTitle: "结构细节",
    instruction: "增加细节引线",
    previewImageUrl: "https://images.example.com/detail.png",
    customRoles: Array.from({ length: 6 }, (_, roleIndex) => ({
      template_id: "standard_product",
      role_index: roleIndex,
    })),
    createdAt: "2026-07-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("personalTemplateRepository", () => {
  afterEach(() => localStorage.clear());

  it("兼容旧 v1 记录中缺少 layout_recipe_id 的职责", () => {
    localStorage.setItem(
      PERSONAL_TEMPLATE_STORAGE_KEY,
      JSON.stringify([storedTemplate()]),
    );

    expect(listPersonalVisualTemplates()).toHaveLength(1);
    expect(listPersonalVisualTemplates()[0]?.customRoles[1]).not.toHaveProperty("layout_recipe_id");
  });

  it("过滤携带未知 layout_recipe_id 的损坏记录，避免其进入生成请求", () => {
    const invalidRoles = Array.from({ length: 6 }, (_, roleIndex) => ({
      template_id: "standard_product",
      role_index: roleIndex,
      layout_recipe_id: roleIndex === 1 ? "free-form-injection" : undefined,
    }));
    localStorage.setItem(
      PERSONAL_TEMPLATE_STORAGE_KEY,
      JSON.stringify([storedTemplate({ customRoles: invalidRoles })]),
    );

    expect(listPersonalVisualTemplates()).toEqual([]);
  });
});
