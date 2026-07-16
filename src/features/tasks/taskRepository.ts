import { DEMO_TASKS } from "./mockTasks";
import type { CreateTaskInput, GenerationTask } from "./types";

/** LocalStorage 中保存原型历史任务的固定键名。 */
export const STORAGE_KEY = "ptj.prototype.tasks.v2";
/** 保存任务后用于通知应用外壳刷新的浏览器事件名。 */
export const TASKS_UPDATED_EVENT = "ptj:tasks-updated";

/**
 * 返回全新的演示任务副本，防止调用方意外修改模块常量。
 */
function cloneDemoTasks(): GenerationTask[] {
  return DEMO_TASKS.map((task) => ({
    ...task,
    sourceImages: [...task.sourceImages],
    modelImages: [...task.modelImages],
    garmentImages: [...task.garmentImages],
    resultImages: [...task.resultImages],
    liveImages: task.liveImages.map((image) => ({ ...image })),
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 图片类型到默认服务器模板的稳定映射。 */
const DEFAULT_TEMPLATE_IDS: Record<GenerationTask["imageType"], string> = {
  main: "main_01",
  set: "product_set_01",
  listing: "listing_01",
  poster: "poster_01",
};

/**
 * 为旧 LocalStorage 任务补齐真实生图字段。
 *
 * @param task 可能来自 v2 旧结构的不完整任务。
 * @returns 满足当前 GenerationTask 接口的兼容对象。
 */
function normalizeTask(task: Partial<GenerationTask> & Pick<GenerationTask, "id" | "mode" | "prompt" | "imageType" | "createdAt">): GenerationTask {
  return {
    id: task.id,
    mode: task.mode,
    imageType: task.imageType,
    retouchMode: task.retouchMode,
    prompt: task.prompt,
    model: task.model ?? "Ptu1.0",
    aspectRatio: task.aspectRatio ?? "1:1",
    templateId: task.templateId ?? DEFAULT_TEMPLATE_IDS[task.imageType],
    resolution: task.resolution ?? "2K",
    quality: task.quality ?? "medium",
    variantCount: task.variantCount ?? task.quantity ?? 1,
    quantity: task.quantity ?? 1,
    sourceImages: task.sourceImages ?? [],
    modelImages: task.modelImages ?? [],
    garmentImages: task.garmentImages ?? [],
    resultImages: task.resultImages ?? [],
    liveImages: task.liveImages ?? [],
    actualSize: task.actualSize,
    providerMetadata: task.providerMetadata,
    status: task.status ?? "queued",
    createdAt: task.createdAt,
  };
}

/**
 * 读取全部生成任务。
 *
 * @returns 按创建时间从新到旧排列的任务数组。
 * @throws 不主动抛出异常；存储损坏时会记录警告并回退到演示数据。
 */
export function listTasks(): GenerationTask[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDemoTasks();

  try {
    const parsed = JSON.parse(raw) as Array<Partial<GenerationTask> & Pick<GenerationTask, "id" | "mode" | "prompt" | "imageType" | "createdAt">>;
    if (!Array.isArray(parsed)) throw new TypeError("任务存储不是数组");
    return parsed.map(normalizeTask).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.warn("[批图匠] 历史任务读取失败，已回退到演示数据", error);
    return cloneDemoTasks();
  }
}

/**
 * 根据任务 ID 查找单条任务。
 *
 * @param id 任务唯一 ID。
 * @returns 找到时返回任务，未找到时返回 undefined。
 */
export function getTask(id: string): GenerationTask | undefined {
  return listTasks().find((task) => task.id === id);
}

/**
 * 新增或覆盖一条任务，并把结果写入 LocalStorage。
 *
 * @param task 要保存的完整任务。
 * @returns 保存后的任务。
 * @throws 浏览器禁用存储或容量不足时，localStorage 可能抛出异常。
 */
export function saveTask(task: GenerationTask): GenerationTask {
  const tasks = listTasks().filter((item) => item.id !== task.id);
  tasks.unshift(task);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TASKS_UPDATED_EVENT));
  console.info("[批图匠] 任务已保存", { id: task.id, status: task.status });
  return task;
}

/**
 * 根据表单输入创建一条尚未生成的原型任务。
 *
 * @param input 页面收集到的业务参数。
 * @returns 带默认参数和唯一 ID 的任务对象。
 */
export function createMockTask(input: CreateTaskInput): GenerationTask {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode: input.mode,
    imageType: input.imageType ?? "main",
    retouchMode: input.retouchMode,
    prompt: input.prompt,
    model: input.model ?? "Ptu1.0",
    aspectRatio: input.aspectRatio ?? "1:1",
    templateId: input.templateId ?? DEFAULT_TEMPLATE_IDS[input.imageType ?? "main"],
    resolution: input.resolution ?? "2K",
    quality: input.quality ?? "medium",
    variantCount: input.variantCount ?? input.quantity ?? 1,
    quantity: input.quantity ?? 1,
    sourceImages: input.sourceImages ?? [],
    modelImages: input.modelImages ?? [],
    garmentImages: input.garmentImages ?? [],
    resultImages: input.resultImages ?? [],
    liveImages: input.liveImages ?? [],
    actualSize: input.actualSize,
    providerMetadata: input.providerMetadata,
    status: "generating",
    createdAt: new Date().toISOString(),
  };
}
