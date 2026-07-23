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
    localStorage.clear();
  });

  it("所有静态模板都保持参考图级别的图文解说密度", () => {
    const allPreviewImages = Object.values(DEFAULT_VISUAL_TEMPLATES)
      .flatMap((template) => template.preview_images);
    expect(allPreviewImages).toHaveLength(62);
    expect(new Set(allPreviewImages)).toHaveLength(62);

    for (const template of Object.values(DEFAULT_VISUAL_TEMPLATES)) {
      const visualDirection = `${template.description}${template.art_direction}`;
      expect(visualDirection).not.toContain("少文字");
      expect(visualDirection).not.toContain("大面积留白");
      expect(template.density_profile).toEqual({
        level: "high",
        min_information_units: 9,
        max_information_units: 12,
        min_supporting_visuals: 4,
        min_visible_labels: 5,
        max_visible_labels: 8,
        target_occupancy_percent: 80,
      });
      expect(template.role_compositions).toHaveLength(template.role_highlights.length);
      template.role_compositions?.forEach((composition) => {
        expect(composition).toContain("醒目标题");
        expect(composition).toContain("解释副标题");
        expect(composition).toContain("至少 4 个");
        expect(composition).toContain("一句解释");
      });
    }
  });

  it("通过右侧抽屉切换模板并显示该模板的预期结构", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    expect(screen.getByRole("dialog", { name: "选择生图模板" })).toBeInTheDocument();
    expect(screen.queryByLabelText("模板分类")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "选择企业实力套图" }));
    await user.click(screen.getByRole("button", { name: "使用此模板" }));

    expect(screen.queryByRole("dialog", { name: "选择生图模板" })).not.toBeInTheDocument();
    expect(screen.getByText("企业实力套图")).toBeInTheDocument();
  });

  it("所有模板卡都显示高信息量标签，视觉风格不再降低信息密度", async () => {
    const user = userEvent.setup();
    const { container } = render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    const denseCard = screen.getByRole("button", { name: "选择高信息量商品套图" });

    expect(within(denseCard).getByText("高信息量")).toBeInTheDocument();
    expect(denseCard.querySelectorAll("img")[0]).toHaveAttribute(
      "src",
      expect.stringContaining("templates-v2/high-density/set/01-procurement-overview.jpg"),
    );
    expect(denseCard.querySelectorAll("img")[1]).toHaveAttribute(
      "src",
      expect.stringContaining("templates-v2/high-density/set/02-detail-callouts.jpg"),
    );
    expect(container.querySelectorAll("img")).not.toHaveLength(0);

    const minimalCard = screen.getByRole("button", { name: "选择极简质感套图" });
    expect(within(minimalCard).getByText("高信息量")).toBeInTheDocument();
  });

  it("模板生图维度始终展示，切换选中状态不会增删卡片内容", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    const standardCard = screen.getByRole("button", { name: "选择标准商品套图" });
    const supplierCard = screen.getByRole("button", { name: "选择企业实力套图" });

    // 两张未选中的模板也必须直接展示生图维度，避免用户点击后卡片突然变高。
    expect(within(standardCard).getByText("商品主体")).toBeInTheDocument();
    expect(within(standardCard).getByText("使用场景")).toBeInTheDocument();
    expect(within(supplierCard).getByText("工厂规模与历史")).toBeInTheDocument();
    expect(within(supplierCard).getByText("交付与服务")).toBeInTheDocument();

    const dimensionCountBeforeSelection = within(supplierCard).getAllByRole("listitem").length;
    await user.click(supplierCard);
    expect(supplierCard).toHaveAttribute("aria-pressed", "true");
    expect(within(supplierCard).getAllByRole("listitem")).toHaveLength(dimensionCountBeforeSelection);
  });

  it("预设详情使用与自定义模板相同的整套网格展开方式", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    await user.click(screen.getByRole("button", { name: "查看高信息量商品套图详情" }));
    expect(screen.getByRole("heading", { name: "高信息量商品套图详情" })).toBeInTheDocument();
    let dialog = screen.getByRole("dialog", { name: "选择生图模板" });
    expect(within(dialog).getByText("整套模板结构")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /查看高信息量商品套图第/ })).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: "返回模板列表" }));
    await user.click(screen.getByRole("button", { name: "查看极简质感套图详情" }));
    dialog = screen.getByRole("dialog", { name: "选择生图模板" });
    expect(within(dialog).getByText("整套模板结构")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /查看极简质感套图第/ })).toHaveLength(6);
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
    expect(screen.getByText("整套模板结构")).toBeInTheDocument();
    expect(screen.getByText("企业总览")).toBeInTheDocument();
    expect(screen.getAllByText("点击查看大图")).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: "使用此模板" }));
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
    expect(within(screen.getByRole("dialog", { name: "选择生图模板" })).getByText("8 张 / 版")).toBeInTheDocument();
    expect(screen.getAllByText("点击查看大图")).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: /产品与应用总览/ }));
    expect(screen.getByRole("dialog", { name: "详情图大图预览" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看下一张" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "关闭大图预览" }));
    await user.click(screen.getByRole("button", { name: "返回模板列表" }));

    await user.click(screen.getByRole("button", { name: "选择工厂履约详情" }));
    await user.click(screen.getByRole("button", { name: "使用此模板" }));
    expect(screen.getByText("工厂履约详情")).toBeInTheDocument();
  });

  it("自定义单图编辑底部只保留采用动作", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    await user.click(screen.getByRole("button", { name: "选择自定义套图" }));
    await user.click(screen.getByRole("button", { name: "继续编辑" }));
    const dialog = screen.getByRole("dialog", { name: "选择生图模板" });
    await user.click(within(dialog).getByRole("button", { name: "修改第 1 张：商品主视觉" }));

    // 用户尚未发起生成时只展示原图，避免把静态示意图误认为已生成的结果。
    expect(within(dialog).getByAltText("修改前的原图")).toBeInTheDocument();
    expect(within(dialog).queryByText("参考预览")).not.toBeInTheDocument();
    expect(within(dialog).queryByAltText("AI 生成的新版本")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "继续修改" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "再生成一个" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "采用这张" })).toBeInTheDocument();
  });

  it("采用单图后持久化个人模板，刷新后仍可从自定义分类打开", async () => {
    const user = userEvent.setup();
    generateCustomTemplateImageMock.mockResolvedValueOnce("https://images.example.com/generated-slot-4.png");
    const { unmount } = render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    const continueButton = screen.getByRole("button", { name: "继续编辑" });
    expect(continueButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "选择自定义套图" }));
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);

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
    expect(within(dialog).getByText("已采用；可保存到本机“我的模板”")).toBeInTheDocument();
    const saveButton = within(dialog).getByRole("button", { name: "保存为我的模板" });
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);
    expect(within(dialog).getByRole("button", { name: "已保存到我的模板" })).toBeDisabled();
    expect(within(dialog).getByText("已保存到本机；可从“自定义”分类再次打开")).toBeInTheDocument();

    const storedTemplates = JSON.parse(
      localStorage.getItem("ptj.prototype.personal-templates.v1") ?? "[]",
    ) as unknown[];
    expect(storedTemplates).toHaveLength(1);
    expect(storedTemplates[0]).toMatchObject({
      imageType: "set",
      slotIndex: 3,
      slotTitle: "Logo 工艺展示",
      instruction: "增加四种 Logo 工艺展示，整体更专业，文案由 AI 生成",
      previewImageUrl: "https://images.example.com/generated-slot-4.png",
      customRoles: expect.arrayContaining([
        expect.objectContaining({ layout_recipe_id: "craft_options" }),
      ]),
    });

    await user.click(within(dialog).getByRole("button", { name: "返回整套" }));
    expect(within(dialog).getByText("已采用 AI 新版本")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "保存模板" }));
    expect(screen.queryByRole("dialog", { name: "选择生图模板" })).not.toBeInTheDocument();
    expect(screen.getByText("我的模板02")).toBeInTheDocument();
    expect(screen.getByText("6 张 / 版")).toBeInTheDocument();

    // 重新挂载组件模拟刷新页面，确认模板不是只保存在 React 内存中。
    unmount();
    render(<ControlledPicker />);
    await user.click(screen.getByRole("button", { name: "更换模板" }));
    const savedTemplateCard = screen.getByRole("article", { name: "我的模板：我的模板01" });
    expect(within(savedTemplateCard).getByAltText("我的模板01模板预览")).toHaveAttribute(
      "src",
      "https://images.example.com/generated-slot-4.png",
    );
    const selectPersonalTemplate = within(savedTemplateCard).getByRole("button", { name: "选择我的模板01" });
    await user.click(selectPersonalTemplate);
    expect(selectPersonalTemplate).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).queryByRole("heading", { name: /第 4 张/ })).not.toBeInTheDocument();

    await user.click(within(savedTemplateCard).getByRole("button", { name: "查看我的模板01详情" }));
    const reopenedDialog = screen.getByRole("dialog", { name: "选择生图模板" });
    expect(within(reopenedDialog).getByRole("heading", { name: "我的模板01详情" })).toBeInTheDocument();
    expect(within(reopenedDialog).getAllByText("点击查看大图")).toHaveLength(6);
    expect(within(reopenedDialog).queryByRole("img", { name: "我的模板01第 4 张大图" })).not.toBeInTheDocument();
    await user.click(within(reopenedDialog).getByRole("button", { name: /查看我的模板01第 4 张/ }));
    expect(within(reopenedDialog).getByRole("img", { name: "我的模板01第 4 张大图" })).toHaveAttribute(
      "src",
      "https://images.example.com/generated-slot-4.png",
    );

    // “继续编辑”是独立入口：卡片点击仍只选中，但用户可以明确恢复保存时的编辑现场。
    await user.click(within(reopenedDialog).getByRole("button", { name: "关闭大图预览" }));
    await user.click(within(reopenedDialog).getByRole("button", { name: "返回模板列表" }));
    const editablePersonalCard = screen.getByRole("article", { name: "我的模板：我的模板01" });
    await user.click(within(editablePersonalCard).getByRole("button", { name: "继续编辑我的模板01" }));
    expect(within(reopenedDialog).getByRole("heading", { name: "自定义套图" })).toBeInTheDocument();
    expect(within(reopenedDialog).getByText("已采用 AI 新版本")).toBeInTheDocument();
    await user.click(within(reopenedDialog).getByRole("button", { name: "修改第 4 张：Logo 工艺展示" }));
    expect(within(reopenedDialog).getByLabelText("告诉 AI 怎么修改这一张")).toHaveValue(
      "增加四种 Logo 工艺展示，整体更专业，文案由 AI 生成",
    );
    expect(within(reopenedDialog).getByAltText("AI 生成的新版本")).toHaveAttribute(
      "src",
      "https://images.example.com/generated-slot-4.png",
    );
  });

  it("点击保存模板后自动命名为我的模板01", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    await user.click(screen.getByRole("button", { name: "选择自定义套图" }));
    await user.click(screen.getByRole("button", { name: "继续编辑" }));
    await user.click(screen.getByRole("button", { name: "保存模板" }));

    expect(screen.getByText("我的模板01")).toBeInTheDocument();
    const storedTemplates = JSON.parse(
      localStorage.getItem("ptj.prototype.personal-templates.v1") ?? "[]",
    ) as Array<{ name: string }>;
    expect(storedTemplates).toHaveLength(1);
    expect(storedTemplates[0]?.name).toBe("我的模板01");
  });

  it("采用结构细节候选图后保存并重开，向外提交固定 detail_callouts 配方", async () => {
    const user = userEvent.setup();
    const onCustomRolesChange = vi.fn();
    generateCustomTemplateImageMock.mockResolvedValueOnce("https://images.example.com/generated-detail.png");
    const { unmount } = render(
      <VisualTemplatePicker
        imageType="set"
        value="standard_product"
        customRoles={[]}
        supplementalInfo={{}}
        templates={DEFAULT_VISUAL_TEMPLATES}
        onChange={vi.fn()}
        onCustomRolesChange={onCustomRolesChange}
        onInfoChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    await user.click(screen.getByRole("button", { name: "选择自定义套图" }));
    await user.click(screen.getByRole("button", { name: "继续编辑" }));
    const dialog = screen.getByRole("dialog", { name: "选择生图模板" });
    await user.click(within(dialog).getByRole("button", { name: "修改第 2 张：结构细节" }));
    await user.click(within(dialog).getByRole("button", { name: "重新生成" }));
    await user.click(await within(dialog).findByRole("button", { name: "采用这张" }));
    await user.click(within(dialog).getByRole("button", { name: "保存为我的模板" }));

    const stored = JSON.parse(localStorage.getItem("ptj.prototype.personal-templates.v1") ?? "[]") as Array<{ customRoles: Array<{ layout_recipe_id?: string }> }>;
    expect(stored[0]?.customRoles[1]?.layout_recipe_id).toBe("detail_callouts");

    // 重新挂载后只能从 LocalStorage 读取职责，借此验证并非沿用当前 React 内存。
    // 清空首次“采用”的记录，确保下方断言只能由重开后的“使用这套模板”触发。
    onCustomRolesChange.mockClear();
    unmount();
    render(
      <VisualTemplatePicker
        imageType="set"
        value="standard_product"
        customRoles={[]}
        supplementalInfo={{}}
        templates={DEFAULT_VISUAL_TEMPLATES}
        onChange={vi.fn()}
        onCustomRolesChange={onCustomRolesChange}
        onInfoChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "更换模板" }));
    const savedTemplate = screen.getByRole("article", { name: "我的模板：我的模板01" });
    await user.click(within(savedTemplate).getByRole("button", { name: "选择我的模板01" }));
    const reopenedDialog = screen.getByRole("dialog", { name: "选择生图模板" });
    await user.click(within(reopenedDialog).getByRole("button", { name: "使用此模板" }));
    expect(onCustomRolesChange).toHaveBeenCalledTimes(1);
    const reloadedRoles = onCustomRolesChange.mock.calls[0]?.[0];
    expect(reloadedRoles?.[1]?.layout_recipe_id).toBe("detail_callouts");
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
    await user.click(screen.getByRole("button", { name: "选择自定义详情图" }));
    await user.click(screen.getByRole("button", { name: "继续编辑" }));

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
    await user.click(screen.getByRole("button", { name: "选择自定义套图" }));
    await user.click(screen.getByRole("button", { name: "继续编辑" }));
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
    await user.click(screen.getByRole("button", { name: "选择自定义套图" }));
    await user.click(screen.getByRole("button", { name: "继续编辑" }));
    const dialog = screen.getByRole("dialog", { name: "选择生图模板" });
    await user.click(within(dialog).getByRole("button", { name: "修改第 1 张：商品主视觉" }));
    const referenceFile = new File(["cow"], "牛1.jpg", { type: "image/jpeg" });
    await user.upload(within(dialog).getByLabelText("附加参考图"), referenceFile);

    expect(within(dialog).getByText("原图")).toBeInTheDocument();
    expect(within(dialog).getByAltText("修改前的原图")).toHaveAttribute(
      "src",
      expect.stringContaining("templates-v2/high-density/listing/01-procurement-overview.jpg"),
    );
    expect(within(dialog).getByText("牛1.jpg")).toBeInTheDocument();
  });

  it("可以直接在自然语言修改框粘贴一张图片", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);

    await user.click(screen.getByRole("button", { name: "更换模板" }));
    await user.click(screen.getByRole("button", { name: "选择自定义套图" }));
    await user.click(screen.getByRole("button", { name: "继续编辑" }));
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
