import {
  Check,
  Copy,
  Download,
  Grid2X2,
  ImageOff,
  List,
  PencilLine,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import type { GenerationMode, GenerationTask, ImageType } from "../../tasks/types";
import styles from "../GenerationPage.module.css";

const imageTypeLabels: Record<ImageType, string> = {
  main: "主图",
  set: "套图",
  listing: "详情图",
  poster: "海报",
};

const resultRoleLabels: Record<ImageType, string[]> = {
  main: ["正面主视觉"],
  set: ["正面主视觉", "手柄细节", "杯口细节", "居家场景", "办公场景", "组合展示"],
  listing: ["核心卖点", "材质细节", "工艺说明", "使用场景", "尺寸说明"],
  poster: ["海报成图"],
};

/**
 * 把 ISO 时间转为结果工作台使用的中文分钟级时间。
 *
 * @param value 任务的 ISO 创建时间。
 * @returns 形如“2026年07月15日 13:04”的字符串。
 */
function formatTaskTime(value: string): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}年${read("month")}月${read("day")}日 ${read("hour")}:${read("minute")}`;
}

interface GenerationResultsPanelProps {
  mode: GenerationMode;
  tasks: GenerationTask[];
  onEdit: (task: GenerationTask) => void;
  onRegenerate: (task: GenerationTask) => void;
}

/**
 * 文生图和图生图共用的单任务结果工作台。
 *
 * 这里只突出最新任务，避免旧版连续任务卡挤压生成结果；历史任务仍可从左侧导航进入。
 *
 * @param props.mode 当前生成模式，用于展示对应模型代码。
 * @param props.tasks 当前模式下按时间从新到旧排列的任务。
 * @param props.onEdit 重新编辑回调，把当前任务参数回填到左侧表单。
 * @param props.onRegenerate 再次生成回调，复用任务参数创建新任务。
 * @returns 包含进度、图片网格、任务元数据和后续操作的结果区域。
 */
export function GenerationResultsPanel({
  mode,
  tasks,
  onEdit,
  onRegenerate,
}: GenerationResultsPanelProps) {
  const [notice, setNotice] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const task = tasks[0];
  const modelCode = mode === "text-to-image" ? "t2i_img" : "i2i_img";

  if (!task) {
    return (
      <aside className={styles.resultsPanel} aria-label="生成内容">
        <div className={styles.emptyResults}>
          <ImageOff size={34} />
          <strong>暂无生成内容</strong>
          <span>完成左侧配置后，结果会在这里实时出现</span>
        </div>
      </aside>
    );
  }

  const isGenerating = task.status === "generating" || task.status === "queued";
  const completedCount = isGenerating ? Math.max(1, Math.min(4, task.resultImages.length)) : task.resultImages.length;
  const resultCount = Math.max(task.resultImages.length, 1);
  const selectedImage = task.resultImages[selectedIndex] ?? task.resultImages[0];

  return (
    <aside className={styles.resultsPanel} aria-label="生成内容">
      {notice && <div className={styles.resultNotice} role="status">{notice}</div>}
      <section className={styles.resultWorkspace}>
        <header className={styles.resultWorkspaceHeader}>
          <div className={styles.resultTitleRow}>
            <h2>本次生成结果</h2>
            <span className={`${styles.taskStatus} ${isGenerating ? styles.statusRunning : styles.statusDone}`}>
              <i />{isGenerating ? `正在生成 ${completedCount}/${resultCount}` : "已完成"}
            </span>
          </div>
          <div className={styles.taskIdentity}>
            <span>任务ID：{task.id.slice(-14)}</span>
            <button type="button" aria-label="复制任务 ID" onClick={() => setNotice("任务 ID 已复制")}><Copy size={15} /></button>
          </div>
        </header>

        <div className={styles.progressRail} aria-label="任务进度">
          <div className={styles.completedStage}><i /><span>排队中</span></div>
          <div className={isGenerating ? styles.currentStage : styles.completedStage}><i /><span>正在生成</span></div>
          <div className={!isGenerating ? styles.completedStage : ""}><i /><span>已完成</span></div>
        </div>

        <div className={styles.resultToolbar}>
          <div>
            <strong>{imageTypeLabels[task.imageType]} · {task.resultImages.length || "生成中"}张</strong>
            <span>{task.prompt}</span>
          </div>
          <div className={styles.viewSwitch} aria-label="结果视图">
            <button type="button" className={viewMode === "grid" ? styles.activeView : ""} onClick={() => setViewMode("grid")}><Grid2X2 size={15} />网格视图</button>
            <button type="button" className={viewMode === "list" ? styles.activeView : ""} onClick={() => setViewMode("list")}><List size={15} />列表视图</button>
          </div>
        </div>

        <div className={`${styles.resultGallery} ${viewMode === "list" ? styles.listGallery : ""}`} data-count={task.resultImages.length}>
          {isGenerating && task.resultImages.length === 0 ? (
            Array.from({ length: 6 }, (_, index) => (
              <div className={styles.resultSkeleton} key={index}>
                {index === 0 && <><span className={styles.spinner} />正在生成首张图片</>}
              </div>
            ))
          ) : task.resultImages.length > 0 ? task.resultImages.map((image, index) => (
            <button
              type="button"
              className={selectedIndex === index ? styles.selectedResult : ""}
              key={`${task.id}-${image}-${index}`}
              onClick={() => setSelectedIndex(index)}
              aria-label={`选择${resultRoleLabels[task.imageType][index] ?? `结果 ${index + 1}`}`}
            >
              <img src={image} alt={`${imageTypeLabels[task.imageType]}：${resultRoleLabels[task.imageType][index] ?? `结果 ${index + 1}`}`} />
              <span>{resultRoleLabels[task.imageType][index] ?? `结果 ${index + 1}`}</span>
              {selectedIndex === index && <b><Check size={14} /></b>}
            </button>
          )) : (
            <div className={styles.resultLoading}><ImageOff size={28} />图片加载失败</div>
          )}
        </div>

        <div className={styles.resultSummary}>
          {selectedImage && <img src={selectedImage} alt="当前选中的结果缩略图" />}
          <dl>
            <div><dt>生成时间</dt><dd>{formatTaskTime(task.createdAt)}</dd></div>
            <div><dt>类型</dt><dd>{imageTypeLabels[task.imageType]}</dd></div>
            <div><dt>模型</dt><dd>{task.model} · {modelCode}</dd></div>
            <div><dt>尺寸</dt><dd>{task.aspectRatio}</dd></div>
            <div><dt>生成数量</dt><dd>{task.resultImages.length || "生成中"}张</dd></div>
          </dl>
        </div>

        <footer className={styles.resultActions}>
          <button type="button" aria-label="重新编辑" onClick={() => onEdit(task)}><PencilLine size={16} />重新编辑</button>
          <button type="button" aria-label="再次生成" onClick={() => onRegenerate(task)}><RotateCcw size={16} />再次生成</button>
          <button className={styles.downloadButton} type="button" aria-label="全部下载" onClick={() => setNotice("原型阶段暂不生成下载文件")}><Download size={16} />全部下载</button>
        </footer>

        <div className={styles.taskFooterStatus}>
          <span><i className={styles.runningDot} />正在生成 {isGenerating ? `${completedCount}/${resultCount}` : "0"}<small>{isGenerating ? "预计剩余 00:01:12" : "当前无进行中任务"}</small></span>
          <span><i className={styles.waitingDot} />排队中 0<small>预计等待 00:00:00</small></span>
          <span><i className={styles.doneDot} />已完成 {task.resultImages.length}<small>生成于 {formatTaskTime(task.createdAt).slice(5)}</small></span>
        </div>
      </section>
    </aside>
  );
}
