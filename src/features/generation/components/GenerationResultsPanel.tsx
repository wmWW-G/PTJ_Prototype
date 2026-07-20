import {
  Check,
  Copy,
  Download,
  ImageOff,
} from "lucide-react";
import { useState } from "react";
import type { GenerationTask, ImageType } from "../../tasks/types";
import { getLiveModelDisplayName } from "../liveTypes";
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
  listing: [
    "产品定位总览",
    "产品介绍",
    "核心卖点",
    "结构与使用",
    "材质工艺",
    "应用场景",
    "品质控制",
    "包装与合作",
  ],
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
  tasks: GenerationTask[];
}

/**
 * 文生图和图生图共用的单任务结果工作台。
 *
 * 这里只突出最新任务，避免旧版连续任务卡挤压生成结果；历史任务仍可从左侧导航进入。
 *
 * @param props.tasks 文生图和图生图按时间从新到旧排列的统一任务列表。
 * @returns 包含进度、图片网格、任务元数据和后续操作的结果区域。
 */
export function GenerationResultsPanel({
  tasks,
}: GenerationResultsPanelProps) {
  const [notice, setNotice] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const task = tasks[0];

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

  return (
    <aside className={styles.resultsPanel} aria-label="生成内容">
      {notice && <div className={styles.resultNotice} role="status">{notice}</div>}
      <section className={styles.resultWorkspace}>
        <header className={styles.resultWorkspaceHeader}>
          <div className={styles.resultTitleRow}>
            <h2>生成记录</h2>
            <span className={`${styles.taskStatus} ${isGenerating ? styles.statusRunning : styles.statusDone}`}>
              <i />{isGenerating ? `正在生成 ${completedCount}/${resultCount}` : "已完成"}
            </span>
          </div>
          <div className={styles.taskIdentity}>
            <span>任务ID：{task.id.slice(-14)}</span>
            <button type="button" aria-label="复制任务 ID" onClick={() => setNotice("任务 ID 已复制")}><Copy size={15} /></button>
          </div>
        </header>

        <div className={styles.resultToolbar}>
          <div>
            <strong>{imageTypeLabels[task.imageType]} · {task.resultImages.length || "生成中"}张</strong>
            <div className={styles.resultMetaLine} aria-label="任务生成信息">
              <span><b>生图时间</b>{formatTaskTime(task.createdAt)}</span>
              <span><b>模型</b>{getLiveModelDisplayName(task.model)}</span>
              <span><b>尺寸</b>{task.aspectRatio}</span>
            </div>
          </div>
        </div>

        <div className={styles.resultGallery} data-count={task.resultImages.length}>
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

        <footer className={styles.resultActions}>
          <button className={styles.downloadButton} type="button" aria-label="全部下载" onClick={() => setNotice("原型阶段暂不生成下载文件")}><Download size={16} />全部下载</button>
        </footer>

      </section>
    </aside>
  );
}
