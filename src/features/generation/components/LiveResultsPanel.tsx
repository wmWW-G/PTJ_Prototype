import { Check, Download, ImageIcon, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import type { LiveGenerationState, LiveImageState } from "../liveTypes";
import styles from "../GenerationPage.module.css";

const roleLabels: Record<string, string> = {
  main_image: "商品主图",
  angle_detail: "角度与细节",
  selling_point: "核心卖点",
  usage_scene: "使用场景",
  function_customization: "功能或定制",
  packaging_trust: "包装与品牌信任",
  overview: "产品总览",
  material_craft: "材质与工艺",
  benefit: "功能与利益点",
  application: "应用场景",
  procurement: "规格与采购",
  poster: "营销海报",
};

/** 把毫秒转换为简洁秒数。 */
function formatElapsed(milliseconds?: number): string {
  if (!milliseconds) return "—";
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

/** 返回单图状态对应的图标和中文文本。 */
function statusMeta(image: LiveImageState) {
  if (image.status === "completed") return { icon: Check, label: "已完成" };
  if (image.status === "failed") return { icon: TriangleAlert, label: "失败" };
  if (image.status === "retrying") return { icon: RefreshCw, label: "正在重试" };
  if (image.status === "generating") return { icon: LoaderCircle, label: "生成中" };
  return { icon: ImageIcon, label: "等待中" };
}

interface LiveResultsPanelProps {
  state: LiveGenerationState;
  expectedCount: number;
}

/**
 * 逐方案、逐槽位展示真实生图状态和已完成图片。
 *
 * @param props.state NDJSON 事件归并后的实时状态。
 * @param props.expectedCount 当前请求预计输出总张数。
 * @returns 真实任务控制台。
 */
export function LiveResultsPanel({ state, expectedCount }: LiveResultsPanelProps) {
  const variants = Object.values(state.variants).sort((a, b) => a.index - b.index);
  const isDone = ["completed", "partial_success", "failed"].includes(state.status);

  return (
    <aside className={styles.livePanel} aria-label="真实生成进度">
      <header className={styles.liveHeader}>
        <div>
          <span className={styles.eyebrow}>LIVE GENERATION</span>
          <h2>{isDone ? "生成结果" : "正在并发生成"}</h2>
        </div>
        <div className={styles.liveCounter}>
          <strong>{state.resultImages.length} / {expectedCount}</strong>
          <span>{state.status === "planning" ? "正在规划 Prompt" : "图片完成"}</span>
        </div>
      </header>

      {state.message && <p className={styles.liveError} role="alert">{state.message}</p>}
      {variants.length === 0 ? (
        <div className={styles.livePlanning}>
          <LoaderCircle size={26} />
          <strong>正在分析商品并生成结构化 Prompt</strong>
          <span>计划完成后，会按模板一次展开所有图片槽位。</span>
        </div>
      ) : (
        variants.map((variant) => (
          <section key={variant.index} className={styles.liveVariant}>
            <div className={styles.variantHeading}>
              <strong>方案 {String(variant.index).padStart(2, "0")}</strong>
              <span>{variant.status}</span>
            </div>
            <div className={styles.liveGrid}>
              {Object.values(variant.images)
                .sort((a, b) => a.index - b.index)
                .map((image) => {
                  const meta = statusMeta(image);
                  const StatusIcon = meta.icon;
                  const displayTitle = image.title || roleLabels[image.role] || image.role;
                  return (
                    <article key={image.index} className={`${styles.liveCard} ${styles[`live_${image.status}`] ?? ""}`}>
                      <div className={styles.liveImageStage}>
                        {image.imageUrl ? (
                          <img src={image.imageUrl} alt={displayTitle} />
                        ) : (
                          <StatusIcon size={25} />
                        )}
                        <span>{String(image.index).padStart(2, "0")}</span>
                        {image.imageUrl && (
                          <a href={image.imageUrl} download aria-label={`下载图片 ${image.index}`}>
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                      <div className={styles.liveCardBody}>
                        <strong>{displayTitle}</strong>
                        <span className={styles.liveStatus}><StatusIcon size={12} />{meta.label}</span>
                        <dl>
                          <div><dt>尺寸</dt><dd>{image.actualSize ?? "—"}</dd></div>
                          <div><dt>耗时</dt><dd>{formatElapsed(image.elapsedMs)}</dd></div>
                        </dl>
                        {image.retryCount > 0 && <small>重试 {image.retryCount} 次</small>}
                        {image.error && <small className={styles.cardError}>{image.error}</small>}
                      </div>
                    </article>
                  );
                })}
            </div>
            {variant.plan && (
              <details className={styles.planDetails}>
                <summary>查看本方案 Prompt 计划</summary>
                <p>{variant.plan.global_consistency_prompt}</p>
                <ol>
                  {variant.plan.image_prompts.map((prompt) => (
                    <li key={prompt.index}><strong>{prompt.title || roleLabels[prompt.role] || prompt.role}</strong>{prompt.prompt}</li>
                  ))}
                </ol>
              </details>
            )}
          </section>
        ))
      )}
    </aside>
  );
}
