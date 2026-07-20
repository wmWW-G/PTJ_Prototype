import { fireEvent, render, screen, within } from "@testing-library/react";
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
  const [customRoles, setCustomRoles] = useState<Array<{ template_id: string; role_index: number }>>([]);
  const [info, setInfo] = useState<Record<string, string>>({});
  return (
    <VisualTemplatePicker
      imageType="set"
      value={value}
      customRoles={customRoles}
      supplementalInfo={info}
      templates={DEFAULT_VISUAL_TEMPLATES}
      onChange={setValue}
      onCustomRolesChange={setCustomRoles}
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
    expect(screen.getByText("逐张查看画面与信息结构")).toBeInTheDocument();
    expect(screen.getByText("企业总览")).toBeInTheDocument();
    expect(screen.getByText("可补充信息（均选填）")).toBeInTheDocument();
    expect(screen.getAllByText("查看大图")).toHaveLength(6);

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
        imageType="set"
        value="supplier_strength"
        customRoles={[]}
        supplementalInfo={{}}
        templates={DEFAULT_VISUAL_TEMPLATES}
        onChange={vi.fn()}
        onCustomRolesChange={vi.fn()}
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

  it("详情图只展示三套 B2B 模板，并可切换到工厂履约详情", async () => {
    const user = userEvent.setup();

    function ListingPicker() {
      const [value, setValue] = useState("b2b_procurement_listing");
      const [customRoles, setCustomRoles] = useState<Array<{ template_id: string; role_index: number }>>([]);
      return (
        <VisualTemplatePicker
          imageType="listing"
          value={value}
          customRoles={customRoles}
          supplementalInfo={{}}
          templates={DEFAULT_VISUAL_TEMPLATES}
          onChange={setValue}
          onCustomRolesChange={setCustomRoles}
          onInfoChange={vi.fn()}
        />
      );
    }

    render(<ListingPicker />);
    expect(screen.getByText("采购决策详情")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    expect(screen.getByRole("button", { name: "选择采购决策详情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择OEM/ODM 定制详情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择工厂履约详情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看采购决策详情" })).toBeInTheDocument();
    expect(screen.queryByText("采购决策详情详情")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选择标准商品套图" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看采购决策详情" }));
    expect(screen.getByText("共 8 张详情图")).toBeInTheDocument();
    expect(screen.getAllByText("查看大图")).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: /产品与应用总览/ }));
    expect(screen.getByRole("dialog", { name: "详情图大图预览" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看下一张" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "关闭大图预览" }));
    await user.click(screen.getByRole("button", { name: "返回模板列表" }));

    await user.click(screen.getByRole("button", { name: "选择工厂履约详情" }));
    await user.click(screen.getByRole("button", { name: "使用此模板" }));
    expect(screen.getByText("工厂履约详情")).toBeInTheDocument();
  });

  it("套图可从现有套图职责中选满 6 张并调整顺序", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    expect(screen.getByRole("button", { name: "配置自定义套图" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "配置自定义套图" }));

    // 首次进入时沿用当前预设的六个职责，用户可以逐项替换，不必从空白开始。
    expect(screen.getByText("6/6")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "移除商品主视觉" }));
    expect(screen.getByText("5/6")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "选择职责：企业总览，来自企业实力套图" }));
    expect(screen.getByText("6/6")).toBeInTheDocument();

    // 顺序控制位于已选职责区，调整后的数组会作为最终六张图的生成顺序提交。
    await user.click(screen.getByRole("button", { name: "上移企业总览" }));
    await user.click(screen.getByRole("button", { name: "使用自定义套图" }));
    expect(screen.queryByRole("dialog", { name: "选择生图模板" })).not.toBeInTheDocument();
    expect(screen.getByText("自定义套图")).toBeInTheDocument();
    expect(screen.getByText("6 张 / 版")).toBeInTheDocument();
  });

  it("详情图自定义职责库只包含现有详情图模板并固定为 8 张", async () => {
    const user = userEvent.setup();

    function CustomListingPicker() {
      const [value, setValue] = useState("b2b_procurement_listing");
      const [customRoles, setCustomRoles] = useState<Array<{ template_id: string; role_index: number }>>([]);
      return (
        <VisualTemplatePicker
          imageType="listing"
          value={value}
          customRoles={customRoles}
          supplementalInfo={{}}
          templates={DEFAULT_VISUAL_TEMPLATES}
          onChange={setValue}
          onCustomRolesChange={setCustomRoles}
          onInfoChange={vi.fn()}
        />
      );
    }

    render(<CustomListingPicker />);
    await user.click(screen.getByRole("button", { name: "更换模板" }));
    await user.click(screen.getByRole("button", { name: "配置自定义详情图" }));

    expect(screen.getByText("8/8")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "采购决策详情" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OEM/ODM 定制详情" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "工厂履约详情" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "企业实力套图" })).not.toBeInTheDocument();
  });
});
