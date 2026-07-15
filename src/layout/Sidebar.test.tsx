import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DEMO_TASKS } from "../features/tasks/mockTasks";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("展示四个核心生成入口", () => {
    render(
      <MemoryRouter>
        <Sidebar tasks={DEMO_TASKS} />
      </MemoryRouter>,
    );

    for (const label of [
      "批量文生图",
      "批量图生图",
      "批量AI修图",
      "批量模特换装",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});
