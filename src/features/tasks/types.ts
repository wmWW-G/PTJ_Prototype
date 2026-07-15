/** 批图匠支持的四种核心生成模式。 */
export type GenerationMode =
  | "text-to-image"
  | "image-to-image"
  | "ai-retouch"
  | "outfit-swap";

/** 生成图片在电商页面中的用途。 */
export type ImageType = "main" | "set" | "listing" | "poster";

/** AI 修图页面的专用处理模式。 */
export type RetouchMode = "watermark" | "copy" | "cutout";

/** 单条生成任务的完整持久化结构。 */
export interface GenerationTask {
  id: string;
  mode: GenerationMode;
  imageType: ImageType;
  retouchMode?: RetouchMode;
  prompt: string;
  model: string;
  aspectRatio: string;
  quantity: number;
  sourceImages: string[];
  modelImages: string[];
  garmentImages: string[];
  resultImages: string[];
  status: "queued" | "generating" | "completed" | "failed";
  createdAt: string;
}

/** 创建原型任务时允许调用方传入的字段。 */
export type CreateTaskInput = Pick<GenerationTask, "mode" | "prompt"> &
  Partial<
    Omit<GenerationTask, "id" | "mode" | "prompt" | "createdAt" | "status">
  >;
