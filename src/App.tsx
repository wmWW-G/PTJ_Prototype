import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { GenerationPage } from "./features/generation/GenerationPage";
import { HistoryDetailPage } from "./features/history/HistoryDetailPage";
import { AppShell } from "./layout/AppShell";

/**
 * 批图匠原型的路由入口。
 *
 * @returns 包含统一生图、AI 修图、模特换装和历史详情页的完整应用。
 */
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate replace to="/generation" />} />
          <Route
            path="/generation"
            element={<GenerationPage mode="generate" />}
          />
          {/* 保留旧地址跳转，避免收藏夹和历史链接在入口合并后失效。 */}
          <Route path="/text-to-image" element={<Navigate replace to="/generation" />} />
          <Route path="/image-to-image" element={<Navigate replace to="/generation" />} />
          <Route
            path="/ai-retouch"
            element={<GenerationPage mode="ai-retouch" />}
          />
          <Route
            path="/outfit-swap"
            element={<GenerationPage mode="outfit-swap" />}
          />
          <Route path="/history/:id" element={<HistoryDetailPage />} />
          <Route path="*" element={<Navigate replace to="/generation" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
