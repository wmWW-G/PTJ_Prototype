import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { GenerationMode } from "../tasks/types";
import { IMAGE_TYPE_RESULT_COUNTS } from "./config";
import { GenerationPage } from "./GenerationPage";

describe("GenerationPage", () => {
  it("按真实业务规则设定四种图片类型的基础张数", () => {
    expect(IMAGE_TYPE_RESULT_COUNTS).toEqual({
      main: 1,
      set: 6,
      listing: 5,
      poster: 1,
    });
  });

  it.each<[GenerationMode, string]>([
    ["text-to-image", "产品+卖点"],
    ["image-to-image", "上传商品参考图"],
    ["ai-retouch", "去水印"],
    ["outfit-swap", "更换服装图"],
  ])("为 %s 展示专属控件", (mode, label) => {
    render(
      <MemoryRouter>
        <GenerationPage mode={mode} />
      </MemoryRouter>,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each<GenerationMode>(["text-to-image", "image-to-image"])(
    "为 %s 在表单右侧展示同款生成内容面板",
    (mode) => {
      render(
        <MemoryRouter>
          <GenerationPage mode={mode} />
        </MemoryRouter>,
      );

      expect(screen.getByLabelText("生成内容")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "重新编辑" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: "再次生成" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: "全部下载" }).length).toBeGreaterThan(0);
    },
  );
});
