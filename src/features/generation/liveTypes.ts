/** 后端支持的真实图片模型。 */
export type LiveImageModel =
  | "nano_banana_2"
  | "nano_banana_pro"
  | "gpt_image_2_azure";

/** 后端结构化 Prompt 中的单张图片计划。 */
export interface PlannedImagePrompt {
  index: number;
  role: string;
  /** 当前视觉模板为该槽位指定的用户可读职责名称。 */
  title?: string;
  prompt: string;
  negative_prompt?: string;
  visible_text?: string[];
}

/** 后端返回的完整单版 Prompt 计划。 */
export interface PromptPlanPayload {
  global_consistency_prompt: string;
  image_prompts: PlannedImagePrompt[];
}

/** 上传成功后由 Vercel Blob 返回的受控参考图。 */
export interface ReferenceAssetPayload {
  url: string;
  mime_type: "image/png" | "image/jpeg" | "image/webp";
  filename: string;
}

/** 提交给 FastAPI 的真实生图请求。 */
export interface LiveGenerationRequest {
  mode: "text-to-image" | "image-to-image";
  image_type: "main" | "set" | "listing" | "poster";
  template_id: string;
  visual_template_id: string;
  model: LiveImageModel;
  aspect_ratio: string;
  resolution: "1K" | "2K" | "4K";
  quality?: "low" | "medium" | "high";
  language?: string;
  variant_count: number;
  user_requirement: string;
  supplemental_info: Record<string, string>;
  reference_assets: ReferenceAssetPayload[];
}

/** NDJSON 中的统一事件；未知 type 会被前端安全忽略。 */
export interface GenerationStreamEvent {
  type: string;
  job_id: string;
  variant_index?: number;
  image_index?: number;
  status?: string;
  message?: string;
  image_url?: string;
  data?: Record<string, unknown>;
}

/** Capabilities 接口中的单模型动态控件定义。 */
export interface ModelCapability {
  label: string;
  aspect_ratios: string[];
  resolutions: Array<"1K" | "2K" | "4K">;
  quality: boolean;
  qualities?: Array<"low" | "medium" | "high">;
  preview_resolutions?: string[];
}

/** Capabilities 接口中单个服务器模板定义。 */
export interface TemplateCapability {
  name: string;
  image_type: LiveGenerationRequest["image_type"];
  slot_count: number;
  slots: Array<{
    index: number;
    role: string;
    title: string;
    objective: string;
    composition: string;
    text_policy: string;
  }>;
}

/** 视觉模板中一条用户可选补充信息。 */
export interface VisualTemplateFieldCapability {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
}

/** 控制整套预期风格、信息密度和动态字段的视觉模板。 */
export interface VisualTemplateCapability {
  id: string;
  name: string;
  category: string;
  description: string;
  art_direction: string;
  information_focus: string[];
  role_highlights: string[];
  preview_images: string[];
  fields: VisualTemplateFieldCapability[];
}

/** 前端动态表单需要的完整服务能力。 */
export interface GenerationCapabilities {
  models: Record<LiveImageModel, ModelCapability>;
  templates: Record<string, TemplateCapability>;
  visual_templates: Record<string, VisualTemplateCapability>;
  uploads: {
    max_file_bytes: number;
    max_files: number;
    mime_types: string[];
  };
  max_variant_count: number;
  max_output_images: number;
}

/** 实时控制台中的单张图片状态。 */
export interface LiveImageState {
  index: number;
  role: string;
  /** 优先于通用 role 映射展示，例如“研发与定制”。 */
  title?: string;
  status: "waiting" | "generating" | "retrying" | "completed" | "failed";
  imageUrl?: string;
  actualSize?: string;
  elapsedMs?: number;
  retryCount: number;
  error?: string;
}

/** 一整版图片的状态。 */
export interface LiveVariantState {
  index: number;
  status: string;
  plan?: PromptPlanPayload;
  images: Record<number, LiveImageState>;
}

/** 一次真实任务在前端的可归并状态。 */
export interface LiveGenerationState {
  jobId?: string;
  status:
    | "idle"
    | "planning"
    | "generating"
    | "completed"
    | "partial_success"
    | "failed";
  message?: string;
  variants: Record<number, LiveVariantState>;
  resultImages: string[];
  completedCount: number;
  failedCount: number;
}
