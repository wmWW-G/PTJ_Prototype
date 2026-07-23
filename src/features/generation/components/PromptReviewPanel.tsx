import { Check, LoaderCircle, Pencil, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { PlannedImagePrompt, PromptPlanPayload } from "../liveTypes";
import styles from "../GenerationPage.module.css";

interface PromptReviewPanelProps {
  /** LLM 已生成、等待用户确认的全部方案。 */
  plans: PromptPlanPayload[];
  /** 所有方案合计会生成的图片数量。 */
  expectedCount: number;
  /** 确认后真实图片任务是否正在启动或执行。 */
  isStarting: boolean;
  /** 用户确认全部 Prompt 后开始真实生图。 */
  onConfirm: () => void;
  /** 根据用户意见只优化指定方案中的指定单张 Prompt。 */
  onRefine: (
    variantIndex: number,
    imagePrompt: PlannedImagePrompt,
    feedback: string,
  ) => Promise<void>;
}

/**
 * 展示逐张 Prompt，并提供单张 AI 优化和整套确认入口。
 *
 * 界面只保留 Prompt 正文、修改意见和确认按钮；全局约束使用折叠区域，避免
 * 六张或八张方案在右栏变成复杂配置表。
 *
 * @param props 已规划方案、回调和任务状态。
 * @returns 用户确认前的 Prompt 审核面板。
 */
export function PromptReviewPanel({
  plans,
  expectedCount,
  isStarting,
  onConfirm,
  onRefine,
}: PromptReviewPanelProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [refiningKey, setRefiningKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const multipleVariants = plans.length > 1;

  /**
   * 打开或关闭一张 Prompt 的改进意见输入区。
   *
   * @param key 由方案序号和图片序号组成的稳定键。
   * @returns 无返回值；切换图片时清空上一张尚未提交的意见和错误。
   */
  function toggleEditor(key: string): void {
    setEditingKey((current) => current === key ? null : key);
    setFeedback("");
    setError("");
  }

  /**
   * 调用父级的真实 LLM 优化请求，并只在成功后关闭当前编辑区。
   *
   * @param variantIndex 当前方案的 1-based 序号。
   * @param imagePrompt 当前需要重写的单张 Prompt。
   * @returns Promise 在优化完成或错误已显示后结束。
   */
  async function submitRefinement(
    variantIndex: number,
    imagePrompt: PlannedImagePrompt,
  ): Promise<void> {
    const normalizedFeedback = feedback.trim();
    if (!normalizedFeedback) {
      setError("请先输入你希望怎么改");
      return;
    }
    const key = `${variantIndex}-${imagePrompt.index}`;
    setRefiningKey(key);
    setError("");
    try {
      await onRefine(variantIndex, imagePrompt, normalizedFeedback);
      setEditingKey(null);
      setFeedback("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "这张 Prompt 优化失败，请重试");
    } finally {
      setRefiningKey(null);
    }
  }

  return (
    <aside className={styles.promptReviewPanel} aria-label="生图 Prompt 确认">
      <header className={styles.promptReviewHeader}>
        <div>
          <span className={styles.eyebrow}>PROMPT REVIEW</span>
          <h2>确认生图 Prompt</h2>
          <p>逐张检查；确认前不会调用图片模型。</p>
        </div>
        <strong>{expectedCount} 张</strong>
      </header>

      <div className={styles.promptReviewBody}>
        {plans.map((plan, planIndex) => {
          const variantIndex = planIndex + 1;
          return (
            <section key={variantIndex} className={styles.promptVariantSection}>
              {multipleVariants && <h3>方案 {String(variantIndex).padStart(2, "0")}</h3>}
              <details className={styles.globalPromptDetails}>
                <summary>整套一致性要求</summary>
                <p>{plan.global_consistency_prompt}</p>
              </details>
              <ol className={styles.promptReviewList}>
                {plan.image_prompts.map((imagePrompt) => {
                  const key = `${variantIndex}-${imagePrompt.index}`;
                  const isEditing = editingKey === key;
                  const isRefining = refiningKey === key;
                  const accessiblePrefix = multipleVariants ? `方案 ${variantIndex} ` : "";
                  return (
                    <li key={imagePrompt.index} className={isEditing ? styles.editingPrompt : ""}>
                      <div className={styles.promptReviewRow}>
                        <span>{String(imagePrompt.index).padStart(2, "0")}</span>
                        <div>
                          <strong>{imagePrompt.title || imagePrompt.role}</strong>
                          {imagePrompt.information_units && (
                            <span className={styles.promptDensitySummary}>
                              {imagePrompt.information_units.length} 个信息单元 · {imagePrompt.visible_text?.length ?? 0} 条画面文案
                            </span>
                          )}
                          <p>{imagePrompt.prompt}</p>
                          {imagePrompt.negative_prompt && (
                            <small>避免：{imagePrompt.negative_prompt}</small>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`${isEditing ? "关闭" : "修改"}${accessiblePrefix}第 ${imagePrompt.index} 张 Prompt`}
                          onClick={() => toggleEditor(key)}
                        >
                          {isEditing ? <X size={15} /> : <Pencil size={15} />}
                        </button>
                      </div>
                      {isEditing && (
                        <div className={styles.promptFeedbackEditor}>
                          <textarea
                            aria-label={`${accessiblePrefix}第 ${imagePrompt.index} 张改进意见`}
                            value={feedback}
                            maxLength={1000}
                            placeholder="例如：改成俯拍构图，增加三种颜色，减少文字"
                            onChange={(event) => setFeedback(event.target.value)}
                          />
                          {error && <p role="alert">{error}</p>}
                          <button
                            type="button"
                            aria-label={`AI 重新优化${accessiblePrefix}第 ${imagePrompt.index} 张 Prompt`}
                            disabled={isRefining}
                            onClick={() => void submitRefinement(variantIndex, imagePrompt)}
                          >
                            {isRefining ? <LoaderCircle className={styles.spinnerIcon} size={15} /> : <Sparkles size={15} />}
                            {isRefining ? "正在优化" : "AI 重新生成 Prompt"}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      <footer className={styles.promptReviewFooter}>
        <p><Check size={14} />确认后才开始真实生图并消耗图片额度</p>
        <button type="button" disabled={isStarting || Boolean(refiningKey)} onClick={onConfirm}>
          {isStarting ? <LoaderCircle className={styles.spinnerIcon} size={17} /> : <Check size={17} />}
          {isStarting ? "正在开始生图" : `确认 Prompt，开始生成 ${expectedCount} 张`}
        </button>
      </footer>
    </aside>
  );
}
