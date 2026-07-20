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

/** 用户希望 Logo 出现在成图中的位置。 */
export type LogoPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

/** 用户从同类预设模板中选中的一条图片职责来源。 */
export interface CustomVisualRoleSelection {
  /** 后端登记的来源视觉模板 ID。 */
  template_id: string;
  /** 职责在来源模板中的零基下标。 */
  role_index: number;
}

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
  /** 自定义模板的职责顺序；普通预设模板保持为空。 */
  customVisualRoles?: CustomVisualRoleSelection[];
  /** 用户针对视觉模板填写的可验证信息；所有字段均可留空。 */
  supplementalInfo?: Record<string, string>;
  /** 统一分辨率档位，由后端 Adapter 转换为供应商参数。 */
  resolution: "512" | "1K" | "2K" | "4K";
  /** OpenRouter GPT-Image-2 的质量参数；Google 模型会忽略。 */
  quality: "low" | "medium" | "high";
  /** 完整生成几版，不是单版图片张数。 */
  variantCount: number;
  quantity: number;
  /** 主图参考设计图，只用于构图与风格参考。 */
  styleImages?: string[];
  /** 用户自己的产品素材图，决定商品主体外观。 */
  sourceImages: string[];
  /** 可选品牌 Logo 的受控资源地址；旧任务可能没有该字段。 */
  logoImage?: string;
  /** Logo 在最终画面中的目标位置。 */
  logoPosition?: LogoPosition;
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
  /** 供应商返回的实际尺寸；无法识别时不填写。 */
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
