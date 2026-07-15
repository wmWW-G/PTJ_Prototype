import type { GenerationMode } from "../tasks/types";
import type { ImageType } from "../tasks/types";

/**
 * 四种电商图片类型每次生成的基础张数。
 *
 * 这是原站真实业务规则：主图和海报各 1 张，套图 6 张，详情图 5 张。
 */
export const IMAGE_TYPE_RESULT_COUNTS: Record<ImageType, number> = {
  main: 1,
  set: 6,
  listing: 5,
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

/** 四种业务页的稳定字段配置，页面通过它复用同一套交互结构。 */
export const GENERATION_CONFIG: Record<GenerationMode, GenerationPageConfig> = {
  "text-to-image": {
    title: "批量文生图",
    promptLabel: "产品+卖点",
    promptPlaceholder: "例如：陶瓷马克杯，防烫手柄，北欧简约风",
    uploadLabels: [],
    hasImageTypes: true,
    hasBackground: false,
  },
  "image-to-image": {
    title: "批量图生图",
    promptLabel: "产品+卖点",
    promptPlaceholder: "描述希望保留的商品特征和需要优化的画面",
    uploadLabels: ["上传商品参考图"],
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
