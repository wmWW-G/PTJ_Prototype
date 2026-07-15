# 批图匠高保真原型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可部署到 Vercel 的批图匠核心业务高保真可交互原型。

**Architecture:** React Router 驱动五个路由，`AppShell` 统一顶栏和侧栏，四个业务页由配置驱动的 `GenerationWorkspace` 复用。任务数据通过 `taskRepository` 抽象读写，当前使用 LocalStorage，后续可替换为 Dify/Vercel API。

**Tech Stack:** React 19、TypeScript、Vite、React Router、Vitest、Testing Library、CSS Modules、Lucide React。

## Global Constraints

- 第一阶段不调用 Dify，不实现真实图片生成、真实下载、登录、注册、充值、教程或账户管理。
- 不复制真实手机号、余额、Token、API Key 或用户私有图片。
- 单个上传区最多 10 张，单张不超过 10 MB。
- 支持 JPEG、PNG、WebP、BMP、TIFF、GIF。
- 所有关键函数必须有清晰中文注释和类型提示。
- 运行状态、任务创建和异常必须写入浏览器控制台日志。
- Vercel 子路由刷新必须回退到 SPA 入口。

---

### Task 1: 工程骨架与测试环境

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`
- Create: `vercel.json`

**Interfaces:**
- Consumes: 无。
- Produces: `App(): JSX.Element`、Vite/Vitest 运行环境、SPA 重写规则。

- [ ] **Step 1: 创建依赖和 TypeScript/Vite 配置**

`package.json` 必须提供 `dev`、`build`、`test`、`test:run`、`lint` 脚本，并安装 React、React Router、Lucide、Vitest、jsdom 和 Testing Library。

- [ ] **Step 2: 写失败的路由测试**

```tsx
it("renders the text-to-image workspace by default", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "批量文生图" })).toBeInTheDocument();
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:run -- src/App.test.tsx`
Expected: FAIL，因为路由和页面尚未实现。

- [ ] **Step 4: 创建最小 App 与入口**

```tsx
export function App() {
  return <h1>批量文生图</h1>;
}
```

- [ ] **Step 5: 验证基础工程**

Run: `npm run test:run -- src/App.test.tsx && npm run build`
Expected: 测试和构建均通过。

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json vite.config.ts tsconfig*.json index.html src/main.tsx src/App.tsx src/test/setup.ts src/App.test.tsx vercel.json
git commit -m "build: scaffold PTJ prototype"
```

### Task 2: 任务领域模型与 LocalStorage 仓库

**Files:**
- Create: `src/features/tasks/types.ts`
- Create: `src/features/tasks/mockTasks.ts`
- Create: `src/features/tasks/taskRepository.ts`
- Create: `src/features/tasks/taskRepository.test.ts`

**Interfaces:**
- Consumes: 浏览器 `localStorage`。
- Produces: `GenerationTask`、`listTasks()`、`getTask(id)`、`saveTask(task)`、`createMockTask(input)`。

- [ ] **Step 1: 写仓库失败测试**

```ts
it("falls back to demo tasks when storage is corrupt", () => {
  localStorage.setItem(STORAGE_KEY, "broken-json");
  expect(listTasks()).toHaveLength(DEMO_TASKS.length);
});

it("persists a new task", () => {
  const task = createMockTask({ mode: "text-to-image", prompt: "马克杯" });
  saveTask(task);
  expect(getTask(task.id)?.prompt).toBe("马克杯");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- src/features/tasks/taskRepository.test.ts`
Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 实现类型、演示数据和仓库**

`GenerationTask` 完整包含 mode、imageType、prompt、model、aspectRatio、quantity、各类图片数组、status 和 createdAt。解析异常时记录 `console.warn` 并返回演示任务副本。

- [ ] **Step 4: 运行仓库测试**

Run: `npm run test:run -- src/features/tasks/taskRepository.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/features/tasks
git commit -m "feat: add prototype task repository"
```

### Task 3: 全局外壳与视觉系统

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/layout/AppShell.tsx`
- Create: `src/layout/AppShell.module.css`
- Create: `src/layout/TopBar.tsx`
- Create: `src/layout/Sidebar.tsx`
- Create: `src/layout/Sidebar.test.tsx`
- Create: `src/components/BrandMark.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `listTasks(): GenerationTask[]`。
- Produces: `AppShell` 的 `<Outlet />` 布局、四个导航入口和历史任务入口。

- [ ] **Step 1: 写侧栏失败测试**

```tsx
it("shows the four generation tools", () => {
  render(<MemoryRouter><Sidebar tasks={DEMO_TASKS} /></MemoryRouter>);
  for (const label of ["批量文生图", "批量图生图", "批量AI修图", "批量模特换装"]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- src/layout/Sidebar.test.tsx`
Expected: FAIL，组件尚不存在。

- [ ] **Step 3: 实现设计令牌和共用外壳**

设计令牌使用浅灰蓝背景、白色工作区、紫色主色、紧凑桌面间距和 12px 圆角。顶部只展示演示余额、演示配额和“演示账号”。

- [ ] **Step 4: 配置五个路由**

```tsx
<Route element={<AppShell />}>
  <Route path="/text-to-image" element={<GenerationPage mode="text-to-image" />} />
  <Route path="/image-to-image" element={<GenerationPage mode="image-to-image" />} />
  <Route path="/ai-retouch" element={<GenerationPage mode="ai-retouch" />} />
  <Route path="/outfit-swap" element={<GenerationPage mode="outfit-swap" />} />
  <Route path="/history/:id" element={<HistoryDetailPage />} />
</Route>
```

