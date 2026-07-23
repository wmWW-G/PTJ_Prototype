import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationPageMode } from "./config";
import { IMAGE_TYPE_RESULT_COUNTS } from "./config";
import { GenerationPage } from "./GenerationPage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** 把后端事件包装成浏览器 fetch 可消费的 NDJSON Response。 */
function ndjsonResponse(events: object[]): Response {
  const body = events.map((event) => JSON.stringify(event)).join("\n") + "\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

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

  it("套图和详情图各自展示高信息量默认模板，主图使用设计参考与产品素材双输入", async () => {
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
    expect(screen.getByText("高信息量采购详情")).toBeInTheDocument();
    expect(screen.getByLabelText("商品图片与补充说明")).toBeInTheDocument();

    // 套图和详情图维护独立默认选择，切回套图不会被详情图模板污染。
    await user.click(screen.getByRole("button", { name: "套图，6张每版" }));
    expect(screen.getByText("高信息量商品套图")).toBeInTheDocument();
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

  it("套图可单独上传参考设计图，并与商品素材隔离提交为图生图输入", async () => {
    const user = userEvent.setup();
    let uploadIndex = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/capabilities")) return new Response("{}", { status: 503 });
      if (url.endsWith("/api/uploads")) {
        uploadIndex += 1;
        return new Response(JSON.stringify({
          url: `https://blob.example/reference-${uploadIndex}.png`,
          mime_type: "image/png",
          filename: `reference-${uploadIndex}.png`,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/api/generations/plan")) {
        return ndjsonResponse([
          { type: "job_started", job_id: "plan-job", status: "planning" },
          {
            type: "plan_ready",
            job_id: "plan-job",
            variant_index: 1,
            data: {
              plan: {
                global_consistency_prompt: "保持商品一致",
                image_prompts: Array.from({ length: 6 }, (_, index) => ({
                  index: index + 1,
                  role: `role_${index + 1}`,
                  prompt: `第 ${index + 1} 张`,
                })),
              },
            },
          },
          { type: "job_completed", job_id: "plan-job", status: "planned" },
        ]);
      }
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:style-reference");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    render(<MemoryRouter><GenerationPage mode="generate" /></MemoryRouter>);

    const composer = screen.getByLabelText("商品图片与补充说明");
    const styleFile = new File(["style"], "set-layout.png", { type: "image/png" });
    fireEvent.change(within(composer).getByLabelText("选择参考设计图文件"), {
      target: { files: [styleFile] },
    });
    expect(within(composer).getByLabelText("参考设计图")).toBeInTheDocument();
    expect(within(composer).getByAltText("set-layout.png")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "生成 Prompt" }));
    await screen.findByLabelText("生图 Prompt 确认");

    const planningBody = fetchMock.mock.calls
      .filter(([input]) => String(input).endsWith("/api/generations/plan"))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)))
      .at(0);
    expect(planningBody).toMatchObject({
      style_reference_assets: [expect.objectContaining({ url: "https://blob.example/reference-1.png" })],
      reference_assets: [],
    });
  });

  it("套图同时上传商品图和风格图时，两个受控资产数组严格隔离", async () => {
    const user = userEvent.setup();
    let uploadIndex = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/capabilities")) return new Response("{}", { status: 503 });
      if (url.endsWith("/api/uploads")) {
        uploadIndex += 1;
        return new Response(JSON.stringify({
          url: `https://blob.example/reference-${uploadIndex}.png`,
          mime_type: "image/png",
          filename: `reference-${uploadIndex}.png`,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/api/generations/plan")) {
        return ndjsonResponse([
          { type: "job_started", job_id: "plan-job", status: "planning" },
          { type: "plan_ready", job_id: "plan-job", variant_index: 1, data: { plan: { global_consistency_prompt: "保持商品一致", image_prompts: Array.from({ length: 6 }, (_, index) => ({ index: index + 1, role: `role_${index + 1}`, prompt: `第 ${index + 1} 张` })) } } },
          { type: "job_completed", job_id: "plan-job", status: "planned" },
        ]);
      }
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:separated-reference");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    render(<MemoryRouter><GenerationPage mode="generate" /></MemoryRouter>);

    const composer = screen.getByLabelText("商品图片与补充说明");
    fireEvent.change(within(composer).getByLabelText("选择参考设计图文件"), {
      target: { files: [new File(["style"], "layout.png", { type: "image/png" })] },
    });
    fireEvent.change(within(composer).getByLabelText("选择商品参考图文件"), {
      target: { files: [new File(["product"], "cap.png", { type: "image/png" })] },
    });
    await user.click(screen.getByRole("button", { name: "生成 Prompt" }));
    await screen.findByLabelText("生图 Prompt 确认");

    const planningBody = fetchMock.mock.calls
      .filter(([input]) => String(input).endsWith("/api/generations/plan"))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)))
      .at(0);
    expect(planningBody).toMatchObject({
      reference_assets: [expect.objectContaining({ url: "https://blob.example/reference-1.png" })],
      style_reference_assets: [expect.objectContaining({ url: "https://blob.example/reference-2.png" })],
    });
    expect(planningBody.reference_assets[0].url).not.toBe(planningBody.style_reference_assets[0].url);
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

  it("把 Logo 收进紧凑入口，并在成功添加后自动关闭设置面板", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:brand-logo");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "添加 Logo" });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByText("批量加文字 / LOGO（选填）")).not.toBeInTheDocument();

    await user.click(trigger);
    const logoDialog = screen.getByRole("dialog", { name: "添加品牌 Logo" });
    expect(logoDialog).toBeInTheDocument();
    expect(trigger.parentElement).toContainElement(logoDialog);
    expect(screen.getByLabelText("Logo 显示位置")).toHaveValue("bottom-right");
    expect(screen.getByText("默认使用克制尺寸和安全边距，不遮挡商品主体。")).toBeInTheDocument();

    const logoFile = new File(["logo"], "brand-logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("选择 Logo 文件"), {
      target: { files: [logoFile] },
    });

    expect(screen.queryByRole("dialog", { name: "添加品牌 Logo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logo 已添加" })).toBeInTheDocument();
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
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
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
    await user.click(screen.getByRole("button", { name: "生成 Prompt" }));
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

  it("先展示逐张 Prompt，用户确认前不开始真实生图", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/capabilities")) return new Response("{}", { status: 503 });
      if (url.endsWith("/api/generations/plan")) {
        return ndjsonResponse([
          { type: "job_started", job_id: "plan-job", status: "planning" },
          {
            type: "plan_ready",
            job_id: "plan-job",
            variant_index: 1,
            status: "ready",
            data: {
              plan: {
                global_consistency_prompt: "整套保持同一商品与橙白配色",
                image_prompts: Array.from({ length: 6 }, (_, index) => ({
                  index: index + 1,
                  role: `role_${index + 1}`,
                  title: index === 0 ? "商品主视觉" : `第 ${index + 1} 张`,
                  prompt: index === 0 ? "白底居中展示商品主视觉" : `生成第 ${index + 1} 张商品图`,
                  visible_text: index === 0 ? ["透气面料", "可调节帽围", "支持 Logo 定制"] : [],
                  information_units: index === 0 ? Array.from({ length: 7 }, (_, unitIndex) => ({
                    kind: unitIndex === 0 ? "hero" : "label",
                    content: `信息模块 ${unitIndex + 1}`,
                    source: "verified_input",
                  })) : undefined,
                })),
              },
            },
          },
          { type: "job_completed", job_id: "plan-job", status: "planned" },
        ]);
      }
      throw new Error("确认前不应调用真实生图");
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );
    await user.type(screen.getByRole("textbox", { name: "补充文字要求（选填）" }), "白色咖啡杯");
    await user.click(screen.getByRole("button", { name: /生成 Prompt|开始生成 6 张/ }));

    const review = await screen.findByLabelText("生图 Prompt 确认");
    expect(within(review).getByText("白底居中展示商品主视觉")).toBeInTheDocument();
    expect(within(review).getByText("7 个信息单元 · 3 条画面文案")).toBeInTheDocument();
    expect(within(review).queryByText("verified_input")).not.toBeInTheDocument();
    expect(within(review).getByRole("button", { name: "确认 Prompt，开始生成 6 张" })).toBeInTheDocument();
    const generationBodies = fetchMock.mock.calls
      .filter((call) => String(call[0]).includes("/api/generations/plan"))
      .map((call) => JSON.parse(String(call[1]?.body)) as { planning_only?: boolean });
    expect(generationBodies).toEqual([expect.objectContaining({ planning_only: true })]);
  });

  it("可以只给不满意的一张填写意见并让 AI 重写 Prompt", async () => {
    const user = userEvent.setup();
    let streamCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/capabilities")) return new Response("{}", { status: 503 });
      if (url.endsWith("/api/generations/refine-prompt")) {
        return new Response(JSON.stringify({
          index: 1,
          role: "hero",
          title: "商品主视觉",
          prompt: "改为俯拍构图，并增加三种颜色",
          negative_prompt: "不要改变商品结构",
          visible_text: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      streamCalls += 1;
      if (streamCalls === 1) {
        return ndjsonResponse([
          { type: "job_started", job_id: "plan-job", status: "planning" },
          {
            type: "plan_ready",
            job_id: "plan-job",
            variant_index: 1,
            data: {
              plan: {
                global_consistency_prompt: "保持商品一致",
                image_prompts: [{
                  index: 1,
                  role: "hero",
                  title: "商品主视觉",
                  prompt: "正面居中展示商品",
                }],
              },
            },
          },
          { type: "job_completed", job_id: "plan-job", status: "planned" },
        ]);
      }
      return ndjsonResponse([
        { type: "job_started", job_id: "image-job", status: "generating" },
        { type: "job_completed", job_id: "image-job", status: "completed", data: { completed: 0, failed: 0 } },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <GenerationPage mode="generate" />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "主图，1张每版" }));
    await user.type(screen.getByRole("textbox", { name: "补充要求（选填）" }), "棒球帽");
    await user.click(screen.getByRole("button", { name: /生成 Prompt|开始生成 1 张/ }));

    const review = await screen.findByLabelText("生图 Prompt 确认");
    await user.click(within(review).getByRole("button", { name: "修改第 1 张 Prompt" }));
    await user.type(within(review).getByRole("textbox", { name: "第 1 张改进意见" }), "改成俯拍，并展示三种颜色");
    await user.click(within(review).getByRole("button", { name: "AI 重新优化第 1 张 Prompt" }));

    expect(await within(review).findByText("改为俯拍构图，并增加三种颜色")).toBeInTheDocument();
    await user.click(within(review).getByRole("button", { name: "确认 Prompt，开始生成 1 张" }));

    const executeCall = fetchMock.mock.calls.find((call) => {
      if (!String(call[0]).includes("/api/generations/stream")) return false;
      const body = JSON.parse(String(call[1]?.body)) as { confirmed_plans?: unknown[] };
      return Array.isArray(body.confirmed_plans);
    });
    expect(executeCall).toBeDefined();
    const executeBody = JSON.parse(String(executeCall?.[1]?.body)) as {
      confirmed_plans: Array<{ image_prompts: Array<{ prompt: string }> }>;
    };
    expect(executeBody.confirmed_plans[0].image_prompts[0].prompt).toBe("改为俯拍构图，并增加三种颜色");
  });
});
