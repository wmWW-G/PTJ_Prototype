import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModelControls } from "./ModelControls";

describe("ModelControls", () => {
  it("仅在 Azure GPT-Image-2 下显示独立质量参数", async () => {
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

  it("Azure 当前值会直接显示质量选择", () => {
    render(
      <ModelControls
        value={{
          model: "gpt_image_2_azure",
          aspectRatio: "1:1",
          resolution: "4K",
          quality: "high",
        }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText("生成质量")).toHaveValue("high");
  });
});

