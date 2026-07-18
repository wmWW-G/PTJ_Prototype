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
      listing: 5,
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

  it("移除 Logo 区域", () => {
    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    expect(screen.queryByText("批量加文字 / LOGO（选填）")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Logo 文字")).not.toBeInTheDocument();
    expect(screen.queryByText("上传 LOGO")).not.toBeInTheDocument();
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
