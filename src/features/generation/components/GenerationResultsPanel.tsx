import { Download, ImageOff, PencilLine, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { GenerationMode, GenerationTask, ImageType } from "../../tasks/types";
import styles from "../GenerationPage.module.css";

const imageTypeLabels: Record<ImageType, string> = {
  main: "主图",
  set: "套图",
  listing: "详情图",
  poster: "海报",
};

/**
 * 把 ISO 时间转成原站任务卡使用的中文时间格式。
 *
 * @param value 任务的 ISO 创建时间。
 * @returns 形如“2026年07月08日 17:25:06”的字符串。
 */
function formatTaskTime(value: string): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}年${read("month")}月${read("day")}日 ${read("hour")}:${read("minute")}:${read("second")}`;
}

interface GenerationResultsPanelProps {
  mode: GenerationMode;
  tasks: GenerationTask[];
  onEdit: (task: GenerationTask) => void;
  onRegenerate: (task: GenerationTask) => void;
}

/**
 * 文生图和图生图共用的右侧生成内容面板。
 *
 * 面板完整保留原站的任务时间、指令、模型、尺寸、图片和三个后续操作。
 *
 * @param props.mode 当前生成模式，用于显示对应的模型代码。
 * @param props.tasks 按时间从新到旧排列的任务。
 * @param props.onEdit 重新编辑回调，把任务参数回填到左侧表单。
 * @param props.onRegenerate 再次生成回调，复用任务参数创建新结果。
 * @returns 可独立滚动的生成结果列表。
 */
export function GenerationResultsPanel({
  mode,
  tasks,
  onEdit,
  onRegenerate,
}: GenerationResultsPanelProps) {
  const [notice, setNotice] = useState("");
  const modelCode = mode === "text-to-image" ? "t2i_img" : "i2i_img";

  return (
    <aside className={styles.resultsPanel} aria-label="生成内容">
      {notice && <div className={styles.resultNotice} role="status">{notice}</div>}
      {tasks.length === 0 ? (
        <div className={styles.emptyResults}><ImageOff size={34} /><strong>暂无生成内容</strong></div>
      ) : tasks.map((task) => (
        <article className={styles.resultCard} key={task.id}>
          <header>
            <h2>{formatTaskTime(task.createdAt)}</h2>
            <p>{task.prompt}，{imageTypeLabels[task.imageType]}</p>
            <div className={styles.resultMeta}>
              <span>图片模型-{modelCode}</span>
              <span>图片尺寸-{task.aspectRatio}</span>
            </div>
          </header>

          <div className={styles.resultGallery} data-count={task.resultImages.length}>
            {task.status === "generating" ? (
              <div className={styles.resultLoading}><span className={styles.spinner} />正在生成图片</div>
            ) : task.resultImages.length > 0 ? task.resultImages.map((image, index) => (
              <figure key={`${task.id}-${image}-${index}`}>
                <img src={image} alt={`${imageTypeLabels[task.imageType]}结果 ${index + 1}`} />
                <span>{index + 1}/{task.resultImages.length}</span>
              </figure>
            )) : (
              <div className={styles.resultLoading}><ImageOff size={28} />图片加载失败</div>
            )}
          </div>

          <footer>
            <button type="button" aria-label="重新编辑" onClick={() => onEdit(task)}><PencilLine size={15} />重新编辑</button>
            <button type="button" aria-label="再次生成" onClick={() => onRegenerate(task)}><RotateCcw size={15} />再次生成</button>
            <button type="button" aria-label="全部下载" onClick={() => setNotice("原型阶段暂不生成下载文件")}><Download size={15} />全部下载</button>
          </footer>
        </article>
      ))}

      <nav className={styles.pagination} aria-label="生成内容分页">
        <button type="button" disabled>‹</button>
        <button type="button" className={styles.currentPage}>1</button>
        <button type="button">2</button>
        <button type="button">3</button>
        <button type="button">4</button>
        <button type="button">›</button>
      </nav>
    </aside>
  );
}
