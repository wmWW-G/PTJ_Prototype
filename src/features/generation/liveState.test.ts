import { describe, expect, it } from "vitest";
import {
  createInitialLiveState,
  reduceGenerationEvent,
} from "./liveState";

describe("reduceGenerationEvent", () => {
  it("单张完成后立即写入图片 URL、尺寸和结果列表", () => {
    const initial = createInitialLiveState();
    const started = reduceGenerationEvent(initial, {
      type: "image_started",
      job_id: "job-1",
      variant_index: 1,
      image_index: 2,
      status: "generating",
      data: { role: "selling_point" },
    });
    const completed = reduceGenerationEvent(started, {
      type: "image_completed",
      job_id: "job-1",
      variant_index: 1,
      image_index: 2,
      status: "completed",
      image_url: "https://blob.example/2.png",
      data: {
        role: "selling_point",
        actual_width: 2048,
        actual_height: 2048,
        elapsed_ms: 42000,
        retry_count: 1,
      },
    });

    expect(completed.variants[1].images[2]).toMatchObject({
      status: "completed",
      imageUrl: "https://blob.example/2.png",
      actualSize: "2048x2048",
      retryCount: 1,
    });
    expect(completed.resultImages).toEqual(["https://blob.example/2.png"]);
  });

  it("未知事件保持原状态引用，方便未来后端扩展", () => {
    const initial = createInitialLiveState();
    const next = reduceGenerationEvent(initial, {
      type: "future_event",
      job_id: "job-1",
    });
    expect(next).toBe(initial);
  });

  it("任务部分成功时保存最终状态", () => {
    const initial = createInitialLiveState();
    const next = reduceGenerationEvent(initial, {
      type: "job_completed",
      job_id: "job-1",
      status: "partial_success",
      data: { completed: 5, failed: 1 },
    });
    expect(next.status).toBe("partial_success");
    expect(next.completedCount).toBe(5);
    expect(next.failedCount).toBe(1);
  });
});

