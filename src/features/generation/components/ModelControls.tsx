import { ChevronDown } from "lucide-react";
import {
  LIVE_MODEL_DISPLAY_NAMES,
  LIVE_MODEL_DISPLAY_ORDER,
  type LiveImageModel,
  type ModelCapability,
} from "../liveTypes";
import styles from "../GenerationPage.module.css";

/** 没连上后端时仍能展示表单的安全能力快照；真实提交不会因此回退 Mock。 */
export const DEFAULT_MODEL_CAPABILITIES: Record<LiveImageModel, ModelCapability> = {
  nano_banana_2: {
    label: "PTJ-2",
    aspect_ratios: ["1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"],
    resolutions: ["512", "1K", "2K", "4K"],
    quality: false,
    preview_resolutions: ["4K"],
  },
  nano_banana_pro: {
    label: "PTJ-3",
    aspect_ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    resolutions: ["1K", "2K", "4K"],
    quality: false,
    preview_resolutions: ["4K"],
  },
  gpt_image_2_openrouter: {
    label: "PTJ-1",
    aspect_ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "1:2", "2:1", "9:21", "21:9", "1:3", "3:1"],
    resolutions: ["1K", "2K", "4K"],
    quality: true,
    qualities: ["low", "medium", "high"],
  },
};

/**
 * GPT-Image-2 只向用户展示一个“清晰度”选择器。
 *
 * OpenRouter 的 GPT-Image-2 端点支持 low/medium/high 质量，但当前能力记录
 * 没有 resolution 字段。前端继续同步保存 1K/2K/4K，后端只发送受支持的
 * quality，并把档位作为提示词中的细节意图。
 */
const GPT_CLARITY_OPTIONS = [
  { value: "low", label: "低", resolution: "1K" },
  { value: "medium", label: "中", resolution: "2K" },
  { value: "high", label: "高", resolution: "4K" },
] as const;

/** 模型控件的受控值。 */
export interface ModelControlValue {
  model: LiveImageModel;
  aspectRatio: string;
  resolution: "512" | "1K" | "2K" | "4K";
  quality: "low" | "medium" | "high";
}

interface ModelControlsProps {
  value: ModelControlValue;
  onChange: (value: ModelControlValue) => void;
  variantCount: number;
  imagesPerVariant: number;
  onVariantCountChange: (value: number) => void;
  maxVariantCount?: number;
  capabilities?: Record<LiveImageModel, ModelCapability>;
}

/**
 * 根据当前模型能力动态展示模型、比例、分辨率和 OpenRouter 质量。
 *
 * @param props.value 当前受控值。
 * @param props.onChange 任一字段变化后的完整值回调。
 * @param props.variantCount 完整方案数量。
 * @param props.imagesPerVariant 当前图片类型每版固定生成张数。
 * @param props.onVariantCountChange 方案数量更新回调。
 * @param props.maxVariantCount 后端允许的最大方案数量，默认 10。
 * @param props.capabilities 后端返回的动态模型能力；缺失时使用只读快照。
 * @returns 真实生图参数控件。
 */
export function ModelControls({
  value,
  onChange,
  variantCount,
  imagesPerVariant,
  onVariantCountChange,
  maxVariantCount = 10,
  capabilities = DEFAULT_MODEL_CAPABILITIES,
}: ModelControlsProps) {
  const capability = capabilities[value.model] ?? DEFAULT_MODEL_CAPABILITIES[value.model];
  const isGptImage = value.model === "gpt_image_2_openrouter";

  /** 切换模型并纠正新模型不支持的当前值。 */
  function changeModel(model: LiveImageModel) {
    const next = capabilities[model] ?? DEFAULT_MODEL_CAPABILITIES[model];
    const gptResolution = GPT_CLARITY_OPTIONS.find(
      (option) => option.value === value.quality,
    )?.resolution;
    onChange({
      ...value,
      model,
      aspectRatio: next.aspect_ratios.includes(value.aspectRatio)
        ? value.aspectRatio
        : "1:1",
      resolution:
        model === "gpt_image_2_openrouter"
          ? (gptResolution ?? "2K")
          : next.resolutions.includes(value.resolution)
            ? value.resolution
            : (next.resolutions[0] ?? "1K"),
    });
  }

  /**
   * 更新唯一的清晰度控件。
   *
   * Google 模型直接更新 512/1K/2K/4K；GPT-Image-2 则把低/中/高同时映射到
   * 内部的 resolution 与 quality，避免再渲染一个“生成质量”控件。
   */
  function changeClarity(nextValue: string) {
    if (!isGptImage) {
      onChange({
        ...value,
        resolution: nextValue as ModelControlValue["resolution"],
      });
      return;
    }

    const option = GPT_CLARITY_OPTIONS.find((item) => item.value === nextValue);
    if (!option) return;
    onChange({
      ...value,
      resolution: option.resolution,
      quality: option.value,
    });
  }

  return (
    <section className={styles.modelControls} aria-label="真实生图参数">
      <div className={styles.modelControlGrid}>
        <label className={styles.controlBlock}>
          <span className={styles.fieldLabel}>画面比例</span>
          <span className={styles.selectWrap}>
            <select
              aria-label="画面比例"
              value={value.aspectRatio}
              onChange={(event) => onChange({ ...value, aspectRatio: event.target.value })}
            >
              {capability.aspect_ratios.map((ratio) => (
                <option key={ratio} value={ratio}>{ratio}</option>
              ))}
            </select>
            <ChevronDown size={16} />
          </span>
        </label>

        <label className={styles.controlBlock}>
          <span className={styles.fieldLabel}>生图模型</span>
          <span className={styles.selectWrap}>
            <select
              aria-label="生图模型"
              value={value.model}
              onChange={(event) => changeModel(event.target.value as LiveImageModel)}
            >
              {LIVE_MODEL_DISPLAY_ORDER
                .filter((model) => Boolean(capabilities[model]))
                .map((model) => (
                  <option key={model} value={model}>{LIVE_MODEL_DISPLAY_NAMES[model]}</option>
                ))}
            </select>
            <ChevronDown size={16} />
          </span>
        </label>

        <label className={styles.controlBlock}>
          <span className={styles.fieldLabel}>输出清晰度</span>
          <span className={styles.selectWrap}>
            <select
              aria-label="输出清晰度"
              value={isGptImage ? value.quality : value.resolution}
              onChange={(event) => changeClarity(event.target.value)}
            >
              {isGptImage
                ? GPT_CLARITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                : capability.resolutions.map((resolution) => (
                    <option key={resolution} value={resolution}>
                      {resolution}{capability.preview_resolutions?.includes(resolution) ? " · Preview" : ""}
                    </option>
                  ))}
            </select>
            <ChevronDown size={16} />
          </span>
        </label>

        <div className={styles.modelQuantityControl}>
          <span className={styles.fieldLabel}>完整方案数量</span>
          <div className={styles.modelQuantityInput}>
            <span className={styles.selectWrap}>
              <select
                aria-label="完整方案数量"
                value={variantCount}
                onChange={(event) => onVariantCountChange(Number(event.target.value))}
              >
                {Array.from({ length: maxVariantCount }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
              <ChevronDown size={16} />
            </span>
            <div className={styles.compactOutputMath}>
              <span>每版 {imagesPerVariant} 张</span>
              <strong>共 {variantCount * imagesPerVariant} 张</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
