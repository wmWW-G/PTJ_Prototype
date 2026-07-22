import type {
  GenerationCapabilities,
  GenerationStreamEvent,
  LiveGenerationRequest,
  PlannedImagePrompt,
  PromptRefinementPayload,
  ReferenceAssetPayload,
} from "./liveTypes";

/** 构建阶段写入的后端地址；本地默认使用 FastAPI 端口。 */
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");

/** 带 HTTP 状态和后端详情的统一前端错误。 */
export class GenerationApiError extends Error {
  status: number;
  detail?: unknown;

  /**
   * 创建 API 错误。
   *
   * @param message 给页面和用户展示的简洁错误。
   * @param status HTTP 状态码；网络错误使用 0。
   * @param detail 后端返回的可选结构化详情。
   */
  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "GenerationApiError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * 尝试读取后端统一错误，不让 HTML 代理错误破坏页面。
 *
 * @param response 非 2xx fetch Response。
 * @returns 结构化前端错误。
 */
async function errorFromResponse(response: Response): Promise<GenerationApiError> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    const detail = payload.detail;
    const message =
      typeof detail === "string"
        ? detail
        : typeof detail === "object" && detail !== null && "message" in detail
          ? String((detail as { message: unknown }).message)
          : `请求失败（HTTP ${response.status}）`;
    return new GenerationApiError(message, response.status, detail);
  } catch {
    return new GenerationApiError(`请求失败（HTTP ${response.status}）`, response.status);
  }
}

/**
 * 读取后端模型、模板和上传能力。
 *
 * @param signal 可选取消信号。
 * @returns 后端动态能力表。
 * @throws GenerationApiError 网络或 HTTP 请求失败时抛出。
 */
export async function fetchGenerationCapabilities(
  signal?: AbortSignal,
): Promise<GenerationCapabilities> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/capabilities`, { signal });
  } catch (error) {
    throw new GenerationApiError(
      error instanceof Error ? error.message : "无法连接生图后端",
      0,
    );
  }
  if (!response.ok) throw await errorFromResponse(response);
  return (await response.json()) as GenerationCapabilities;
}

/**
 * 单独上传一张参考图，避免 multipart 生图请求超过 Vercel 4.5 MB 上限。
 *
 * @param file 浏览器 File 对象。
 * @param signal 可选取消信号。
 * @returns 可放入真实生图请求的 Blob 资产。
 * @throws GenerationApiError 文件不合法、存储失败或网络失败时抛出。
 */
export async function uploadReference(
  file: File,
  signal?: AbortSignal,
): Promise<ReferenceAssetPayload> {
  const form = new FormData();
  form.append("file", file);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/uploads`, {
      method: "POST",
      body: form,
      signal,
    });
  } catch (error) {
    throw new GenerationApiError(
      error instanceof Error ? error.message : "参考图上传失败",
      0,
    );
  }
  if (!response.ok) throw await errorFromResponse(response);
  return (await response.json()) as ReferenceAssetPayload;
}

/**
 * 解析可能被任意网络 chunk 拆分的 NDJSON 流。
 *
 * @param stream fetch Response.body。
 * @param onEvent 每解析出一条完整 JSON 时立即调用。
 * @throws GenerationApiError 某一行不是合法 JSON 时抛出。
 */
export async function parseNdjsonStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: GenerationStreamEvent) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let remainder = "";

  /** 解析单条完整非空行，并立即交给状态层。 */
  const parseLine = (line: string): void => {
    if (!line.trim()) return;
    try {
      onEvent(JSON.parse(line) as GenerationStreamEvent);
    } catch (error) {
      throw new GenerationApiError("后端返回了无效的流式事件", 502, {
        line,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    remainder += decoder.decode(value, { stream: !done });
    const lines = remainder.split("\n");
    remainder = lines.pop() ?? "";
    lines.forEach(parseLine);
    if (done) break;
  }
  parseLine(remainder);
}

/**
 * 提交真实生图并逐条消费 NDJSON 事件。
 *
 * @param request 完整统一生图请求。
 * @param onEvent 实时事件回调。
 * @param signal 用于页面卸载或用户取消。
 * @throws GenerationApiError 网络、HTTP 或流格式错误时抛出。
 */
export async function streamGeneration(
  request: LiveGenerationRequest,
  onEvent: (event: GenerationStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/generations/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    throw new GenerationApiError(
      error instanceof Error ? error.message : "生图请求无法连接后端",
      0,
    );
  }
  if (!response.ok) throw await errorFromResponse(response);
  if (!response.body) {
    throw new GenerationApiError("浏览器没有收到生图事件流", 502);
  }
  await parseNdjsonStream(response.body, onEvent);
}

/**
 * 只请求逐张 Prompt 规划，不进入真实图片生成路由。
 *
 * 使用独立地址是一道安全边界：新前端遇到尚未部署该路由的旧后端时，
 * 会明确失败，而不会因旧后端忽略新参数而误生图。后端仍会强制
 * `planning_only=true`，不把安全性寄托在前端传参上。
 *
 * @param request 待规划的统一生图请求。
 * @param onEvent 实时接收每个 `plan_ready` 事件的回调。
 * @param signal 页面卸载或用户取消时中止请求。
 * @throws GenerationApiError 网络、HTTP 或流格式错误时抛出。
 */
export async function streamPromptPlanning(
  request: LiveGenerationRequest,
  onEvent: (event: GenerationStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/generations/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, planning_only: true, confirmed_plans: [] }),
      signal,
    });
  } catch (error) {
    throw new GenerationApiError(
      error instanceof Error ? error.message : "Prompt 规划请求无法连接后端",
      0,
    );
  }
  if (!response.ok) throw await errorFromResponse(response);
  if (!response.body) {
    throw new GenerationApiError("浏览器没有收到 Prompt 规划事件流", 502);
  }
  await parseNdjsonStream(response.body, onEvent);
}

