import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { GenerationPage } from "./features/generation/GenerationPage";
import { HistoryDetailPage } from "./features/history/HistoryDetailPage";
import { AppShell } from "./layout/AppShell";

/**
 * 批图匠原型的路由入口。
 *
 * @returns 包含四个生成页面和历史详情页的完整应用。
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate replace to="/text-to-image" />} />
          <Route
            path="/text-to-image"
            element={<GenerationPage mode="text-to-image" />}
          />
          <Route
            path="/image-to-image"
            element={<GenerationPage mode="image-to-image" />}
          />
          <Route
            path="/ai-retouch"
            element={<GenerationPage mode="ai-retouch" />}
          />
          <Route
            path="/outfit-swap"
            element={<GenerationPage mode="outfit-swap" />}
          />
          <Route path="/history/:id" element={<HistoryDetailPage />} />
          <Route path="*" element={<Navigate replace to="/text-to-image" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
