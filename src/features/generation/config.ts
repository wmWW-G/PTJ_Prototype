import type { GenerationMode } from "../tasks/types";
import type { ImageType } from "../tasks/types";

/**
 * 页面级模式与持久化任务模式分离。
 *
 * `generate` 是统一生图入口；真正保存到任务里的 `text-to-image` 或
 * `image-to-image` 由后端根据是否存在参考图自动决定。
 */
export type GenerationPageMode =
  | "generate"
  | Extract<GenerationMode, "ai-retouch" | "outfit-swap">;

/**
 * 四种电商图片类型每次生成的基础张数。
 *
 * 当前业务规则：主图和海报各 1 张，套图 6 张，B2B 详情图 8 张。
 * 详情图以产品介绍、使用、品质与合作为主，避免增加真实参数填写负担。
 */
export const IMAGE_TYPE_RESULT_COUNTS: Record<ImageType, number> = {
  main: 1,
  set: 6,
  listing: 8,
  poster: 1,
};

export interface GenerationPageConfig {
  title: string;
  promptLabel: string;
  promptPlaceholder: string;
  uploadLabels: string[];
  hasImageTypes: boolean;
  hasBackground: boolean;
}

/** 三个业务入口的稳定字段配置，页面通过它复用同一套交互结构。 */
export const GENERATION_CONFIG: Record<GenerationPageMode, GenerationPageConfig> = {
  generate: {
    title: "批量生图",
    promptLabel: "补充文字要求（选填）",
    promptPlaceholder: "可补充：商品卖点、使用场景、画面风格，以及必须保留或避免的内容",
    uploadLabels: ["上传商品参考图（选填）"],
    hasImageTypes: true,
    hasBackground: true,
  },
  "ai-retouch": {
    title: "批量AI修图",
    promptLabel: "修图指令",
    promptPlaceholder: "描述需要修改的区域或目标效果",
    uploadLabels: ["上传需要修改的图片"],
    hasImageTypes: false,
    hasBackground: false,
  },
  "outfit-swap": {
    title: "批量模特换装",
    promptLabel: "文字描述（选填）",
    promptPlaceholder: "例如：保持模特姿势和五官，自然替换服装",
    uploadLabels: ["更换服装图", "模特图片"],
    hasImageTypes: true,
    hasBackground: false,
  },
};
