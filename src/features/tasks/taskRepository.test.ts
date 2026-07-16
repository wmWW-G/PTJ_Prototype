import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_TASKS } from "./mockTasks";
import {
  STORAGE_KEY,
  createMockTask,
  getTask,
  listTasks,
  saveTask,
} from "./taskRepository";

describe("taskRepository", () => {
  beforeEach(() => localStorage.clear());

  it("存储内容损坏时回退到演示任务", () => {
    localStorage.setItem(STORAGE_KEY, "broken-json");
    expect(listTasks()).toHaveLength(DEMO_TASKS.length);
  });

  it("保存并读取新任务", () => {
    const task = createMockTask({ mode: "text-to-image", prompt: "马克杯" });
    saveTask(task);
    expect(getTask(task.id)?.prompt).toBe("马克杯");
  });

  it("读取旧版任务时补齐真实生图字段", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "old-task",
          mode: "text-to-image",
          imageType: "main",
          prompt: "旧任务",
          model: "Ptu1.0",
          aspectRatio: "1:1",
          quantity: 1,
          sourceImages: [],
          modelImages: [],
          garmentImages: [],
          resultImages: [],
          status: "completed",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );

    expect(getTask("old-task")).toMatchObject({
      templateId: "main_01",
      resolution: "2K",
      quality: "medium",
      variantCount: 1,
      liveImages: [],
    });
  });
});
