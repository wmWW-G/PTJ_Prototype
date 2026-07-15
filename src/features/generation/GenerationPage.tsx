import { ChevronDown, Minus, Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { assetPath } from "../../lib/assetPath";
import { createMockTask, listTasks, saveTask } from "../tasks/taskRepository";
import type { GenerationMode, GenerationTask, ImageType, RetouchMode } from "../tasks/types";
import { GENERATION_CONFIG, IMAGE_TYPE_RESULT_COUNTS } from "./config";
import { GenerationResultsPanel } from "./components/GenerationResultsPanel";
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
  "text-to-image": [
    assetPath("demo/generated/mug-front.jpg"),
    assetPath("demo/generated/mug-handle.jpg"),
    assetPath("demo/generated/mug-rim.jpg"),
    assetPath("demo/generated/mug-home.jpg"),
    assetPath("demo/generated/mug-office.jpg"),
    assetPath("demo/generated/mug-combo.jpg"),
  ],
  "image-to-image": [assetPath("demo/bowl-hero.svg"), assetPath("demo/bowl-detail.svg"), assetPath("demo/bowl-scene.svg")],
  "ai-retouch": [assetPath("demo/cat-cutout.svg")],
  "outfit-swap": [assetPath("demo/outfit-result.svg")],
};

/**
 * 按图片类型和用户选择的生成数量构造 Mock 结果。
 *
 * 原型素材数量少于套图和详情图的业务张数，因此循环使用本地演示素材，
 * 但输出数量严格遵循 1 / 6 / 5 / 1 的规则。
 *
 * @param mode 当前生成模式。
 * @param imageType 主图、套图、详情图或海报。
 * @param quantity 用户设置的生成份数，会乘以类型基础张数。
 * @returns 张数符合业务规则的本地图片地址数组。
 */
function buildMockResultImages(mode: GenerationMode, imageType: ImageType, quantity: number): string[] {
  const sources = modeResultImages[mode];
  const resultCount = IMAGE_TYPE_RESULT_COUNTS[imageType] * Math.max(1, quantity);
  return Array.from({ length: resultCount }, (_, index) => sources[index % sources.length]);
}

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
  const [imageType, setImageType] = useState<ImageType>(editingTask?.imageType ?? "set");
  const [retouchMode, setRetouchMode] = useState<RetouchMode>(editingTask?.retouchMode ?? "watermark");
  const [prompt, setPrompt] = useState(editingTask?.prompt ?? "");
  const [quantity, setQuantity] = useState(editingTask?.quantity ?? 1);
  const [aspectRatio, setAspectRatio] = useState(editingTask?.aspectRatio ?? "1:1");
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [garmentImages, setGarmentImages] = useState<string[]>([]);
  const [modelImages, setModelImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tasks, setTasks] = useState<GenerationTask[]>(() => listTasks().filter((task) => task.mode === mode));
  const hasInlineResults = mode === "text-to-image" || mode === "image-to-image";
  const plannedOutputCount = IMAGE_TYPE_RESULT_COUNTS[imageType] * quantity;

  /**
   * React Router 在文生图和图生图之间可能复用同一个组件实例。
   * 模式变化时必须主动重读任务，避免右侧误显示上一个页面的结果。
   */
  useEffect(() => {
    setTasks(listTasks().filter((task) => task.mode === mode));
  }, [mode]);

  /** 从 LocalStorage 重新读取当前模式的任务，保证右侧结果立即更新。 */
  function refreshTasks() {
    setTasks(listTasks().filter((task) => task.mode === mode));
  }

  /** 把右侧任务的参数原地回填到左侧表单。 */
  function editTask(task: GenerationTask) {
    setImageType(task.imageType);
    setRetouchMode(task.retouchMode ?? "watermark");
    setPrompt(task.prompt);
    setQuantity(task.quantity);
    setAspectRatio(task.aspectRatio);
    setSourceImages(task.sourceImages);
    setGarmentImages(task.garmentImages);
    setModelImages(task.modelImages);
  }

  /** 复用历史任务参数创建一条新的 Mock 结果。 */
  function regenerateTask(task: GenerationTask) {
    const next = createMockTask({ ...task, mode: task.mode, prompt: task.prompt });
    saveTask({ ...next, status: "completed", resultImages: [...task.resultImages] });
    refreshTasks();
  }

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
    refreshTasks();
    console.info("[批图匠] 开始模拟生成", { mode, taskId: task.id });
    window.setTimeout(() => {
      const completed = { ...task, status: "completed" as const, resultImages: buildMockResultImages(mode, imageType, quantity) };
      saveTask(completed);
      refreshTasks();
      setIsGenerating(false);
      if (!hasInlineResults) navigate(`/history/${completed.id}`);
    }, 650);
  }

  return (
    <div className={`${styles.page} ${hasInlineResults ? styles.splitPage : ""}`}>
      <div className={styles.formColumn}>
        <header className={styles.pageHeader}>
          <h1>{config.title}</h1>
          {hasInlineResults && (
            <ol className={styles.workflowSteps} aria-label="生成步骤">
              <li className={styles.activeStep}><b>1</b><span>输入内容</span></li>
              <li><b>2</b><span>生成设置</span></li>
              <li><b>3</b><span>开始生成</span></li>
            </ol>
          )}
        </header>

        <section className={styles.workspace}>
        {config.hasImageTypes && (
          <div className={styles.imageTypeBlock}>
            <div className={styles.segmented} aria-label="图片类型">
              {imageTypes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={imageType === item.value ? styles.selected : ""}
                  onClick={() => setImageType(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className={styles.typeCounts} aria-label="各类型固定生成张数">
              {imageTypes.map((item) => (
                <span key={item.value} className={imageType === item.value ? styles.activeCount : ""}>
                  {item.label} {IMAGE_TYPE_RESULT_COUNTS[item.value]}张
                </span>
              ))}
            </div>
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

        <button className={styles.generateButton} type="button" disabled={isGenerating} onClick={handleGenerate}>{isGenerating ? <><span className={styles.spinner} />正在生成 {plannedOutputCount} 张图片</> : <><Play size={17} fill="currentColor" />开始生成</>}</button>
        <p className={styles.creditHint}>预计消耗 {plannedOutputCount} 张图额度（按每张图片生成数量 × 输出数量计算）</p>
        </section>

        <section className={`${styles.historySection} ${hasInlineResults ? styles.inlineHistory : ""}`}>
        <div className={styles.historyHeading}><div><span className={styles.eyebrow}>RECENT OUTPUTS</span><h2>历史记录</h2></div><div className={styles.dateInputs}><input aria-label="开始日期" type="date" /><span>→</span><input aria-label="结束日期" type="date" /></div></div>
        <div className={styles.historyTable} role="table">
          <div className={styles.historyRow} role="row"><strong>时间</strong><strong>指令内容</strong><span /></div>
          {tasks.slice(0, 6).map((task) => <Link key={task.id} className={styles.historyRow} to={`/history/${task.id}`}><time>{new Date(task.createdAt).toLocaleDateString("zh-CN")}</time><span>{task.prompt}</span><b>查看</b></Link>)}
        </div>
        </section>
      </div>

      {hasInlineResults && <GenerationResultsPanel mode={mode} tasks={tasks} onEdit={editTask} onRegenerate={regenerateTask} />}
    </div>
  );
}
