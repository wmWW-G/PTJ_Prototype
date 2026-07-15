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
});
