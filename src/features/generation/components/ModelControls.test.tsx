import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModelControls } from "./ModelControls";

describe("ModelControls", () => {
  it("模型列表把 Azure 模型简洁显示为 GPT-Image-2", () => {
    render(
      <ModelControls
        value={{
          model: "nano_banana_2",
          aspectRatio: "1:1",
          resolution: "2K",
          quality: "medium",
        }}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole("option", { name: "GPT-Image-2" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "GPT-Image-2 · Azure" })).not.toBeInTheDocument();
  });

  it("选择 Azure GPT-Image-2 时不增加第三个质量控件", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ModelControls
        value={{
          model: "nano_banana_2",
          aspectRatio: "1:1",
          resolution: "2K",
          quality: "medium",
        }}
        onChange={onChange}
      />,
    );

    expect(screen.queryByLabelText("生成质量")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("生图模型"), "gpt_image_2_azure");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt_image_2_azure" }),
    );
  });

  it("Azure 直接在输出清晰度中选择低中高", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ModelControls
        value={{
          model: "gpt_image_2_azure",
          aspectRatio: "1:1",
          resolution: "4K",
          quality: "high",
        }}
        onChange={onChange}
      />,
    );

    const clarity = screen.getByLabelText("输出清晰度");
    expect(clarity).toHaveValue("high");
    expect(screen.getByRole("option", { name: "低" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "中" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "高" })).toBeInTheDocument();
    expect(screen.queryByLabelText("生成质量")).not.toBeInTheDocument();

    await user.selectOptions(clarity, "low");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ quality: "low", resolution: "1K" }),
    );
  });
});
