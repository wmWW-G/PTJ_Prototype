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
    label: "GPT-Image-2 · Azure",
    aspect_ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
    resolutions: ["1K", "2K", "4K"],
    quality: true,
    qualities: ["low", "medium", "high"],
  },
};

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

  /** 切换模型并纠正新模型不支持的当前值。 */
  function changeModel(model: LiveImageModel) {
    const next = capabilities[model] ?? DEFAULT_MODEL_CAPABILITIES[model];
    onChange({
      ...value,
      model,
      aspectRatio: next.aspect_ratios.includes(value.aspectRatio)
        ? value.aspectRatio
        : "1:1",
      resolution: next.resolutions.includes(value.resolution)
        ? value.resolution
        : "2K",
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
              value={value.resolution}
              onChange={(event) => onChange({
                ...value,
                resolution: event.target.value as ModelControlValue["resolution"],
              })}
            >
              {capability.resolutions.map((resolution) => (
                <option key={resolution} value={resolution}>
                  {resolution}{capability.preview_resolutions?.includes(resolution) ? " · Preview" : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </span>
        </label>

        {capability.quality && (
          <label className={styles.controlBlock}>
            <span className={styles.fieldLabel}>生成质量</span>
            <span className={styles.selectWrap}>
              <select
                aria-label="生成质量"
                value={value.quality}
                onChange={(event) => onChange({
                  ...value,
                  quality: event.target.value as ModelControlValue["quality"],
                })}
              >
                <option value="low">Low · 快速</option>
                <option value="medium">Medium · 平衡</option>
                <option value="high">High · 精细</option>
              </select>
              <ChevronDown size={16} />
            </span>
          </label>
        )}
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

