import type {
  GenerationStreamEvent,
  LiveGenerationState,
  LiveImageState,
  LiveVariantState,
  PromptPlanPayload,
} from "./liveTypes";

/** 创建尚未开始的实时任务状态。 */
export function createInitialLiveState(): LiveGenerationState {
  return {
    status: "idle",
    variants: {},
    resultImages: [],
    completedCount: 0,
    failedCount: 0,
  };
}

/**
 * 读取或创建指定方案，始终返回可安全修改的新对象。
 *
 * @param state 当前实时任务。
 * @param variantIndex 方案序号。
 * @returns 浅克隆且 images 已克隆的方案。
 */
function cloneVariant(
  state: LiveGenerationState,
  variantIndex: number,
): LiveVariantState {
  const current = state.variants[variantIndex];
  return current
    ? { ...current, images: { ...current.images } }
    : { index: variantIndex, status: "waiting", images: {} };
}

/**
 * 读取或创建单张结果状态。
 *
 * @param variant 当前方案。
 * @param imageIndex 图片槽位序号。
 * @param role 事件携带的可选角色。
 * @returns 可安全修改的新单图对象。
 */
function cloneImage(
  variant: LiveVariantState,
  imageIndex: number,
  role = "image",
): LiveImageState {
  return variant.images[imageIndex]
    ? { ...variant.images[imageIndex] }
    : {
        index: imageIndex,
        role,
        status: "waiting",
        retryCount: 0,
      };
}

/**
 * 把后端单条事件纯函数式归并到前端状态。
 *
 * 未识别事件直接返回原引用，保证后端增加事件类型时旧前端仍可运行。
 *
 * @param state 当前状态。
 * @param event 新到达的 NDJSON 事件。
 * @returns 归并后的新状态，或未知事件时的原状态。
 */
export function reduceGenerationEvent(
  state: LiveGenerationState,
  event: GenerationStreamEvent,
): LiveGenerationState {
  if (event.type === "job_started") {
    return { ...state, jobId: event.job_id, status: "planning", message: undefined };
  }
  if (event.type === "planning") return { ...state, status: "planning" };

  if (event.type === "plan_ready" && event.variant_index) {
    const variant = cloneVariant(state, event.variant_index);
    const plan = event.data?.plan as PromptPlanPayload | undefined;
    variant.plan = plan;
    if (plan) {
      plan.image_prompts.forEach((prompt) => {
        variant.images[prompt.index] = {
          index: prompt.index,
          role: prompt.role,
          status: "waiting",
          retryCount: 0,
        };
      });
    }
    return {
      ...state,
      status: "generating",
      variants: { ...state.variants, [variant.index]: variant },
    };
  }

  if (event.type === "variant_started" && event.variant_index) {
    const variant = cloneVariant(state, event.variant_index);
    variant.status = "generating";
    return {
      ...state,
      status: "generating",
      variants: { ...state.variants, [variant.index]: variant },
    };
  }

  const imageEvents = new Set([
    "anchor_started",
    "image_started",
    "image_retrying",
    "anchor_completed",
    "image_completed",
    "image_failed",
  ]);
  if (
    imageEvents.has(event.type) &&
    event.variant_index &&
    event.image_index
  ) {
    const variant = cloneVariant(state, event.variant_index);
    const role = String(event.data?.role ?? "image");
    const image = cloneImage(variant, event.image_index, role);

    if (event.type.endsWith("_started")) image.status = "generating";
    if (event.type === "image_retrying") {
      image.status = "retrying";
      image.retryCount = Number(event.data?.attempt ?? image.retryCount + 1);
    }
    if (event.type === "anchor_completed" || event.type === "image_completed") {
      image.status = "completed";
      image.imageUrl = event.image_url;
      image.elapsedMs = Number(event.data?.elapsed_ms ?? 0);
      image.retryCount = Number(event.data?.retry_count ?? image.retryCount);
      const width = event.data?.actual_width;
      const height = event.data?.actual_height;
      if (typeof width === "number" && typeof height === "number") {
        image.actualSize = `${width}x${height}`;
      }
    }
    if (event.type === "image_failed") {
      image.status = "failed";
      image.error = event.message || "图片生成失败";
      image.elapsedMs = Number(event.data?.elapsed_ms ?? 0);
      image.retryCount = Number(event.data?.retry_count ?? image.retryCount);
    }
    variant.images[image.index] = image;
    const variants = { ...state.variants, [variant.index]: variant };
    const resultImages = Object.values(variants)
      .sort((a, b) => a.index - b.index)
      .flatMap((item) =>
        Object.values(item.images)
          .sort((a, b) => a.index - b.index)
          .map((entry) => entry.imageUrl)
          .filter((url): url is string => Boolean(url)),
      );
    return { ...state, variants, resultImages };
  }

  if (event.type === "variant_completed" && event.variant_index) {
    const variant = cloneVariant(state, event.variant_index);
    variant.status = event.status ?? "completed";
    return {
      ...state,
      variants: { ...state.variants, [variant.index]: variant },
    };
  }

  if (event.type === "job_completed") {
    return {
      ...state,
      status:
        event.status === "partial_success" || event.status === "failed"
          ? event.status
          : "completed",
      completedCount: Number(event.data?.completed ?? state.resultImages.length),
      failedCount: Number(event.data?.failed ?? 0),
    };
  }
  if (event.type === "job_failed") {
    return { ...state, status: "failed", message: event.message || "任务失败" };
  }
  return state;
}

