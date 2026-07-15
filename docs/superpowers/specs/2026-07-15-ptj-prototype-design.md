# 批图匠高保真原型设计规格

## 目标

基于 `top-pt.com` 当前核心业务界面，制作一套可部署到 Vercel 的高保真可交互原型。第一阶段只复刻核心生成流程，不接入 Dify，不实现登录、注册、充值、教程和个人账户。

## 技术栈

- React + TypeScript + Vite。
- React Router 管理页面路由。
- CSS Modules 管理组件样式，`src/styles/tokens.css` 集中管理颜色、间距、圆角和阴影等设计令牌。
- LocalStorage 保存原型历史任务。
- GitHub 作为代码仓库，Vercel 负责自动构建和公开访问。
- 后续 Dify 接口通过 Vercel Serverless Functions 代理，密钥只保存在 Vercel 环境变量中。

## 页面范围

| 路由 | 页面 |
|---|---|
| `/text-to-image` | 批量文生图 |
| `/image-to-image` | 批量图生图 |
| `/ai-retouch` | 批量 AI 修图 |
| `/outfit-swap` | 批量模特换装 |
| `/history/:id` | 历史任务详情 |

默认路由跳转到 `/text-to-image`。Vercel 需要配置 SPA 重写，保证直接刷新子路由仍能加载应用。

## 页面结构

### 共用外壳

`AppShell` 统一负责：

- 顶部品牌区、首页入口、演示余额和演示用户信息。
- 左侧四个核心业务入口。
- 当前生成任务状态。
- 历史任务列表。
- 主内容区。

原型不得复制真实手机号、真实余额、Token、API Key 或用户私有图片，统一使用演示数据。

### 共用生成工作区

四个生成页面共用 `GenerationWorkspace`，由页面配置决定：

- 图片类型：主图、套图、详情图、海报。
- 上传区数量和文案。
- Prompt 输入框。
- 生成数量。
- 模型选择。
- Logo、背景替换等可选模块。
- 图片比例。
- 页面专属业务选项。

### 页面差异

- 文生图：商品与卖点输入，无商品参考图上传。
- 图生图：最多上传 10 张参考图，可选择背景替换素材。
- AI 修图：最多上传 10 张图片，支持去水印、改文案、抠图模式。
- 模特换装：服装图和模特图分开上传，各自最多 10 张。
- 历史详情：展示时间、指令、模型、比例、结果图和操作按钮。

## 核心组件

- `AppShell`：全局布局。
- `TopBar`：品牌、演示余额和用户区。
- `Sidebar`：业务导航、任务状态和历史列表。
- `GenerationWorkspace`：生成页通用编排。
- `ImageTypeSelector`：图片类型切换。
- `UploadZone`：拖拽上传、校验、预览和删除。
- `QuantityStepper`：生成数量调整。
- `ModelSelector`：模型选择。
- `AspectRatioSelector`：图片比例选择。
- `OptionalBranding`：Logo 文案和图片上传。
- `HistoryPanel`：日期筛选和历史列表。
- `ResultCard`：结果图和重新编辑、再次生成、全部下载操作。
- `Toast`：操作成功和错误反馈。

## 数据模型

```ts
type GenerationMode =
  | "text-to-image"
  | "image-to-image"
  | "ai-retouch"
  | "outfit-swap";

type ImageType = "main" | "set" | "listing" | "poster";

interface GenerationTask {
  id: string;
  mode: GenerationMode;
  imageType?: ImageType;
  prompt: string;
  model: string;
  aspectRatio: string;
  quantity: number;
  sourceImages: string[];
  modelImages: string[];
  garmentImages: string[];
  resultImages: string[];
  status: "queued" | "generating" | "completed" | "failed";
  createdAt: string;
}
```

页面只依赖统一的任务服务接口。第一阶段由 Mock/LocalStorage 实现，后续可以替换为 Dify/Vercel API，而不修改页面组件。

## 交互流程

1. 用户选择业务页面和图片类型。
2. 用户输入 Prompt、上传图片并调整参数。
3. 前端完成格式、大小和数量校验。
4. 点击生成后立即创建 `generating` 状态的 Mock 任务。
5. 模拟进度结束后生成演示结果并写入 LocalStorage。
6. 左侧历史列表和详情区域同步更新。
7. 重新编辑会回填原任务参数；再次生成会创建新任务。
8. 全部下载在第一阶段显示原型提示，不创建虚假文件。

## 上传校验

- 支持 JPEG、PNG、WebP、BMP、TIFF、GIF。
- 单张文件不超过 10 MB。
- 单个上传区最多 10 张。
- 上传错误必须指出具体文件和原因。
- 使用浏览器 Object URL 预览，并在图片删除或组件卸载时释放。

## 异常和空状态

- 没有历史任务时展示引导性空状态。
- 生成过程中禁用重复提交并显示清晰进度。
- LocalStorage 损坏时回退到内置演示数据。
- 图片加载失败时展示占位图和失败说明。
- 非法历史任务 ID 跳转到历史空状态，而不是白屏。
- 所有表单控件具备键盘焦点和可读标签。

## 视觉方向

复刻原站的浅色电商工具风格、固定顶部栏、左侧任务导航、白色工作区和紫蓝色主操作色。保持紧凑但清晰的桌面布局，普通笔记本宽度下仍可完整操作。移动端采用堆叠布局，不隐藏核心操作。

## 验收标准

- 五个路由均可直接访问和刷新。
- 四个生成页面的字段、选项和上传结构与已盘点原站一致。
- 上传、删除、类型切换、数量调整、比例切换均可交互。
- Mock 生成任务能进入历史列表并打开详情。
- 重新编辑和再次生成链路可演示。
- 刷新页面后历史任务仍存在。
- 不包含真实账号信息、密钥或用户私有素材。
- `npm run build` 成功。
- 核心页面通过桌面端浏览器人工验收。

## 本阶段不做

- Dify 实际调用。
- 真实图片生成和图片处理。
- 登录、注册、充值、教程和账户管理。
- 真实余额、配额和支付。
- 真实批量下载。
