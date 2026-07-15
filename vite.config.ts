import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages 会把项目部署到 /PTJ_Prototype/，构建资源必须带上该前缀。
  base: "/PTJ_Prototype/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
