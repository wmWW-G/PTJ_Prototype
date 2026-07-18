import { Download, ImageOff, PencilLine, RotateCcw, WandSparkles } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getLiveModelDisplayName } from "../generation/liveTypes";
import { createMockTask, getTask, saveTask } from "../tasks/taskRepository";
import type { GenerationMode } from "../tasks/types";
import styles from "./HistoryDetailPage.module.css";

const modeRoutes: Record<GenerationMode, string> = {
  "text-to-image": "/generation", "image-to-image": "/generation",
  "ai-retouch": "/ai-retouch", "outfit-swap": "/outfit-swap",
};
const modeNames: Record<GenerationMode, string> = {
  "text-to-image": "文生图 · 无参考图", "image-to-image": "图生图 · 含参考图",
  "ai-retouch": "批量AI修图", "outfit-swap": "批量模特换装",
};

/** 历史生成任务的详情和后续操作页面。 */
export function HistoryDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const task = getTask(id);
  const [notice, setNotice] = useState("");

  if (!task) return <div className={styles.empty}><ImageOff size={36} /><h1>没有找到这条生成记录</h1><p>记录可能已被清理，你可以返回批量生图页面重新创建。</p><Link to="/generation">返回批量生图</Link></div>;

  /** 复制当前参数并创建新的演示任务。 */
  function regenerate() {
    if (!task) return;
    const next = createMockTask({ ...task, mode: task.mode, prompt: task.prompt });
    const completed = { ...next, status: "completed" as const, resultImages: [...task.resultImages] };
    saveTask(completed);
    navigate(`/history/${completed.id}`);
  }

  return (
    <article className={styles.detail}>
      {notice && <div className={styles.notice} role="status"><WandSparkles size={16} />{notice}</div>}
      <header><div><span>{modeNames[task.mode]}</span><h1>{new Date(task.createdAt).toLocaleString("zh-CN", { hour12: false })}</h1><p>{task.prompt}</p></div><div className={styles.meta}><b>图片模型 · {getLiveModelDisplayName(task.model)}</b><b>图片尺寸 · {task.aspectRatio}</b></div></header>
      <section className={styles.gallery}>
        {task.resultImages.length > 0 ? task.resultImages.map((image, index) => <figure key={`${image}-${index}`}><img src={image} alt={`生成结果 ${index + 1}`} /><figcaption>{String(index + 1).padStart(2, "0")}</figcaption></figure>) : <div className={styles.noImage}><ImageOff size={32} />图片加载失败</div>}
      </section>
      <footer>
        <button type="button" onClick={() => navigate(modeRoutes[task.mode], { state: { task } })}><PencilLine size={16} />重新编辑</button>
        <button type="button" onClick={regenerate}><RotateCcw size={16} />再次生成</button>
        <button className={styles.primary} type="button" onClick={() => setNotice("原型阶段暂不生成下载文件")}><Download size={16} />全部下载</button>
      </footer>
    </article>
  );
}
