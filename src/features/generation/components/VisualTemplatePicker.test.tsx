import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VISUAL_TEMPLATES,
  VisualTemplatePicker,
} from "./VisualTemplatePicker";

/**
 * 为受控组件提供真实状态，确保测试覆盖用户完整交互而非只检查静态文本。
 *
 * @returns 可交互的模板选择器。
 */
function ControlledPicker() {
  const [value, setValue] = useState("standard_product");
  const [info, setInfo] = useState<Record<string, string>>({});
  return (
    <VisualTemplatePicker
      value={value}
      supplementalInfo={info}
      templates={DEFAULT_VISUAL_TEMPLATES}
      onChange={setValue}
      onInfoChange={setInfo}
    />
  );
}

describe("VisualTemplatePicker", () => {
  it("通过右侧抽屉切换模板并显示该模板的预期结构", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    expect(screen.getByRole("dialog", { name: "选择生图模板" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "企业实力" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "选择企业实力套图" }));
    expect(screen.getByText("工厂规模与历史")).toBeInTheDocument();
    expect(screen.getByText("认证与合作背书")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "使用此模板" }));

    expect(screen.queryByRole("dialog", { name: "选择生图模板" })).not.toBeInTheDocument();
    expect(screen.getByText("企业实力套图")).toBeInTheDocument();
  });

  it("每张模板卡都提供独立详情入口，并可从详情直接使用模板", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    expect(screen.getByRole("button", { name: "查看标准商品套图详情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看企业实力套图详情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看极简质感套图详情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看场景故事套图详情" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看企业实力套图详情" }));
    expect(screen.getByRole("heading", { name: "企业实力套图详情" })).toBeInTheDocument();
    expect(screen.getByText("这套会生成什么")).toBeInTheDocument();
    expect(screen.getByText("企业总览")).toBeInTheDocument();
    expect(screen.getByText("可补充信息（均选填）")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "选择并使用此模板" }));
    expect(screen.queryByRole("dialog", { name: "选择生图模板" })).not.toBeInTheDocument();
    expect(screen.getByText("企业实力套图")).toBeInTheDocument();
  });

  it("模板详情可以返回模板列表，不会提前改变当前选择", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    await user.click(screen.getByRole("button", { name: "查看极简质感套图详情" }));
    await user.click(screen.getByRole("button", { name: "返回模板列表" }));

    expect(screen.getByText("选择生图模板")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.getByText("标准商品套图")).toBeInTheDocument();
  });

  it("补充字段全部选填，并把用户填写内容交回页面状态", async () => {
    const user = userEvent.setup();
    const onInfoChange = vi.fn();
    render(
      <VisualTemplatePicker
        value="supplier_strength"
        supplementalInfo={{}}
        templates={DEFAULT_VISUAL_TEMPLATES}
        onChange={vi.fn()}
        onInfoChange={onInfoChange}
      />,
    );

    expect(screen.getByText(/不填写也可以生成/)).toBeInTheDocument();
    await user.click(screen.getByText(/补充模板信息（选填）/));
    const companyInput = screen.getByLabelText("公司名称");
    expect(companyInput).not.toBeRequired();
    fireEvent.change(companyInput, { target: { value: "宁波某某制造有限公司" } });

    expect(onInfoChange).toHaveBeenLastCalledWith({
      company_name: "宁波某某制造有限公司",
    });
  });
});
