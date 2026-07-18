import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DEMO_TASKS } from "../features/tasks/mockTasks";
import generationStyles from "../features/generation/GenerationPage.module.css?raw";
import shellStyles from "./AppShell.module.css?raw";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("展示合并后的三个核心生成入口", () => {
    render(
      <MemoryRouter>
        <Sidebar tasks={DEMO_TASKS} />
      </MemoryRouter>,
    );

    for (const label of [
      "批量生图",
      "批量AI修图",
      "批量模特换装",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: "批量文生图" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "批量图生图" })).not.toBeInTheDocument();
  });

  it("主工作区不会被双栏最小宽度撑出横向滚动", () => {
    expect(shellStyles).toContain("overflow-x: clip");
    expect(generationStyles).toContain("grid-template-columns: minmax(380px, .78fr) minmax(0, 1.22fr)");
    expect(generationStyles).not.toContain("minmax(620px, 1.22fr)");
    expect(generationStyles).not.toContain("minmax(500px, 1.1fr)");
  });
});
