import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationPageMode } from "./config";
import { IMAGE_TYPE_RESULT_COUNTS } from "./config";
import { GenerationPage } from "./GenerationPage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GenerationPage", () => {
  it("按真实业务规则设定四种图片类型的基础张数", () => {
    expect(IMAGE_TYPE_RESULT_COUNTS).toEqual({
      main: 1,
      set: 6,
      listing: 8,
      poster: 1,
    });
  });

  it.each<[GenerationPageMode, string]>([
    ["generate", "点击选择，也可以直接粘贴或拖拽到这里"],
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

  it("在统一生图入口右侧展示生成内容面板", () => {
    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("生成内容")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "全部下载" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "重新编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "再次生成" })).not.toBeInTheDocument();
  });

  it("统一生图页不展示冗余步骤条和自动模式提示", () => {
    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText("生成步骤")).not.toBeInTheDocument();
    expect(screen.queryByText("自动识别")).not.toBeInTheDocument();
    expect(screen.queryByText("当前为文生图")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "批量生图" })).not.toBeInTheDocument();
  });

  it("把每版张数并入对应图片类型，并移除重复输入说明", () => {
    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    const imageTypes = screen.getByLabelText("图片类型");
    expect(within(imageTypes).getByRole("button", { name: "主图，1张每版" })).toBeInTheDocument();
    expect(within(imageTypes).getByRole("button", { name: "套图，6张每版" })).toBeInTheDocument();
    expect(within(imageTypes).getByRole("button", { name: "详情图，8张每版" })).toBeInTheDocument();
    expect(within(imageTypes).getByRole("button", { name: "海报，1张每版" })).toBeInTheDocument();
    expect(screen.queryByLabelText("各类型固定生成张数")).not.toBeInTheDocument();
    expect(screen.queryByText("最多 10 张")).not.toBeInTheDocument();
    expect(screen.queryByText("有参考图时会优先识别并保留商品特征；没有图片时，才根据文字从头生成。")).not.toBeInTheDocument();
  });

  it("套图和详情图各自展示专属模板，主图使用设计参考与产品素材双输入", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    // 默认套图保留视觉模板选择器。
    expect(screen.getByLabelText("生图模板")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "主图，1张每版" }));

    expect(screen.queryByLabelText("生图模板")).not.toBeInTheDocument();
    expect(screen.getByLabelText("主图素材与补充说明")).toBeInTheDocument();
    const designReferenceCard = screen.getByLabelText("参考设计图");
    const productAssetCard = screen.getByLabelText("产品素材图");
    expect(designReferenceCard).toBeInTheDocument();
    expect(productAssetCard).toBeInTheDocument();
    // 两类图片使用完全相同的卡片骨架，避免主图页面出现两套视觉规范。
    expect(designReferenceCard.className).toBe(productAssetCard.className);
    expect(screen.getByRole("button", { name: "上传参考设计图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上传产品素材图" })).toBeInTheDocument();
    expect(screen.getByLabelText("主图补充要求")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "补充要求（选填）" })).toHaveAttribute("maxlength", "500");

    // 详情图展示 B2B 专属模板，同时继续保留商品图片与补充说明输入区。
    await user.click(screen.getByRole("button", { name: "详情图，8张每版" }));
    expect(screen.getByLabelText("生图模板")).toBeInTheDocument();
    expect(screen.getByText("采购决策详情")).toBeInTheDocument();
    expect(screen.getByLabelText("商品图片与补充说明")).toBeInTheDocument();

    // 套图和详情图维护独立默认选择，切回套图不会被详情图模板污染。
    await user.click(screen.getByRole("button", { name: "套图，6张每版" }));
    expect(screen.getByText("标准商品套图")).toBeInTheDocument();
  });

  it("主图可以分别上传参考设计图和自己的产品素材", async () => {
    const user = userEvent.setup();
    let objectUrlIndex = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      () => `blob:main-reference-${objectUrlIndex += 1}`,
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "主图，1张每版" }));

    const composer = screen.getByLabelText("主图素材与补充说明");
    const styleFile = new File(["style"], "reference-layout.png", { type: "image/png" });
    const productFile = new File(["product"], "my-product.jpg", { type: "image/jpeg" });

    fireEvent.change(within(composer).getByLabelText("选择参考设计图文件"), {
      target: { files: [styleFile] },
    });
    fireEvent.change(within(composer).getByLabelText("选择产品素材图文件"), {
      target: { files: [productFile] },
    });

    expect(within(composer).getByAltText("reference-layout.png")).toBeInTheDocument();
    expect(within(composer).getByAltText("my-product.jpg")).toBeInTheDocument();
    expect(within(composer).getByText("仅学习构图与风格，不复制商品和品牌")).toBeInTheDocument();
    expect(within(composer).getByText("1/6")).toBeInTheDocument();
  });

  it("把方案数量合并进真实生图参数区", () => {
    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    const parameters = screen.getByLabelText("真实生图参数");
    expect(within(parameters).getByText("完整方案数量")).toBeInTheDocument();
    expect(within(parameters).getByText("共 6 张")).toBeInTheDocument();
    expect(within(parameters).getByRole("combobox", { name: "完整方案数量" })).toHaveTextContent("10");
  });

  it("把 Logo 收进商品参考图标题旁的紧凑入口", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "添加 Logo" });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByText("批量加文字 / LOGO（选填）")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "添加品牌 Logo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Logo 显示位置")).toHaveValue("bottom-right");
    expect(screen.getByText("默认使用克制尺寸和安全边距，不遮挡商品主体。")).toBeInTheDocument();
  });

  it("在同一个输入区支持粘贴、拖入、查看和移除参考图", async () => {
    const user = userEvent.setup();
    let objectUrlIndex = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      () => `blob:reference-${objectUrlIndex += 1}`,
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    const composer = screen.getByLabelText("商品图片与补充说明");
    const textarea = screen.getByRole("textbox", { name: "补充文字要求（选填）" });
    expect(within(composer).getByText("优先输入")).toBeInTheDocument();
    expect(within(composer).getByText("图片决定商品主体，文字用于补充生成要求")).toBeInTheDocument();
    expect(within(composer).queryByText("可说明商品卖点、目标场景、画面风格或必须保留的细节")).not.toBeInTheDocument();
    const pastedFile = new File(["pasted"], "pasted-product.png", { type: "image/png" });

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [{
          kind: "file",
          type: "image/png",
          getAsFile: () => pastedFile,
        }],
      },
    });

    expect(within(composer).getByAltText("pasted-product.png")).toBeInTheDocument();
    await user.click(within(composer).getByRole("button", { name: "查看图片 pasted-product.png" }));
    const dialog = screen.getByRole("dialog", { name: "查看图片 pasted-product.png" });
    expect(within(dialog).getByAltText("pasted-product.png")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "关闭图片预览" }));

    await user.click(within(composer).getByRole("button", { name: "移除图片 pasted-product.png" }));
    expect(within(composer).queryByAltText("pasted-product.png")).not.toBeInTheDocument();

    const droppedFile = new File(["dropped"], "dropped-product.webp", { type: "image/webp" });
    fireEvent.drop(within(composer).getByRole("group", { name: "图片优先输入框" }), {
      dataTransfer: { files: [droppedFile] },
    });
    expect(within(composer).getByAltText("dropped-product.webp")).toBeInTheDocument();

    const fileInput = within(composer).getByLabelText("选择商品参考图文件");
    const inputClick = vi.spyOn(fileInput, "click");
    await user.click(within(composer).getByRole("button", { name: "上传商品参考图" }));
    expect(inputClick).toHaveBeenCalledOnce();

    const selectedFile = new File(["selected"], "selected-product.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [selectedFile] } });
    expect(within(composer).getByAltText("selected-product.jpg")).toBeInTheDocument();

    // 文字为空但已有参考图时允许直接提交，验证文字确实只是补充项。
    await user.click(screen.getByRole("button", { name: "开始生成 6 张" }));
    expect(screen.queryByText("请先上传商品参考图，或填写补充文字要求")).not.toBeInTheDocument();
  });

  it("结果区只保留六宫格并把必要信息上移到标题下方", () => {
    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    const generationInfo = screen.getByLabelText("任务生成信息");
    expect(generationInfo).toHaveTextContent("生图时间");
    expect(generationInfo).toHaveTextContent("模型");
    expect(generationInfo).toHaveTextContent("尺寸");
    expect(screen.getByRole("heading", { name: "生成记录" })).toBeInTheDocument();
    expect(screen.queryByLabelText("任务进度")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本次生成结果" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("结果视图")).not.toBeInTheDocument();
    expect(screen.queryByText("生成数量")).not.toBeInTheDocument();
    expect(screen.queryByText(/预计剩余/)).not.toBeInTheDocument();
    expect(screen.queryByText(/预计等待/)).not.toBeInTheDocument();
  });

  it("真实生图页默认选择 PTJ-1 并展示三个产品模型", () => {
    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("生图模型")).toHaveValue("gpt_image_2_openrouter");
    expect(screen.getByLabelText("生图模型")).toHaveTextContent("PTJ-1");
    expect(screen.getByLabelText("生图模型")).toHaveTextContent("PTJ-2");
    expect(screen.getByLabelText("生图模型")).toHaveTextContent("PTJ-3");
    expect(screen.getByLabelText("输出清晰度")).toHaveValue("medium");
  });

  it("为统一生图入口提供可预期的生图模板", () => {
    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    expect(screen.getByText("生图模板")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更换模板" })).toBeInTheDocument();
    expect(screen.getByText(/不填写也可以生成/)).toBeInTheDocument();
  });
});
