import type {
  GenerationCapabilities,
  GenerationStreamEvent,
  LiveGenerationRequest,
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

