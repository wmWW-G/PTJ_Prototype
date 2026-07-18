import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HistoryDetailPage } from "./HistoryDetailPage";

describe("HistoryDetailPage", () => {
  it("任务不存在时展示可恢复的空状态", () => {
    render(
      <MemoryRouter initialEntries={["/history/missing"]}>
        <Routes><Route path="/history/:id" element={<HistoryDetailPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "没有找到这条生成记录" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回批量生图" })).toBeInTheDocument();
  });
});
