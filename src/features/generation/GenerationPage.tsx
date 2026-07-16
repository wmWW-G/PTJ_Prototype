import { ChevronDown, Minus, Play, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { assetPath } from "../../lib/assetPath";
import { createMockTask, listTasks, saveTask } from "../tasks/taskRepository";
import type { GenerationMode, GenerationTask, ImageType, RetouchMode } from "../tasks/types";
import {
  fetchGenerationCapabilities,
  streamGeneration,
  uploadReference,
} from "./api";
import { GENERATION_CONFIG, IMAGE_TYPE_RESULT_COUNTS } from "./config";
import { GenerationResultsPanel } from "./components/GenerationResultsPanel";
import { LiveResultsPanel } from "./components/LiveResultsPanel";
import {
  DEFAULT_MODEL_CAPABILITIES,
  ModelControls,
  type ModelControlValue,
} from "./components/ModelControls";
import { UploadZone } from "./components/UploadZone";
import {
  DEFAULT_VISUAL_TEMPLATES,
  VisualTemplatePicker,
} from "./components/VisualTemplatePicker";
import { createInitialLiveState, reduceGenerationEvent } from "./liveState";
import type {
  GenerationCapabilities,
  LiveGenerationState,
  LiveImageModel,
} from "./liveTypes";
import styles from "./GenerationPage.module.css";

const imageTypes: Array<{ value: ImageType; label: string }> = [
  { value: "main", label: "主图" },
  { value: "set", label: "套图" },
  { value: "listing", label: "详情图" },
  { value: "poster", label: "海报" },
];
const legacyRatios = ["1:1", "2:3", "3:4", "4:3", "9:16", "16:9"];
const retouchModes: Array<{ value: RetouchMode; label: string }> = [
  { value: "watermark", label: "去水印" },
  { value: "copy", label: "改文案" },
  { value: "cutout", label: "抠图" },
];
const templateIds: Record<ImageType, string> = {
  main: "main_01",
  set: "product_set_01",
  listing: "listing_01",
  poster: "poster_01",
};
const modeResultImages: Record<GenerationMode, string[]> = {
  "text-to-image": [
    assetPath("demo/generated/mug-front.jpg"),
    assetPath("demo/generated/mug-handle.jpg"),
    assetPath("demo/generated/mug-rim.jpg"),
    assetPath("demo/generated/mug-home.jpg"),
    assetPath("demo/generated/mug-office.jpg"),
    assetPath("demo/generated/mug-combo.jpg"),
  ],
  "image-to-image": [
    assetPath("demo/bowl-hero.svg"),
    assetPath("demo/bowl-detail.svg"),
    assetPath("demo/bowl-scene.svg"),
  ],
  "ai-retouch": [assetPath("demo/cat-cutout.svg")],
  "outfit-swap": [assetPath("demo/outfit-result.svg")],
};

/**
 * 按旧 Mock 页面规则构造本地演示结果。
 *
 * @param mode AI 修图或模特换装模式。
 * @param imageType 当前图片用途。
 * @param quantity 完整方案数量。
 * @returns 指定数量的本地演示素材 URL。
 */
function buildMockResultImages(
  mode: GenerationMode,
  imageType: ImageType,
  quantity: number,
): string[] {
  const sources = modeResultImages[mode];
  const resultCount = IMAGE_TYPE_RESULT_COUNTS[imageType] * Math.max(1, quantity);
  return Array.from(
    { length: resultCount },
    (_, index) => sources[index % sources.length],
  );
}

/**
 * 把实时状态压平成 LocalStorage 可持久化的单图数组。
 *
 * @param state NDJSON 事件归并状态。
 * @returns 按方案和槽位排序的轻量单图记录。
 */
function flattenLiveImages(state: LiveGenerationState): GenerationTask["liveImages"] {
  return Object.values(state.variants)
    .sort((a, b) => a.index - b.index)
    .flatMap((variant) =>
      Object.values(variant.images)
        .sort((a, b) => a.index - b.index)
        .map((image) => ({
          variantIndex: variant.index,
          imageIndex: image.index,
          role: image.role,
          status: image.status,
          imageUrl: image.imageUrl,
          actualSize: image.actualSize,
          retryCount: image.retryCount,
          error: image.error,
        })),
    );
}

/** 判断历史任务中的模型名是否为当前真实模型。 */
function isLiveModel(model?: string): model is LiveImageModel {
  return ["nano_banana_2", "nano_banana_pro", "gpt_image_2_azure"].includes(
    model ?? "",
  );
}

interface GenerationPageProps {
  mode: GenerationMode;
}

/**
 * 批图匠统一生成工作区。
 *
 * 文生图和图生图走 FastAPI + NDJSON 真实接口；AI 修图和模特换装继续保留
 * 本地 Mock，确保轻量展示原型的其他页面不被未接入能力阻断。
 *
 * @param props.mode 当前业务模式。
 * @returns 当前模式的表单、实时结果或 Mock 历史结果。
 */
export function GenerationPage({ mode }: GenerationPageProps) {
  const config = GENERATION_CONFIG[mode];
  const navigate = useNavigate();
  const location = useLocation();
  const editingTask = (location.state as { task?: GenerationTask } | null)?.task;
  const isLiveMode = mode === "text-to-image" || mode === "image-to-image";
  const [imageType, setImageType] = useState<ImageType>(editingTask?.imageType ?? "set");
  const [retouchMode, setRetouchMode] = useState<RetouchMode>(editingTask?.retouchMode ?? "watermark");
  const [prompt, setPrompt] = useState(editingTask?.prompt ?? "");
  const [quantity, setQuantity] = useState(editingTask?.variantCount ?? editingTask?.quantity ?? 1);
  const [modelValue, setModelValue] = useState<ModelControlValue>({
    model: isLiveModel(editingTask?.model) ? editingTask.model : "nano_banana_2",
    aspectRatio: editingTask?.aspectRatio ?? "1:1",
    resolution: editingTask?.resolution ?? "2K",
    quality: editingTask?.quality ?? "medium",
  });
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [garmentImages, setGarmentImages] = useState<string[]>([]);
  const [modelImages, setModelImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [liveState, setLiveState] = useState<LiveGenerationState>(createInitialLiveState);
  const [liveError, setLiveError] = useState("");
  const [capabilities, setCapabilities] = useState<GenerationCapabilities | null>(null);
  const [visualTemplateId, setVisualTemplateId] = useState(
    editingTask?.visualTemplateId ?? "standard_product",
  );
  const [supplementalInfo, setSupplementalInfo] = useState<Record<string, string>>(
    editingTask?.supplementalInfo ?? {},
  );
  const [tasks, setTasks] = useState<GenerationTask[]>(() =>
    listTasks().filter((task) => task.mode === mode),
  );
  const generationAbortRef = useRef<AbortController | null>(null);
  const hasInlineResults = isLiveMode;
  const templateId = templateIds[imageType];
  const slotCount =
    capabilities?.templates[templateId]?.slot_count ?? IMAGE_TYPE_RESULT_COUNTS[imageType];
  const plannedOutputCount = slotCount * quantity;

  /** 模式变化时重读历史，避免 React Router 复用组件后显示旧页面任务。 */
  useEffect(() => {
    setTasks(listTasks().filter((task) => task.mode === mode));
    setLiveState(createInitialLiveState());
    setLiveError("");
  }, [mode]);

  /** 真实页面启动后读取服务器能力；失败只影响提示，不切换到 Mock。 */
  useEffect(() => {
    if (!isLiveMode) return undefined;
    const controller = new AbortController();
    void fetchGenerationCapabilities(controller.signal)
      .then(setCapabilities)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[批图匠] 暂时无法读取后端能力，表单使用静态能力快照", error);
      });
    return () => controller.abort();
  }, [isLiveMode]);

  /** 页面卸载时中止前端流，避免旧页面继续写状态。 */
  useEffect(
    () => () => {
      generationAbortRef.current?.abort();
    },
    [],
  );

  /** 从 LocalStorage 重新读取当前模式任务。 */
  function refreshTasks() {
    setTasks(listTasks().filter((task) => task.mode === mode));
  }

  /** 把历史任务参数回填到左侧表单。 */
  function editTask(task: GenerationTask) {
    setImageType(task.imageType);
    setRetouchMode(task.retouchMode ?? "watermark");
    setPrompt(task.prompt);
    setQuantity(task.variantCount ?? task.quantity);
    setModelValue({
      model: isLiveModel(task.model) ? task.model : "nano_banana_2",
      aspectRatio: task.aspectRatio,
      resolution: task.resolution,
      quality: task.quality,
    });
    setSourceImages(task.sourceImages);
    setGarmentImages(task.garmentImages);
    setModelImages(task.modelImages);
    setVisualTemplateId(task.visualTemplateId ?? "standard_product");
    setSupplementalInfo(task.supplementalInfo ?? {});
  }

  /** 复用历史参数创建 Mock 任务；真实任务则只回填参数等待用户确认。 */
  function regenerateTask(task: GenerationTask) {
    if (task.mode === "text-to-image" || task.mode === "image-to-image") {
      editTask(task);
      return;
    }
    const next = createMockTask({ ...task, mode: task.mode, prompt: task.prompt });
    saveTask({ ...next, status: "completed", resultImages: [...task.resultImages] });
    refreshTasks();
  }

  /** AI 修图和模特换装继续创建轻量本地 Mock 结果。 */
  function handleMockGenerate() {
    if (isGenerating) return;
    setIsGenerating(true);
    const task = createMockTask({
      mode,
      imageType,
      retouchMode: mode === "ai-retouch" ? retouchMode : undefined,
      prompt: prompt.trim() || config.promptPlaceholder,
      quantity,
      variantCount: quantity,
      aspectRatio: modelValue.aspectRatio,
      sourceImages,
      garmentImages,
      modelImages,
    });
    saveTask(task);
    refreshTasks();
    console.info("[批图匠] 开始模拟生成", { mode, taskId: task.id });
    window.setTimeout(() => {
      const completed = {
        ...task,
        status: "completed" as const,
        resultImages: buildMockResultImages(mode, imageType, quantity),
      };
      saveTask(completed);
      refreshTasks();
      setIsGenerating(false);
      navigate(`/history/${completed.id}`);
    }, 650);
  }

  /**
   * 上传参考图、提交真实任务并持续保存逐张结果。
   *
   * @returns Promise 在 NDJSON 流结束或请求失败时完成。
   * @throws 不向 React 事件层抛出；错误会写入实时面板和历史任务。
   */
  async function handleLiveGenerate(): Promise<void> {
    if (isGenerating) return;
    if (mode !== "text-to-image" && mode !== "image-to-image") return;
    // 显式收窄后保存为局部常量，避免 await 之后 TypeScript 丢失联合类型判断。
    const liveMode = mode;
    if (liveMode === "image-to-image" && sourceFiles.length === 0) {
      setLiveError("图生图请先上传至少一张商品参考图");
      return;
    }
    const requirement = prompt.trim();
    if (!requirement) {
      setLiveError("请先填写商品、卖点或画面要求");
      return;
    }

    setIsGenerating(true);
    setLiveError("");
    let latestState = createInitialLiveState();
    setLiveState(latestState);
    const controller = new AbortController();
    generationAbortRef.current = controller;
    let task = createMockTask({
      mode,
      imageType,
      prompt: requirement,
      model: modelValue.model,
      aspectRatio: modelValue.aspectRatio,
      templateId,
      visualTemplateId,
      supplementalInfo,
      resolution: modelValue.resolution,
      quality: modelValue.quality,
      quantity,
      variantCount: quantity,
      sourceImages,
    });
    saveTask(task);
    refreshTasks();

    try {
      // 每张参考图单独上传，避免一次 multipart 请求越过 Vercel 4.5 MB 限制。
      const referenceAssets =
        liveMode === "image-to-image"
          ? await Promise.all(
              sourceFiles.map((file) => uploadReference(file, controller.signal)),
            )
          : [];
      task = {
        ...task,
        sourceImages: referenceAssets.map((asset) => asset.url),
      };
      saveTask(task);

      await streamGeneration(
        {
          mode: liveMode,
          image_type: imageType,
          template_id: templateId,
          visual_template_id: visualTemplateId,
          model: modelValue.model,
          aspect_ratio: modelValue.aspectRatio,
          resolution: modelValue.resolution,
          quality:
            modelValue.model === "gpt_image_2_azure"
              ? modelValue.quality
              : undefined,
          language: "zh-CN",
          variant_count: quantity,
          user_requirement: requirement,
          supplemental_info: supplementalInfo,
          reference_assets: referenceAssets,
        },
        (event) => {
          latestState = reduceGenerationEvent(latestState, event);
          setLiveState(latestState);
          const shouldPersist = [
            "anchor_completed",
            "image_completed",
            "image_failed",
            "job_completed",
            "job_failed",
          ].includes(event.type);
          if (!shouldPersist) return;
          const taskStatus: GenerationTask["status"] =
            latestState.status === "completed" ||
            latestState.status === "partial_success" ||
            latestState.status === "failed"
              ? latestState.status
              : "generating";
          task = {
            ...task,
            status: taskStatus,
            resultImages: latestState.resultImages,
            liveImages: flattenLiveImages(latestState),
            actualSize: flattenLiveImages(latestState).find((image) => image.actualSize)
              ?.actualSize,
            providerMetadata: { jobId: latestState.jobId },
          };
          saveTask(task);
          refreshTasks();
        },
        controller.signal,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "真实生图失败";
      console.error("[批图匠] 真实生图失败", error);
      setLiveError(message);
      latestState = { ...latestState, status: "failed", message };
      setLiveState(latestState);
      saveTask({ ...task, status: "failed", resultImages: latestState.resultImages });
      refreshTasks();
    } finally {
      if (!controller.signal.aborted) setIsGenerating(false);
      if (generationAbortRef.current === controller) generationAbortRef.current = null;
    }
  }

  /** 根据页面模式调用真实后端或保留的 Mock 能力。 */
  function handleGenerate() {
    if (isLiveMode) void handleLiveGenerate();
    else handleMockGenerate();
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
              <li><b>3</b><span>并发生成</span></li>
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
                {imageTypes.map((item) => {
                  const count = capabilities?.templates[templateIds[item.value]]?.slot_count
                    ?? IMAGE_TYPE_RESULT_COUNTS[item.value];
                  return (
                    <span key={item.value} className={imageType === item.value ? styles.activeCount : ""}>
                      {item.label} {count}张 / 版
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {isLiveMode && (
            <VisualTemplatePicker
              value={visualTemplateId}
              supplementalInfo={supplementalInfo}
              templates={capabilities?.visual_templates ?? DEFAULT_VISUAL_TEMPLATES}
              onChange={setVisualTemplateId}
              onInfoChange={setSupplementalInfo}
            />
          )}

          {config.uploadLabels.map((label, index) => (
            <UploadZone
              key={label}
              label={label}
              onChange={index === 0 ? (mode === "outfit-swap" ? setGarmentImages : setSourceImages) : setModelImages}
              onFilesChange={index === 0 && mode === "image-to-image" ? setSourceFiles : undefined}
              acceptedTypes={mode === "image-to-image" ? ["image/jpeg", "image/png", "image/webp"] : undefined}
              maxFileSize={mode === "image-to-image" ? 4 * 1024 * 1024 : undefined}
            />
          ))}

          {mode === "ai-retouch" && (
            <div className={styles.retouchModes}>
              {retouchModes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={retouchMode === item.value ? styles.selected : ""}
                  onClick={() => setRetouchMode(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <label className={styles.promptField}>
            <span className={styles.fieldLabel}>{config.promptLabel}</span>
            <textarea
              value={prompt}
              maxLength={4000}
              placeholder={config.promptPlaceholder}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <small>{prompt.length}/{isLiveMode ? 4000 : 1000}</small>
          </label>

          <div className={styles.quantityRow}>
            <div className={styles.controlBlock}>
              <span className={styles.fieldLabel}>{isLiveMode ? "完整方案数量" : "每张图片 AI 生成数量"}</span>
              <div className={styles.stepper}>
                <button type="button" aria-label="减少数值" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button>
                <strong>{quantity}</strong>
                <button type="button" aria-label="增加数值" onClick={() => setQuantity(Math.min(4, quantity + 1))}><Plus size={16} /></button>
              </div>
            </div>
            {isLiveMode && (
              <div className={styles.outputMath}>
                <span>每版 {slotCount} 张</span>
                <strong>{quantity} 版 × {slotCount} 张 = {plannedOutputCount} 张</strong>
              </div>
            )}
          </div>

          {isLiveMode ? (
            <ModelControls
              value={modelValue}
              onChange={setModelValue}
              capabilities={capabilities?.models ?? DEFAULT_MODEL_CAPABILITIES}
            />
          ) : (
            <>
              <label className={styles.controlBlock}>
                <span className={styles.fieldLabel}>模型选择</span>
                <span className={styles.selectWrap}><select defaultValue="Ptu1.0"><option>Ptu1.0</option><option>Ptu Turbo</option></select><ChevronDown size={16} /></span>
              </label>
              <div className={styles.ratioBlock}>
                <span className={styles.fieldLabel}>图片尺寸</span>
                <div className={styles.ratios}>
                  {legacyRatios.map((ratio) => (
                    <button key={ratio} type="button" className={modelValue.aspectRatio === ratio ? styles.selected : ""} onClick={() => setModelValue({ ...modelValue, aspectRatio: ratio })}>{ratio}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          <details className={styles.optionalPanel}>
            <summary>批量加文字 / LOGO（选填）<ChevronDown size={16} /></summary>
            <div><input aria-label="Logo 文字" placeholder="LOGO 位置 + LOGO 名称" /><UploadZone label="上传 LOGO" /></div>
          </details>
          {config.hasBackground && (
            <details className={styles.optionalPanel}>
              <summary>批量替换背景（选填）<ChevronDown size={16} /></summary>
              <UploadZone label="上传背景图片" />
            </details>
          )}

          {liveError && <p className={styles.submitError} role="alert">{liveError}</p>}
          <button className={styles.generateButton} type="button" disabled={isGenerating} onClick={handleGenerate}>
            {isGenerating ? <><span className={styles.spinner} />正在处理 {plannedOutputCount} 张图片</> : <><Play size={17} fill="currentColor" />开始生成 {isLiveMode ? `${plannedOutputCount} 张` : ""}</>}
          </button>
          <p className={styles.creditHint}>
            {isLiveMode
              ? mode === "image-to-image"
                ? "原始参考图会被所有槽位复用；图片之间不会串联漂移。"
                : "无图模式先生成基准图 1，再并发生成同版其余图片。"
              : `预计消耗 ${plannedOutputCount} 张图额度`}
          </p>
        </section>

        <section className={`${styles.historySection} ${hasInlineResults ? styles.inlineHistory : ""}`}>
          <div className={styles.historyHeading}><div><span className={styles.eyebrow}>RECENT OUTPUTS</span><h2>历史记录</h2></div><div className={styles.dateInputs}><input aria-label="开始日期" type="date" /><span>→</span><input aria-label="结束日期" type="date" /></div></div>
          <div className={styles.historyTable} role="table">
            <div className={styles.historyRow} role="row"><strong>时间</strong><strong>指令内容</strong><span /></div>
            {tasks.slice(0, 6).map((task) => <Link key={task.id} className={styles.historyRow} to={`/history/${task.id}`}><time>{new Date(task.createdAt).toLocaleDateString("zh-CN")}</time><span>{task.prompt}</span><b>查看</b></Link>)}
          </div>
        </section>
      </div>

      {hasInlineResults && (
        liveState.status === "idle" ? (
          <GenerationResultsPanel mode={mode} tasks={tasks} onEdit={editTask} onRegenerate={regenerateTask} />
        ) : (
          <LiveResultsPanel state={liveState} expectedCount={plannedOutputCount} />
        )
      )}
    </div>
  );
}
