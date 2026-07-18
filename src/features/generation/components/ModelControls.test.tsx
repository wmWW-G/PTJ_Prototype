import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModelControls } from "./ModelControls";

describe("ModelControls", () => {
  it("把完整方案数量和生成张数计算放进真实参数区", async () => {
    const user = userEvent.setup();
    const onVariantCountChange = vi.fn();
    render(
      <ModelControls
        value={{
          model: "nano_banana_2",
          aspectRatio: "1:1",
          resolution: "2K",
          quality: "medium",
        }}
        onChange={() => undefined}
        variantCount={2}
        imagesPerVariant={6}
        onVariantCountChange={onVariantCountChange}
      />,
    );

    expect(screen.getByLabelText("真实生图参数")).toHaveTextContent("每版 6 张共 12 张");
    const quantity = screen.getByLabelText("完整方案数量");
    expect(quantity.querySelectorAll("option")).toHaveLength(10);
    await user.selectOptions(quantity, "10");
    expect(onVariantCountChange).toHaveBeenCalledWith(10);
  });

  it("按 PTJ-1、PTJ-2、PTJ-3 展示产品模型名", () => {
    render(
      <ModelControls
        value={{
          model: "nano_banana_2",
          aspectRatio: "1:1",
          resolution: "2K",
          quality: "medium",
        }}
        onChange={() => undefined}
        variantCount={1}
        imagesPerVariant={6}
        onVariantCountChange={() => undefined}
      />,
    );

    const modelSelect = screen.getByLabelText("生图模型");
    const options = Array.from(modelSelect.querySelectorAll("option"));
    expect(options.map((option) => option.textContent)).toEqual(["PTJ-1", "PTJ-2", "PTJ-3"]);
    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      "gpt_image_2_openrouter",
      "nano_banana_2",
      "nano_banana_pro",
    ]);
    expect(screen.queryByRole("option", { name: "GPT-Image-2" })).not.toBeInTheDocument();
  });

  it("选择 OpenRouter GPT-Image-2 时不增加第三个质量控件", async () => {
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
        variantCount={1}
        imagesPerVariant={6}
        onVariantCountChange={() => undefined}
      />,
    );

    expect(screen.queryByLabelText("生成质量")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("生图模型"), "gpt_image_2_openrouter");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt_image_2_openrouter" }),
    );
  });

  it("OpenRouter 直接在输出清晰度中选择低中高", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ModelControls
        value={{
          model: "gpt_image_2_openrouter",
          aspectRatio: "1:1",
          resolution: "4K",
          quality: "high",
        }}
        onChange={onChange}
        variantCount={1}
        imagesPerVariant={6}
        onVariantCountChange={() => undefined}
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

  it.each([
    ["nano_banana_2", 14, "1:8"],
    ["nano_banana_pro", 10, "21:9"],
    ["gpt_image_2_openrouter", 15, "3:1"],
  ] as const)("%s 使用下拉框展示模型专属比例", (model, count, example) => {
    render(
      <ModelControls
        value={{ model, aspectRatio: "1:1", resolution: "1K", quality: "low" }}
        onChange={() => undefined}
        variantCount={1}
        imagesPerVariant={6}
        onVariantCountChange={() => undefined}
      />,
    );

    const aspectRatio = screen.getByLabelText("画面比例");
    expect(aspectRatio).toHaveRole("combobox");
    expect(aspectRatio.querySelectorAll("option")).toHaveLength(count);
    expect(screen.getByRole("option", { name: example })).toBeInTheDocument();
  });

  it("Nano Banana 2 提供官方最低 512 清晰度", () => {
    render(
      <ModelControls
        value={{ model: "nano_banana_2", aspectRatio: "1:1", resolution: "512", quality: "low" }}
        onChange={() => undefined}
        variantCount={1}
        imagesPerVariant={6}
        onVariantCountChange={() => undefined}
      />,
    );

    expect(screen.getByLabelText("输出清晰度")).toHaveValue("512");
    expect(screen.getByRole("option", { name: "512" })).toBeInTheDocument();
  });

  it("不展示供应商参数实现说明", () => {
    render(
      <ModelControls
        value={{ model: "gpt_image_2_openrouter", aspectRatio: "1:1", resolution: "2K", quality: "medium" }}
        onChange={() => undefined}
        variantCount={1}
        imagesPerVariant={6}
        onVariantCountChange={() => undefined}
      />,
    );

    expect(screen.queryByText(/严格构图约束写入 Prompt/)).not.toBeInTheDocument();
  });
});
