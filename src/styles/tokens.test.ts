import { describe, expect, it } from "vitest";
import tokens from "./tokens.css?raw";

describe("批图匠品牌色", () => {
  it("使用橙色作为主品牌色，防止原型再退回紫色", () => {
    expect(tokens).toContain("--brand-600: #f28c18");
    expect(tokens).not.toContain("295");
  });
});