/**
 * 根据用户意见让文本 LLM 只重写一张图片的 Prompt。
 *
 * @param request 当前单张 Prompt、全局约束和用户改进意见。
 * @param signal 页面卸载或新请求开始时使用的取消信号。
 * @returns 保持原槽位序号、职责和标题的新 Prompt。
 * @throws GenerationApiError 网络、HTTP 或响应格式错误时抛出。
 */
export async function refineGenerationPrompt(
  request: PromptRefinementPayload,
  signal?: AbortSignal,
): Promise<PlannedImagePrompt> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/generations/refine-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    throw new GenerationApiError(
      error instanceof Error ? error.message : "Prompt 优化请求无法连接后端",
      0,
    );
  }
  if (!response.ok) throw await errorFromResponse(response);
  return (await response.json()) as PlannedImagePrompt;
}

/** 自定义模板单图生成时需要的最少输入。 */
export interface GenerateCustomTemplateImageOptions {
  /** 用户交给 AI 的自然语言修改或生图要求。 */
  instruction: string;
  /** 用户可选上传的一张商品参考图；缺省时执行纯文字生图。 */
  referenceFile?: File | null;
  /** 页面卸载或用户取消时中止上传与生图。 */
  signal?: AbortSignal;
}

/**
 * 构建自定义模板编辑器专用的单图请求。
 *
 * 该入口刻意固定 GPT-Image-2、1:1、1K 和低质量，避免在简洁编辑器中暴露
 * 一组用户并不需要理解的模型参数。界面中的“低”同时映射为后端支持的
 * `resolution=1K` 与 `quality=low`。
 *
 * @param instruction 用户输入的自然语言要求；函数会移除首尾空白。
 * @param referenceAsset 可选的已上传参考图；存在时后端自动走图生图。
 * @returns 可直接交给统一 NDJSON 生图接口的请求。
 * @throws GenerationApiError 用户没有输入有效文字时抛出 400 错误。
 */
export function buildCustomTemplateImageRequest(
  instruction: string,
  referenceAsset?: ReferenceAssetPayload,
): LiveGenerationRequest {
  const normalizedInstruction = instruction.trim();
  if (!normalizedInstruction) {
    throw new GenerationApiError("请先告诉 AI 想怎么生成或修改", 400);
  }

  return {
    image_type: "main",
    template_id: "main_01",
    visual_template_id: "standard_product",
    model: "gpt_image_2_openrouter",
    aspect_ratio: "1:1",
    resolution: "1K",
    quality: "low",
    language: "zh-CN",
    variant_count: 1,
    user_requirement: normalizedInstruction,
    supplemental_info: {},
    reference_assets: referenceAsset ? [referenceAsset] : [],
  };
}

/**
 * 使用真实 GPT-Image-2 链路生成一张自定义模板候选图。
 *
 * 有附图时先上传为受控资产，再由后端根据 `reference_assets` 自动选择图生图；
 * 没有附图时直接执行文生图。收到第一条真实成图事件后立即返回图片地址，不再
 * 等待任务收尾事件或服务器关闭 NDJSON 流；剩余流仍在后台安全消费，避免中断
 * 后端收尾工作。失败事件不会被当成成功结果。
 *
 * @param options 自然语言、可选参考图和取消信号。
 * @returns 后端完成事件中的图片 URL。
 * @throws GenerationApiError 上传失败、生图失败或事件流没有结果时抛出。
 */
export async function generateCustomTemplateImage(
  options: GenerateCustomTemplateImageOptions,
): Promise<string> {
  const referenceAsset = options.referenceFile
    ? await uploadReference(options.referenceFile, options.signal)
    : undefined;
  const request = buildCustomTemplateImageRequest(options.instruction, referenceAsset);

  return await new Promise<string>((resolve, reject) => {
    // Promise 一旦交付成图或错误就不再改变；后台流的后续事件仍会被正常解析。
    let settled = false;

    void streamGeneration(request, (event) => {
      if (
        !settled
        && (event.type === "anchor_completed" || event.type === "image_completed")
        && event.image_url
      ) {
        settled = true;
        resolve(event.image_url);
        return;
      }
      if (!settled && (event.type === "image_failed" || event.type === "job_failed")) {
        settled = true;
        reject(new GenerationApiError(
          event.message || "GPT-Image-2 生图失败，请重试",
          502,
        ));
      }
    }, options.signal).then(() => {
      if (settled) return;
      settled = true;
      reject(new GenerationApiError("生图任务已结束，但没有返回图片", 502));
    }).catch((error: unknown) => {
      // 成图已经交给页面后，流式连接的收尾异常不应让已显示结果突然消失。
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}
