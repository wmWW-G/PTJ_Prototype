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
  /** 服务器模板 ID，决定一版图片的固定槽位。 */
  templateId: string;
  /** 视觉模板 ID，决定整套风格、信息密度和可选补充字段。 */
  visualTemplateId?: string;
  /** 用户针对视觉模板填写的可验证信息；所有字段均可留空。 */
  supplementalInfo?: Record<string, string>;
  /** 统一分辨率档位，由后端 Adapter 转换为供应商参数。 */
  resolution: "1K" | "2K" | "4K";
  /** Azure 独立质量参数；Google 模型会忽略。 */
  quality: "low" | "medium" | "high";
  /** 完整生成几版，不是单版图片张数。 */
  variantCount: number;
  quantity: number;
  sourceImages: string[];
  modelImages: string[];
  garmentImages: string[];
  resultImages: string[];
  /** 流式任务的逐张结果，便于历史页保留真实元数据。 */
  liveImages: Array<{
    variantIndex: number;
    imageIndex: number;
    role: string;
    /** 视觉模板为当前图片指定的用户可读职责名称。 */
    title?: string;
    status: string;
    imageUrl?: string;
    actualSize?: string;
    retryCount?: number;
    error?: string;
  }>;
  /** Azure 动态换算后的实际尺寸，例如 2880x2880。 */
  actualSize?: string;
  /** 不含密钥的供应商请求元数据。 */
  providerMetadata?: Record<string, unknown>;
  status:
    | "queued"
    | "generating"
    | "completed"
    | "partial_success"
    | "failed";
  createdAt: string;
}

/** 创建原型任务时允许调用方传入的字段。 */
export type CreateTaskInput = Pick<GenerationTask, "mode" | "prompt"> &
  Partial<
    Omit<GenerationTask, "id" | "mode" | "prompt" | "createdAt" | "status">
  >;