- [ ] **Step 5: 运行测试**

Run: `npm run test:run -- src/layout/Sidebar.test.tsx src/App.test.tsx`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/styles src/layout src/components src/main.tsx src/App.tsx
git commit -m "feat: build PTJ application shell"
```

### Task 4: 配置驱动的四个生成页面

**Files:**
- Create: `src/features/generation/config.ts`
- Create: `src/features/generation/GenerationPage.tsx`
- Create: `src/features/generation/GenerationPage.module.css`
- Create: `src/features/generation/GenerationPage.test.tsx`
- Create: `src/features/generation/components/UploadZone.tsx`
- Create: `src/features/generation/components/ImageTypeSelector.tsx`
- Create: `src/features/generation/components/QuantityStepper.tsx`
- Create: `src/features/generation/components/AspectRatioSelector.tsx`
- Create: `src/features/generation/components/OptionalBranding.tsx`
- Create: `src/features/generation/components/TaskHistoryTable.tsx`
- Create: `src/features/generation/components/ResultCard.tsx`

**Interfaces:**
- Consumes: `GenerationMode`、`createMockTask()`、`saveTask()`。
- Produces: `GenerationPage({mode})`、上传校验、Mock 生成和页面级回填。

- [ ] **Step 1: 写四页差异测试**

```tsx
it.each([
  ["text-to-image", "产品+卖点"],
  ["image-to-image", "上传商品参考图"],
  ["ai-retouch", "去水印"],
  ["outfit-swap", "更换服装图"],
])("renders %s controls", (mode, label) => {
  render(<MemoryRouter><GenerationPage mode={mode as GenerationMode} /></MemoryRouter>);
  expect(screen.getByText(label)).toBeInTheDocument();
});
```

- [ ] **Step 2: 写上传校验测试**

```tsx
it("rejects a file larger than 10 MB", async () => {
  const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
  await userEvent.upload(screen.getByLabelText("上传商品参考图"), file);
  expect(screen.getByText(/超过 10MB/)).toBeInTheDocument();
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:run -- src/features/generation/GenerationPage.test.tsx`
Expected: FAIL，页面组件尚不存在。

- [ ] **Step 4: 实现页面配置和原子控件**

`GENERATION_CONFIG` 为每种 mode 明确标题、Prompt 占位、上传区、附加模块和默认模式；所有函数添加中文注释并记录关键状态日志。

- [ ] **Step 5: 实现 Mock 生成流程**

提交时创建 `generating` 任务，500ms 后更新为 `completed`，写入演示结果图并导航到 `/history/:id`。重复提交期间按钮禁用。

- [ ] **Step 6: 运行页面测试**

Run: `npm run test:run -- src/features/generation/GenerationPage.test.tsx`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/features/generation
git commit -m "feat: add four interactive generation workspaces"
```

### Task 5: 历史详情、响应式和交付验证

**Files:**
- Create: `src/features/history/HistoryDetailPage.tsx`
- Create: `src/features/history/HistoryDetailPage.module.css`
- Create: `src/features/history/HistoryDetailPage.test.tsx`
- Create: `src/components/Toast.tsx`
- Create: `src/components/Toast.module.css`
- Create: `public/demo/placeholder-product.svg`
- Create: `README.md`
- Modify: `DEV_LOG.md`

**Interfaces:**
- Consumes: `getTask(id)`、`saveTask(task)`。
- Produces: 历史详情、重新编辑、再次生成、模拟下载反馈和完整交付说明。

- [ ] **Step 1: 写历史详情失败测试**

```tsx
it("shows a helpful state for an unknown task", () => {
  render(<MemoryRouter initialEntries={["/history/missing"]}><App /></MemoryRouter>);
  expect(screen.getByText("没有找到这条生成记录")).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- src/features/history/HistoryDetailPage.test.tsx`
Expected: FAIL，页面尚不存在。

- [ ] **Step 3: 实现详情操作和空状态**

重新编辑导航回对应 mode 并通过路由 state 回填；再次生成复制参数创建新任务；全部下载展示“原型阶段暂不生成下载文件”。

- [ ] **Step 4: 完成响应式样式和 README**

在 1180px 以下收窄侧栏，在 820px 以下将侧栏改为顶部横向导航、表单改为单列。README 写清安装、开发、构建、Vercel 部署和未来 Dify 环境变量边界。

- [ ] **Step 5: 运行完整验证**

Run: `npm run test:run && npm run build`
Expected: 全部测试通过，Vite 构建成功。

- [ ] **Step 6: 浏览器验收**

运行 `npm run dev -- --host 127.0.0.1`，逐页检查五个路由、四种模式差异、Mock 生成、历史持久化、重新编辑和错误上传反馈。

- [ ] **Step 7: 更新日志并提交**

```bash
git add src public README.md DEV_LOG.md
git commit -m "feat: complete PTJ high-fidelity prototype"
```

### Task 6: GitHub 发布

**Files:**
- Modify: `.git/config`（通过 `git remote add`）

**Interfaces:**
- Consumes: 已验证的 `main` 分支。
- Produces: `wmWW-G/PTJ_Prototype` 可见的远端 `main` 分支。

- [ ] **Step 1: 添加远端**

Run: `git remote add origin https://github.com/wmWW-G/PTJ_Prototype.git`
Expected: `git remote -v` 显示目标仓库。

- [ ] **Step 2: 推送**

Run: `git push -u origin main`
Expected: 远端创建 `main`。

- [ ] **Step 3: 验证远端**

Run: `git ls-remote --heads origin main`
Expected: 远端 SHA 与本地 `git rev-parse HEAD` 一致。
