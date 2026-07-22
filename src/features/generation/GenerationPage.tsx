import { ChevronDown, Minus, Play, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { assetPath } from "../../lib/assetPath";
import { createMockTask, listTasks, saveTask } from "../tasks/taskRepository";
import type {
  CustomVisualRoleSelection,
  GenerationMode,
  GenerationTask,
  ImageType,
  LogoPosition,
  RetouchMode,
} from "../tasks/types";
import {
  fetchGenerationCapabilities,
  refineGenerationPrompt,
  streamGeneration,
  streamPromptPlanning,
  uploadReference,
} from "./api";
import {
  GENERATION_CONFIG,
  IMAGE_TYPE_RESULT_COUNTS,
  type GenerationPageMode,
} from "./config";
import { GenerationResultsPanel } from "./components/GenerationResultsPanel";
import { LiveResultsPanel } from "./components/LiveResultsPanel";
import { PromptReviewPanel } from "./components/PromptReviewPanel";
import {
  DEFAULT_MODEL_CAPABILITIES,
  ModelControls,
  type ModelControlValue,
} from "./components/ModelControls";
import { PromptImageComposer } from "./components/PromptImageComposer";
import { UploadZone } from "./components/UploadZone";
import {
  DEFAULT_VISUAL_TEMPLATES,
  VisualTemplatePicker,
} from "./components/VisualTemplatePicker";
import { createInitialLiveState, reduceGenerationEvent } from "./liveState";
import type {
  GenerationCapabilities,
  LiveGenerationRequest,
  LiveGenerationState,
  LiveImageModel,
  PlannedImagePrompt,
  PromptPlanPayload,
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
type TemplatedImageType = Extract<ImageType, "set" | "listing">;
const defaultVisualTemplateIds: Record<TemplatedImageType, string> = {
  set: "standard_product",
  listing: "b2b_procurement_listing",
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
          title: image.title,
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
  return ["nano_banana_2", "nano_banana_pro", "gpt_image_2_openrouter"].includes(
    model ?? "",
  );
}

/**
 * 判断持久化任务是否属于当前页面入口。
 *
 * 统一生图入口会同时展示历史文生图和图生图任务；另外两个 Mock 页面仍只
 * 展示自己的业务任务。
 *
 * @param task 已保存的历史任务。
 * @param pageMode 当前页面入口。
 * @returns 该任务是否应出现在当前页面。
 */
function taskBelongsToPage(
  task: GenerationTask,
  pageMode: GenerationPageMode,
): boolean {
  if (pageMode === "generate") {
    return task.mode === "text-to-image" || task.mode === "image-to-image";
  }
  return task.mode === pageMode;
}

interface GenerationPageProps {
  mode: GenerationPageMode;
}

/** 用户确认 Prompt 前保存在内存中的请求快照。 */
interface PromptReviewDraft {
  request: LiveGenerationRequest;
  plans: PromptPlanPayload[];
  task: GenerationTask;
}

/**
 * 批图匠统一生成工作区。
 *
 * 统一生图入口走 FastAPI + NDJSON 真实接口；是否存在参考图由后端自动
 * 归一为文生图或图生图。AI 修图和模特换装继续保留本地 Mock。
 *
 * @param props.mode 当前业务模式。
 * @returns 当前模式的表单、实时结果或 Mock 历史结果。
 */
export function GenerationPage({ mode }: GenerationPageProps) {
  const config = GENERATION_CONFIG[mode];
  const navigate = useNavigate();
  const location = useLocation();
  const editingTask = (location.state as { task?: GenerationTask } | null)?.task;
  const isLiveMode = mode === "generate";
  const [imageType, setImageType] = useState<ImageType>(editingTask?.imageType ?? "set");
  const [retouchMode, setRetouchMode] = useState<RetouchMode>(editingTask?.retouchMode ?? "watermark");
  const [prompt, setPrompt] = useState(editingTask?.prompt ?? "");
  const [quantity, setQuantity] = useState(editingTask?.variantCount ?? editingTask?.quantity ?? 1);
  const [modelValue, setModelValue] = useState<ModelControlValue>({
    model: isLiveModel(editingTask?.model) ? editingTask.model : "gpt_image_2_openrouter",
    aspectRatio: editingTask?.aspectRatio ?? "1:1",
    resolution: editingTask?.resolution ?? "2K",
    quality: editingTask?.quality ?? "medium",
  });
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [styleImages, setStyleImages] = useState<string[]>([]);
  const [styleFiles, setStyleFiles] = useState<File[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>(
    editingTask?.logoPosition ?? "bottom-right",
  );
  const [garmentImages, setGarmentImages] = useState<string[]>([]);
  const [modelImages, setModelImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlanningPrompts, setIsPlanningPrompts] = useState(false);
  const [liveState, setLiveState] = useState<LiveGenerationState>(createInitialLiveState);
  const [liveError, setLiveError] = useState("");
  const [promptReview, setPromptReview] = useState<PromptReviewDraft | null>(null);
  const [activeExpectedCount, setActiveExpectedCount] = useState(0);
  const [capabilities, setCapabilities] = useState<GenerationCapabilities | null>(null);
  // 套图和详情图维护各自的模板选择，用户来回切换图片类型时不会互相覆盖。
  const [visualTemplateIds, setVisualTemplateIds] = useState<Record<TemplatedImageType, string>>({
    set: editingTask?.imageType === "set"
      ? editingTask.visualTemplateId ?? defaultVisualTemplateIds.set
      : defaultVisualTemplateIds.set,
    listing: editingTask?.imageType === "listing"
      ? editingTask.visualTemplateId ?? defaultVisualTemplateIds.listing
      : defaultVisualTemplateIds.listing,
  });
  // 套图和详情图各自保存自定义职责顺序；切换图片类型或暂时使用预设模板时不丢失。
  const [customVisualRoles, setCustomVisualRoles] = useState<
    Record<TemplatedImageType, CustomVisualRoleSelection[]>
  >({
    set: editingTask?.imageType === "set"
      ? (editingTask.customVisualRoles ?? []).map((role) => ({ ...role }))
      : [],
    listing: editingTask?.imageType === "listing"
      ? (editingTask.customVisualRoles ?? []).map((role) => ({ ...role }))
      : [],
  });
  const [supplementalInfo, setSupplementalInfo] = useState<Record<string, string>>(
    editingTask?.supplementalInfo ?? {},
  );
  const [tasks, setTasks] = useState<GenerationTask[]>(() =>
    listTasks().filter((task) => taskBelongsToPage(task, mode)),
  );
  const generationAbortRef = useRef<AbortController | null>(null);
  const hasInlineResults = isLiveMode;
  const templateId = templateIds[imageType];
  const visualTemplateId = imageType === "set" || imageType === "listing"
    ? visualTemplateIds[imageType]
    : "standard_product";
  const activeCustomVisualRoles = imageType === "set" || imageType === "listing"
    ? customVisualRoles[imageType]
    : [];
  const activeGenerationMode: Extract<GenerationMode, "text-to-image" | "image-to-image"> =
    sourceFiles.length > 0 || (imageType === "main" && styleFiles.length > 0) || logoFile
      ? "image-to-image"
      : "text-to-image";
  const slotCount =
    capabilities?.templates[templateId]?.slot_count ?? IMAGE_TYPE_RESULT_COUNTS[imageType];
  const plannedOutputCount = slotCount * quantity;

  /** 只更新当前有模板选择器的图片类型，保持套图和详情图各自的选择。 */
  function setActiveVisualTemplateId(templateValue: string) {
    if (imageType !== "set" && imageType !== "listing") return;
    setVisualTemplateIds((current) => ({ ...current, [imageType]: templateValue }));
  }

  /** 更新当前图片类型的自定义职责顺序，不影响另一种图片类型。 */
  function setActiveCustomVisualRoles(roles: CustomVisualRoleSelection[]) {
    if (imageType !== "set" && imageType !== "listing") return;
    setCustomVisualRoles((current) => ({
      ...current,
      [imageType]: roles.map((role) => ({ ...role })),
    }));
  }

  /** 模式变化时重读历史，避免 React Router 复用组件后显示旧页面任务。 */
  useEffect(() => {
    setTasks(listTasks().filter((task) => taskBelongsToPage(task, mode)));
    setLiveState(createInitialLiveState());
    setLiveError("");
    setPromptReview(null);
    setActiveExpectedCount(0);
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
    setTasks(listTasks().filter((task) => taskBelongsToPage(task, mode)));
  }

  /** AI 修图和模特换装继续创建轻量本地 Mock 结果。 */
  function handleMockGenerate() {
    if (isGenerating || mode === "generate") return;
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
   * 上传参考图并只让文本 LLM 规划逐张 Prompt。
   *
   * 此阶段不会保存历史任务，也不会把请求交给图片模型。所有上传资产、参数和
   * Prompt 计划会作为同一份内存快照，等待用户确认后再执行。
   *
   * @returns Promise 在 Prompt 计划完成或错误已展示后结束。
   * @throws 不向 React 事件层抛出；错误会写入表单和右侧规划状态。
   */
  async function handlePromptPlanning(): Promise<void> {
    if (isGenerating) return;
    if (mode !== "generate") return;
    const typedRequirement = prompt.trim();
    if (!typedRequirement && sourceFiles.length === 0) {
      setLiveError("请先上传商品参考图，或填写补充文字要求");
      return;
    }
    // 后端 Planner 需要非空文本。用户只上传图片时，用中性的执行说明补齐，
    // 不虚构商品卖点，也不强迫用户为了提交而重复描述图片内容。
    const requirement = typedRequirement || (
      imageType === "main"
        ? "请以已上传的产品素材图为主体，保留商品真实外观与关键特征；参考设计图只用于构图、光线与画面风格。"
        : "请以已上传的商品参考图为主体，保留商品真实外观与关键特征，并按当前图片类型生成电商图片。"
    );

    setIsGenerating(true);
    setIsPlanningPrompts(true);
    setLiveError("");
    setPromptReview(null);
    setLiveState({ ...createInitialLiveState(), status: "planning" });
    const controller = new AbortController();
    generationAbortRef.current = controller;

    try {
      // 每张参考图单独上传，避免一次 multipart 请求越过 Vercel 4.5 MB 限制。
      const referenceAssets = await Promise.all(
        sourceFiles.map((file) => uploadReference(file, controller.signal)),
      );
      // 主图参考设计图单独上传和传参，只用于学习构图与风格。
      const styleReferenceAssets = imageType === "main"
        ? await Promise.all(
          styleFiles.map((file) => uploadReference(file, controller.signal)),
        )
        : [];
      // Logo 复用同一受控上传接口，但在请求中保持独立字段，避免商品分析误判。
      const logoAsset = logoFile
        ? await uploadReference(logoFile, controller.signal)
        : undefined;
      const task = createMockTask({
        // 历史任务仍保留最终业务模式，但只有用户确认并开始生图后才真正保存。
        mode: activeGenerationMode,
        imageType,
        prompt: requirement,
        model: modelValue.model,
        aspectRatio: modelValue.aspectRatio,
        templateId,
        visualTemplateId,
        customVisualRoles: visualTemplateId.startsWith("custom_")
          ? activeCustomVisualRoles
          : [],
        supplementalInfo,
        resolution: modelValue.resolution,
        quality: modelValue.quality,
        quantity,
        variantCount: quantity,
        styleImages: styleReferenceAssets.map((asset) => asset.url),
        sourceImages: referenceAssets.map((asset) => asset.url),
        logoImage: logoAsset?.url,
        logoPosition,
      });
      const request: LiveGenerationRequest = {
        image_type: imageType,
        template_id: templateId,
        visual_template_id: visualTemplateId,
        custom_visual_roles: visualTemplateId.startsWith("custom_")
          ? activeCustomVisualRoles
          : [],
        model: modelValue.model,
        aspect_ratio: modelValue.aspectRatio,
        resolution: modelValue.resolution,
        quality:
          modelValue.model === "gpt_image_2_openrouter"
            ? modelValue.quality
            : undefined,
        language: "zh-CN",
        variant_count: quantity,
        user_requirement: requirement,
        supplemental_info: supplementalInfo,
        style_reference_assets: styleReferenceAssets,
        reference_assets: referenceAssets,
        logo_asset: logoAsset,
        logo_position: logoAsset ? logoPosition : undefined,
      };
      const plansByVariant: Record<number, PromptPlanPayload> = {};
      let planningFailure = "";

      await streamPromptPlanning(
        { ...request, planning_only: true },
        (event) => {
          if (event.type === "plan_ready" && event.variant_index) {
            const nextPlan = event.data?.plan as PromptPlanPayload | undefined;
            if (nextPlan) plansByVariant[event.variant_index] = nextPlan;
          }
          if (event.type === "job_failed") {
            planningFailure = event.message || "Prompt 规划失败";
          }
        },
        controller.signal,
      );
      if (planningFailure) throw new Error(planningFailure);
      const plans = Object.entries(plansByVariant)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([, plan]) => plan);
      if (plans.length !== quantity) {
        throw new Error("Prompt 规划已结束，但返回的方案数量不完整");
      }
      setPromptReview({ request, plans, task });
      setLiveState(createInitialLiveState());
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Prompt 规划失败";
      console.error("[批图匠] Prompt 规划失败", error);
      setLiveError(message);
      setLiveState({ ...createInitialLiveState(), status: "failed", message });
    } finally {
      if (!controller.signal.aborted) {
        setIsGenerating(false);
        setIsPlanningPrompts(false);
      }
      if (generationAbortRef.current === controller) generationAbortRef.current = null;
    }
  }

  /**
   * 根据用户意见只优化当前方案中的一张 Prompt。
   *
   * @param variantIndex Prompt 所在方案的 1-based 序号。
   * @param imagePrompt 当前单张 Prompt。
   * @param feedback 用户输入的具体改进意见。
   * @returns Promise 在新 Prompt 写回审核面板后完成。
   * @throws 后端或网络错误会继续抛给审核组件展示。
   */
  async function handleRefinePrompt(
    variantIndex: number,
    imagePrompt: PlannedImagePrompt,
    feedback: string,
  ): Promise<void> {
    const draft = promptReview;
    const plan = draft?.plans[variantIndex - 1];
    if (!draft || !plan) throw new Error("当前 Prompt 方案已经失效，请重新生成");

    const controller = new AbortController();
    generationAbortRef.current = controller;
    try {
      const refinedPrompt = await refineGenerationPrompt({
        image_prompt: imagePrompt,
        global_consistency_prompt: plan.global_consistency_prompt,
        user_requirement: draft.request.user_requirement,
        feedback,
        language: draft.request.language ?? "zh-CN",
        target_model: draft.request.model,
      }, controller.signal);
      setPromptReview((current) => {
        if (!current) return current;
        const plans = current.plans.map((currentPlan, planIndex) => (
          planIndex === variantIndex - 1
            ? {
                ...currentPlan,
                image_prompts: currentPlan.image_prompts.map((currentPrompt) => (
                  currentPrompt.index === imagePrompt.index ? refinedPrompt : currentPrompt
                )),
              }
            : currentPlan
        ));
        return { ...current, plans };
      });
    } finally {
      if (generationAbortRef.current === controller) generationAbortRef.current = null;
    }
  }

  /**
   * 使用用户确认后的 Prompt 启动真实图片任务，并持续保存逐张结果。
   *
   * @returns Promise 在 NDJSON 图片流结束或错误已持久化后完成。
   * @throws 不向 React 事件层抛出；错误会写入实时面板和历史任务。
   */
  async function handleConfirmedGeneration(): Promise<void> {
    const draft = promptReview;
    if (!draft || isGenerating || mode !== "generate") return;

    setPromptReview(null);
    setIsGenerating(true);
    setIsPlanningPrompts(false);
    setLiveError("");
    setActiveExpectedCount(
      draft.plans.reduce((total, plan) => total + plan.image_prompts.length, 0),
    );
    let latestState = createInitialLiveState();
    setLiveState(latestState);
    const controller = new AbortController();
    generationAbortRef.current = controller;
    let task: GenerationTask = { ...draft.task, status: "generating" };
    saveTask(task);
    refreshTasks();

    try {
      await streamGeneration(
        { ...draft.request, confirmed_plans: draft.plans },
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
          const liveImages = flattenLiveImages(latestState);
          task = {
            ...task,
            status: taskStatus,
            resultImages: latestState.resultImages,
            liveImages,
            actualSize: liveImages.find((image) => image.actualSize)?.actualSize,
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
    if (isLiveMode) void handlePromptPlanning();
    else handleMockGenerate();
  }

  return (
    <div className={`${styles.page} ${hasInlineResults ? styles.splitPage : ""}`}>
      <div className={styles.formColumn}>
        {!isLiveMode && (
          <header className={styles.pageHeader}>
            <h1>{config.title}</h1>
          </header>
        )}

        <section className={styles.workspace}>
          {config.hasImageTypes && (
            <div className={styles.imageTypeBlock}>
              <div className={styles.segmented} aria-label="图片类型">
                {imageTypes.map((item) => {
                  // 每种图片类型的固定张数直接放进对应按钮，减少用户上下对照的成本。
                  const count = capabilities?.templates[templateIds[item.value]]?.slot_count
                    ?? IMAGE_TYPE_RESULT_COUNTS[item.value];
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-label={`${item.label}，${count}张每版`}
                      aria-pressed={imageType === item.value}
                      className={imageType === item.value ? styles.selected : ""}
                      onClick={() => setImageType(item.value)}
                    >
                      <span>{item.label}</span>
                      <small>{count}张 / 版</small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isLiveMode && (imageType === "set" || imageType === "listing") && (
            <VisualTemplatePicker
              key={imageType}
              imageType={imageType}
              value={visualTemplateId}
              customRoles={activeCustomVisualRoles}
              supplementalInfo={supplementalInfo}
              templates={{
                ...DEFAULT_VISUAL_TEMPLATES,
                ...(capabilities?.visual_templates ?? {}),
              }}
              onChange={setActiveVisualTemplateId}
              onCustomRolesChange={setActiveCustomVisualRoles}
              onInfoChange={setSupplementalInfo}
            />
          )}

          {!isLiveMode && config.uploadLabels.map((label, index) => (
            <UploadZone
              key={label}
              label={label}
              onChange={index === 0 ? (mode === "outfit-swap" ? setGarmentImages : setSourceImages) : setModelImages}
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

          {isLiveMode ? (
            <PromptImageComposer
              layout={imageType === "main" ? "main" : "standard"}
              label={imageType === "main" ? "补充要求（选填）" : config.promptLabel}
              value={prompt}
              placeholder={imageType === "main"
                ? "简单补充背景、场景、文案或必须保留的细节"
                : config.promptPlaceholder}
              maxLength={imageType === "main" ? 500 : 4000}
              onChange={setPrompt}
              onImagesChange={(urls, files) => {
                setSourceImages(urls);
                setSourceFiles(files);
              }}
              onStyleImagesChange={(urls, files) => {
                setStyleImages(urls);
                setStyleFiles(files);
              }}
              maxImages={imageType === "main" ? 6 : 10}
              logoPosition={logoPosition}
              onLogoChange={(file, position) => {
                setLogoFile(file);
                setLogoPosition(position);
              }}
            />
          ) : (
            <label className={styles.promptField}>
              <span className={styles.fieldLabel}>{config.promptLabel}</span>
              <textarea
                value={prompt}
                maxLength={1000}
                placeholder={config.promptPlaceholder}
                onChange={(event) => setPrompt(event.target.value)}
              />
              <small>{prompt.length}/1000</small>
            </label>
          )}

          {!isLiveMode && (
            <div className={styles.quantityRow}>
              <div className={styles.controlBlock}>
                <span className={styles.fieldLabel}>每张图片 AI 生成数量</span>
                <div className={styles.stepper}>
                  <button type="button" aria-label="减少数值" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button>
                  <strong>{quantity}</strong>
                  <button type="button" aria-label="增加数值" onClick={() => setQuantity(Math.min(4, quantity + 1))}><Plus size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {isLiveMode ? (
            <ModelControls
              value={modelValue}
              onChange={setModelValue}
              capabilities={capabilities?.models ?? DEFAULT_MODEL_CAPABILITIES}
              variantCount={quantity}
              imagesPerVariant={slotCount}
              onVariantCountChange={setQuantity}
              maxVariantCount={capabilities?.max_variant_count ?? 10}
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

          {config.hasBackground && (!isLiveMode || sourceFiles.length > 0) && (
            <details className={styles.optionalPanel}>
              <summary>批量替换背景（选填）<ChevronDown size={16} /></summary>
              <UploadZone label="上传背景图片" />
            </details>
          )}

          {liveError && <p className={styles.submitError} role="alert">{liveError}</p>}
          <button className={styles.generateButton} type="button" disabled={isGenerating} onClick={handleGenerate}>
            {isGenerating
              ? <><span className={styles.spinner} />{isPlanningPrompts ? "正在生成 Prompt" : `正在处理 ${plannedOutputCount} 张图片`}</>
              : <><Play size={17} fill="currentColor" />{isLiveMode ? (promptReview ? "重新生成 Prompt" : "生成 Prompt") : "开始生成"}</>}
          </button>
          <p className={styles.creditHint}>
            {isLiveMode
              ? "先确认逐张 Prompt；确认后才开始真实生图并消耗图片额度。"
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
        promptReview ? (
          <PromptReviewPanel
            plans={promptReview.plans}
            expectedCount={promptReview.plans.reduce(
              (total, plan) => total + plan.image_prompts.length,
              0,
            )}
            isStarting={isGenerating}
            onRefine={handleRefinePrompt}
            onConfirm={() => void handleConfirmedGeneration()}
          />
        ) : liveState.status === "idle" ? (
          <GenerationResultsPanel tasks={tasks} />
        ) : (
          <LiveResultsPanel
            state={liveState}
            expectedCount={activeExpectedCount || plannedOutputCount}
          />
        )
      )}
    </div>
  );
}
