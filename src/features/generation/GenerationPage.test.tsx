import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { GenerationMode } from "../tasks/types";
import { GenerationPage } from "./GenerationPage";

describe("GenerationPage", () => {
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
});
