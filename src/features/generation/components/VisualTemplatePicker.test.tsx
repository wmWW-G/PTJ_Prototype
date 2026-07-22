import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCustomTemplateImage } from "../api";
import {
  DEFAULT_VISUAL_TEMPLATES,
  VisualTemplatePicker,
} from "./VisualTemplatePicker";

vi.mock("../api", () => ({
  generateCustomTemplateImage: vi.fn(),
}));

const generateCustomTemplateImageMock = vi.mocked(generateCustomTemplateImage);

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
  beforeEach(() => {
    generateCustomTemplateImageMock.mockReset();
  });

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

  it("套图通过大抽屉完成单图 AI 修改、采用与保存模板", async () => {
    const user = userEvent.setup();
    generateCustomTemplateImageMock.mockResolvedValueOnce("https://images.example.com/generated-slot-4.png");
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    expect(screen.getByRole("button", { name: "配置自定义套图" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "配置自定义套图" }));

    const dialog = screen.getByRole("dialog", { name: "选择生图模板" });
    expect(within(dialog).getByText("AI 已经排好整套结构")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /修改第/ })).toHaveLength(6);

    // 点击第四张后只保留原图、新版本和一句话修改框，不再要求用户手写营销文案。
    await user.click(within(dialog).getByRole("button", { name: "修改第 4 张：Logo 工艺展示" }));
    expect(within(dialog).getByRole("heading", { name: "第 4 张 · Logo 工艺展示" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("告诉 AI 怎么修改这一张")).toHaveValue(
      "增加四种 Logo 工艺展示，整体更专业，文案由 AI 生成",
    );
    expect(within(dialog).getByRole("button", { name: /保存为我的模板/ })).toBeDisabled();

    // 真实生成完成后才允许采用候选图，并继续保存个人模板。
    await user.click(within(dialog).getByRole("button", { name: "重新生成" }));
    expect(await within(dialog).findByText("GPT-Image-2 已生成新版本")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "采用这张" }));
    expect(within(dialog).getByText("已采用；模板特征提取与持久化当前仍为原型状态")).toBeInTheDocument();
    const saveButton = within(dialog).getByRole("button", { name: "保存为我的模板" });
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);
    expect(within(dialog).getByRole("button", { name: "已保存到我的模板" })).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "返回整套" }));
    expect(within(dialog).getByText("已采用 AI 新版本")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "使用这套模板" }));
    expect(screen.queryByRole("dialog", { name: "选择生图模板" })).not.toBeInTheDocument();
    expect(screen.getByText("自定义套图")).toBeInTheDocument();
    expect(screen.getByText("6 张 / 版")).toBeInTheDocument();
  });

  it("详情图自定义入口保持 8 个可独立修改的图片槽位", async () => {
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

    const dialog = screen.getByRole("dialog", { name: "选择生图模板" });
    expect(within(dialog).getByText("8 张 / 版")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /修改第/ })).toHaveLength(8);
    expect(within(dialog).queryByRole("button", { name: /选择职责/ })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "修改第 8 张：包装与合作" }));
    expect(within(dialog).getByRole("heading", { name: "第 8 张 · 包装与合作" })).toBeInTheDocument();
  });

  it("自定义单图允许附图加文字，并展示 GPT-Image-2 的真实结果", async () => {
    const user = userEvent.setup();
    generateCustomTemplateImageMock.mockResolvedValueOnce("https://images.example.com/custom-result.png");
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    await user.click(screen.getByRole("button", { name: "配置自定义套图" }));
    const dialog = screen.getByRole("dialog", { name: "选择生图模板" });
    await user.click(within(dialog).getByRole("button", { name: "修改第 4 张：Logo 工艺展示" }));

    const instructionInput = within(dialog).getByLabelText("告诉 AI 怎么修改这一张");
    await user.clear(instructionInput);
    await user.type(instructionInput, "保留帽子主体，增加四种 Logo 工艺");
    const referenceFile = new File(["cap"], "cap.jpg", { type: "image/jpeg" });
    await user.upload(within(dialog).getByLabelText("附加参考图"), referenceFile);
    await user.click(within(dialog).getByRole("button", { name: "重新生成" }));

    await waitFor(() => expect(generateCustomTemplateImageMock).toHaveBeenCalledWith(expect.objectContaining({
      instruction: "保留帽子主体，增加四种 Logo 工艺",
      referenceFile,
    })));
    expect(await within(dialog).findByAltText("AI 生成的新版本")).toHaveAttribute(
      "src",
      "https://images.example.com/custom-result.png",
    );
    expect(within(dialog).getByText("GPT-Image-2 · 低")).toBeInTheDocument();
  });

  it("附加参考图只作为生图输入，不覆盖左侧正在修改的原图", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    await user.click(screen.getByRole("button", { name: "配置自定义套图" }));
    const dialog = screen.getByRole("dialog", { name: "选择生图模板" });
    await user.click(within(dialog).getByRole("button", { name: "修改第 1 张：商品主视觉" }));
    const referenceFile = new File(["cow"], "牛1.jpg", { type: "image/jpeg" });
    await user.upload(within(dialog).getByLabelText("附加参考图"), referenceFile);

    expect(within(dialog).getByText("原图")).toBeInTheDocument();
    expect(within(dialog).getByAltText("修改前的原图")).toHaveAttribute(
      "src",
      expect.stringContaining("cap-product-overview.jpg"),
    );
    expect(within(dialog).getByText("牛1.jpg")).toBeInTheDocument();
  });

  it("可以直接在自然语言修改框粘贴一张图片", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    await user.click(screen.getByRole("button", { name: "配置自定义套图" }));
    const dialog = screen.getByRole("dialog", { name: "选择生图模板" });
    await user.click(within(dialog).getByRole("button", { name: "修改第 2 张：结构细节" }));
    const pastedFile = new File(["pasted-image"], "粘贴的参考图.png", { type: "image/png" });

    fireEvent.paste(within(dialog).getByLabelText("告诉 AI 怎么修改这一张"), {
      clipboardData: {
        files: [pastedFile],
        items: [{ kind: "file", type: "image/png", getAsFile: () => pastedFile }],
      },
    });

    expect(within(dialog).getByText("粘贴的参考图.png")).toBeInTheDocument();
    expect(within(dialog).getByText("已附图")).toBeInTheDocument();
  });
});
