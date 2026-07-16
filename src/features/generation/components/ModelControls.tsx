import { ChevronDown, Info } from "lucide-react";
import type { LiveImageModel, ModelCapability } from "../liveTypes";
import styles from "../GenerationPage.module.css";

/** 没连上后端时仍能展示表单的安全能力快照；真实提交不会因此回退 Mock。 */
export const DEFAULT_MODEL_CAPABILITIES: Record<LiveImageModel, ModelCapability> = {
  nano_banana_2: {
    label: "Nano Banana 2",
    aspect_ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
    resolutions: ["1K", "2K", "4K"],
    quality: false,
    preview_resolutions: ["4K"],
  },
  nano_banana_pro: {
    label: "Nano Banana Pro",
    aspect_ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
    resolutions: ["1K", "2K", "4K"],
    quality: false,
    preview_resolutions: ["4K"],
  },
  gpt_image_2_azure: {
    label: "GPT-Image-2",
    aspect_ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
    resolutions: ["1K", "2K", "4K"],
    quality: true,
    qualities: ["low", "medium", "high"],
  },
};

/**
 * GPT-Image-2 只向用户展示一个“清晰度”选择器。
 *
 * Azure 接口内部仍需要像素档位和质量档位两个参数，因此在前端把
 * 低/中/高同时映射成配套的 1K/2K/4K 与 low/medium/high。这样界面更简单，
 * 提交给后端的参数仍然完整且相互一致。
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
  resolution: "1K" | "2K" | "4K";
  quality: "low" | "medium" | "high";
}

interface ModelControlsProps {
  value: ModelControlValue;
  onChange: (value: ModelControlValue) => void;
  capabilities?: Record<LiveImageModel, ModelCapability>;
}

/**
 * 根据当前模型能力动态展示模型、比例、分辨率和 Azure 质量。
 *
 * @param props.value 当前受控值。
 * @param props.onChange 任一字段变化后的完整值回调。
 * @param props.capabilities 后端返回的动态模型能力；缺失时使用只读快照。
 * @returns 真实生图参数控件。
 */
export function ModelControls({
  value,
  onChange,
  capabilities = DEFAULT_MODEL_CAPABILITIES,
}: ModelControlsProps) {
  const capability = capabilities[value.model] ?? DEFAULT_MODEL_CAPABILITIES[value.model];
  const isGptImage = value.model === "gpt_image_2_azure";

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
        model === "gpt_image_2_azure"
          ? (gptResolution ?? "2K")
          : next.resolutions.includes(value.resolution)
            ? value.resolution
            : "2K",
    });
  }

  /**
   * 更新唯一的清晰度控件。
   *
   * Google 模型直接更新 1K/2K/4K；GPT-Image-2 则把低/中/高同时映射到
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
          <span className={styles.fieldLabel}>生图模型</span>
          <span className={styles.selectWrap}>
            <select
              aria-label="生图模型"
              value={value.model}
              onChange={(event) => changeModel(event.target.value as LiveImageModel)}
            >
              {Object.entries(capabilities).map(([model, item]) => (
                <option key={model} value={model}>{item.label}</option>
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
      </div>

      <div className={styles.ratioBlock}>
        <span className={styles.fieldLabel}>画面比例</span>
        <div className={styles.ratios}>
          {capability.aspect_ratios.map((ratio) => (
            <button
              key={ratio}
              type="button"
              className={value.aspectRatio === ratio ? styles.selected : ""}
              onClick={() => onChange({ ...value, aspectRatio: ratio })}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.modelHint}>
        <Info size={13} />
        {value.model === "gpt_image_2_azure"
          ? "Azure 会在后端把比例与清晰度换算成合法实际像素，结果卡片会显示最终尺寸。"
          : "比例与清晰度作为动态参数直接传给 Google Cloud，不需要复制模型节点。"}
      </p>
    </section>
  );
}
