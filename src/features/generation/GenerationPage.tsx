import { ChevronDown, Minus, Play, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createMockTask, listTasks, saveTask } from "../tasks/taskRepository";
import type { GenerationMode, GenerationTask, ImageType, RetouchMode } from "../tasks/types";
import { GENERATION_CONFIG } from "./config";
import { UploadZone } from "./components/UploadZone";
import styles from "./GenerationPage.module.css";

const imageTypes: Array<{ value: ImageType; label: string }> = [
  { value: "main", label: "主图" }, { value: "set", label: "套图" },
  { value: "listing", label: "详情图" }, { value: "poster", label: "海报" },
];
const ratios = ["1:1", "2:3", "3:4", "4:3", "9:16", "16:9"];
const retouchModes: Array<{ value: RetouchMode; label: string }> = [
  { value: "watermark", label: "去水印" }, { value: "copy", label: "改文案" }, { value: "cutout", label: "抠图" },
];
const modeResultImages: Record<GenerationMode, string[]> = {
  "text-to-image": ["/demo/mug-hero.svg"],
  "image-to-image": ["/demo/bowl-hero.svg", "/demo/bowl-detail.svg", "/demo/bowl-scene.svg"],
  "ai-retouch": ["/demo/cat-cutout.svg"],
  "outfit-swap": ["/demo/outfit-result.svg"],
};

interface GenerationPageProps { mode: GenerationMode; }

/**
 * 配置驱动的生成工作区，覆盖文生图、图生图、AI 修图和模特换装。
 *
 * @param props.mode 当前业务模式。
 * @returns 对应模式的完整表单、历史表格和演示结果。
 */
export function GenerationPage({ mode }: GenerationPageProps) {
  const config = GENERATION_CONFIG[mode];
  const navigate = useNavigate();
  const location = useLocation();
  const editingTask = (location.state as { task?: GenerationTask } | null)?.task;
  const [imageType, setImageType] = useState<ImageType>(editingTask?.imageType ?? "main");
  const [retouchMode, setRetouchMode] = useState<RetouchMode>(editingTask?.retouchMode ?? "watermark");
  const [prompt, setPrompt] = useState(editingTask?.prompt ?? "");
  const [quantity, setQuantity] = useState(editingTask?.quantity ?? 1);
  const [aspectRatio, setAspectRatio] = useState(editingTask?.aspectRatio ?? "1:1");
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [garmentImages, setGarmentImages] = useState<string[]>([]);
  const [modelImages, setModelImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const tasks = useMemo(() => listTasks().filter((task) => task.mode === mode), [mode]);

  /** 创建并完成一条 Mock 任务，模拟真实接口的状态变化。 */
  function handleGenerate() {
    if (isGenerating) return;
    setIsGenerating(true);
    const task = createMockTask({
      mode, imageType, retouchMode: mode === "ai-retouch" ? retouchMode : undefined,
      prompt: prompt.trim() || config.promptPlaceholder,
      quantity, aspectRatio, sourceImages, garmentImages, modelImages,
    });
    saveTask(task);
    console.info("[批图匠] 开始模拟生成", { mode, taskId: task.id });
    window.setTimeout(() => {
      const completed = { ...task, status: "completed" as const, resultImages: modeResultImages[mode].slice(0, Math.max(1, quantity)) };
      saveTask(completed);
      setIsGenerating(false);
      navigate(`/history/${completed.id}`);
    }, 650);
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>AI IMAGE WORKSPACE</span><h1>{config.title}</h1></div>
        <span className={styles.prototypeBadge}><Sparkles size={14} />原型演示</span>
      </header>

      <section className={styles.workspace}>
        {config.hasImageTypes && (
          <div className={styles.segmented} aria-label="图片类型">
            {imageTypes.map((item) => <button key={item.value} type="button" className={imageType === item.value ? styles.selected : ""} onClick={() => setImageType(item.value)}>{item.label}</button>)}
          </div>
        )}

        {config.uploadLabels.map((label, index) => (
          <UploadZone key={label} label={label} onChange={index === 0 ? (mode === "outfit-swap" ? setGarmentImages : setSourceImages) : setModelImages} />
        ))}

        {mode === "ai-retouch" && (
          <div className={styles.retouchModes}>{retouchModes.map((item) => <button key={item.value} type="button" className={retouchMode === item.value ? styles.selected : ""} onClick={() => setRetouchMode(item.value)}>{item.label}</button>)}</div>
        )}

        <label className={styles.promptField}>
          <span className={styles.fieldLabel}>{config.promptLabel}</span>
          <textarea value={prompt} placeholder={config.promptPlaceholder} onChange={(event) => setPrompt(event.target.value)} />
          <small>{prompt.length}/1000</small>
        </label>

        <div className={styles.controlGrid}>
          <div className={styles.controlBlock}>
            <span className={styles.fieldLabel}>每张图片 AI 生成数量</span>
            <div className={styles.stepper}><button type="button" aria-label="减少数值" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button><strong>{quantity}</strong><button type="button" aria-label="增加数值" onClick={() => setQuantity(Math.min(4, quantity + 1))}><Plus size={16} /></button></div>
          </div>
          <label className={styles.controlBlock}><span className={styles.fieldLabel}>模型选择</span><span className={styles.selectWrap}><select defaultValue="Ptu1.0"><option>Ptu1.0</option><option>Ptu Turbo</option></select><ChevronDown size={16} /></span></label>
        </div>

        <details className={styles.optionalPanel}><summary>批量加文字 / LOGO（选填）<ChevronDown size={16} /></summary><div><input aria-label="Logo 文字" placeholder="LOGO 位置 + LOGO 名称" /><UploadZone label="上传 LOGO" /></div></details>
        {config.hasBackground && <details className={styles.optionalPanel}><summary>批量替换背景（选填）<ChevronDown size={16} /></summary><UploadZone label="上传背景图片" /></details>}

        <div className={styles.ratioBlock}><span className={styles.fieldLabel}>图片尺寸</span><div className={styles.ratios}>{ratios.map((ratio) => <button key={ratio} type="button" className={aspectRatio === ratio ? styles.selected : ""} onClick={() => setAspectRatio(ratio)}>{ratio}</button>)}</div></div>

        <button className={styles.generateButton} type="button" disabled={isGenerating} onClick={handleGenerate}>{isGenerating ? <><span className={styles.spinner} />正在生成演示结果</> : <><Play size={17} fill="currentColor" />开始生成</>}</button>
      </section>

      <section className={styles.historySection}>
        <div className={styles.historyHeading}><div><span className={styles.eyebrow}>RECENT OUTPUTS</span><h2>历史记录</h2></div><div className={styles.dateInputs}><input aria-label="开始日期" type="date" /><span>→</span><input aria-label="结束日期" type="date" /></div></div>
        <div className={styles.historyTable} role="table">
          <div className={styles.historyRow} role="row"><strong>时间</strong><strong>指令内容</strong><span /></div>
          {tasks.slice(0, 6).map((task) => <Link key={task.id} className={styles.historyRow} to={`/history/${task.id}`}><time>{new Date(task.createdAt).toLocaleDateString("zh-CN")}</time><span>{task.prompt}</span><b>查看</b></Link>)}
        </div>
      </section>
    </div>
  );
}
