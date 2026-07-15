# 批图匠项目上下文

## 这个项目干嘛

本项目用于保存和测试已经创建好的“批图匠”生图 Prompt 工作流。

这里的“生图 Prompt 工作流”指：用户输入商品、卖点或图片生成需求后，工作流负责生成可交给图片生成模型使用的结构化 Prompt、负面 Prompt、图片角色、画面策略和相关说明。

项目同时包含两部分：既有 Coze 生图 Prompt 工作流档案，以及用于演示批图匠核心业务流程的 React 高保真原型。原型前端由 GitHub Pages 托管，当前使用 Mock 数据；后续由 Vercel Serverless Functions 作为独立后端接入 Dify。

## 核心目标

- 保存已创建好的生图 Prompt 工作流信息。
- 记录工作流的调用接口、`workflow_id`、Input Schema、Output Schema 和实测结果。
- 测试工作流是否能根据商品或卖点生成可用于生图的 Prompt。
- 保存可复制到 ChatGPT 网页端或 Coze 的节点素材和操作说明。
- 区分“已实测工作流”和“仅作为参考的节点素材”，避免把未连线节点误认为可运行流程。

## 入口在哪里

当前主要入口包括：

- 已创建并登记在 `WORKFLOWS.md` 中的 Coze 工作流。
- 用户复制粘贴到 ChatGPT 网页端的 Coze 节点或工作流内容。
- 用户补充的商品、卖点、图片生成目标和测试输入。
- 早期用于理解批图匠页面能力的网页截图。

截图中涉及的网页入口包括：

- `top-pt.com/#/batchTextToImage`：批量文生图。
- `top-pt.com/#/batchImgToImg`：批量图生图。
- `top-pt.com/#/batchBgReplace`：批量 AI 修图。
- `top-pt.com/#/batchOutfitSwap`：批量模特换装。

## 请求从哪里进，从哪里出

请求输入通常来自：

- 已创建工作流的调用信息。
- 用户复制粘贴的 Coze 节点或工作流内容。
- 用户补充的业务目标。
- 用户希望测试的商品、卖点或生图需求。
- 用户截图。

输出通常是：

- 已创建工作流的登记信息。
- 生图 Prompt 工作流的 Input Schema 和 Output Schema。
- 实测记录、返回结构和异常说明。
- 可复制到 ChatGPT 网页端或 Coze 的节点/工作流说明。
- 必要时补充页面功能分析、字段清单和需要确认的问题。

## Coze 工作流登记入口

项目相关 Coze 工作流统一记录在 `WORKFLOWS.md`，尤其是已经创建好的“生成生图 Prompt”的工作流。

后续新增或更新工作流时，不要把详细接口、Input Schema、Output Schema 和调用示例堆在本文档里；本文档只保留项目上下文和登记入口。

## Coze 节点库入口

用户提供的 Coze（扣子）节点素材统一放在 `coze_nodes/`。这些节点可以直接复制到 ChatGPT 网页端，让 ChatGPT 根据节点内容辅助分析、配置、测试或整理工作流。

- `coze_nodes/NODE_INDEX.md`：节点能力索引，记录开始、结束、大模型、图像生成、抠图、画质提升、画板、批处理等节点的用途和入参出参。
- `coze_nodes/PATH_INDEX.md`：可复用工作流路径索引，后续做文生图、图生图、批量抠图、画质提升、画板排版、意图分流等工作流时优先参考。
- `coze_nodes/raw/7645250322341134390-coze-nodes-clipboard.txt`：用户提供的原始 Coze 节点剪贴板内容。

注意：原始节点数据没有连线，不能当作已完成工作流；它们是理解和操作已创建工作流的参考材料。真实可运行、已测试或待测试的工作流仍以 `WORKFLOWS.md` 为准。

## 关键模块分别负责什么

当前原型代码入口为 `src/main.tsx`，路由入口为 `src/App.tsx`。

主要代码模块：

- `src/layout/`：顶部栏、左侧导航和历史任务外壳。
- `src/features/generation/`：四种生成页面、上传和参数组件。
- `src/features/generation/components/GenerationResultsPanel.tsx`：文生图和图生图共用的右侧生成内容、任务卡和后续操作。
- `src/features/history/`：历史任务详情和后续操作。
- `src/features/tasks/`：任务类型、演示数据和 LocalStorage 仓库。
- `src/styles/`：全局样式和设计令牌。
- `.github/workflows/deploy-pages.yml`：构建并发布 GitHub Pages 前端。

后续如果创建文档或资料，建议按用途区分：

- 页面分析：记录截图中可见的页面结构、字段和按钮。
- 工作流登记：保存已创建好的生图 Prompt 工作流、调用方式和测试结果。
- Prompt 输出：记录工作流生成的图片 Prompt、负面 Prompt、图片角色和画面策略。
- Coze / ChatGPT 节点参考：整理节点、变量、异常处理和输出格式。
- 素材规范：记录上传图片、尺寸、格式和数量限制。

## 状态、数据结构、事件名在哪里定义

当前没有正式代码状态、数据结构或事件名。

从截图可抽象出的关键业务字段包括：

- 页面类型：文生图、图生图、AI 修图、模特换装。
- 图片类型：主图、套图、详情图、海报。
- 产品卖点。
- 上传图片。
- Logo 内容。
- Logo 位置。
- 图片尺寸。
- 模型选择。
- 每张图片 AI 生成数量。
- 修图模式：去水印、改文案、抠图。
- 生成结果和历史记录。

## 新需求通常改哪里

如果是新增或测试已创建工作流，优先更新 `WORKFLOWS.md`。

如果是新增截图理解，再更新项目级 `AGENTS.md` 或用户指定的分析文档。

如果是新增 Prompt 输出样例，建议先挂到对应工作流的实测记录或说明里，避免散落成多个文档。

如果是新增 Coze 工作流，建议先沿用 `AGENTS.md` 中的 Coze 工作流输出结构，并登记到 `WORKFLOWS.md`。

如果是根据 Coze 节点搭建或设计工作流，先看 `coze_nodes/PATH_INDEX.md` 选择路径，再看 `coze_nodes/NODE_INDEX.md` 补节点配置。

## 哪些地方别碰

- 不要把截图中看不清的内容写成确定事实。
- 不要编造真实接口、真实 API、真实 Coze 插件名称。
- 不要把 `coze_nodes/raw/` 里的未连线节点当成已创建好的可运行工作流。
- 不要主动创建大量分散文档，除非用户明确要求。
- 不要把该项目误判为网页开发项目。

## 如何本地跑通

原型本地启动：

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 如何验证

验证方式以人工检查为主：

- 检查页面功能描述是否能从截图中找到依据。
- 检查已创建工作流是否登记了 `workflow_id`、调用接口、Input Schema、Output Schema 和测试结果。
- 检查工作流输出的 Prompt 是否能直接用于生图。
- 检查 Coze / ChatGPT 操作说明是否包含输入、处理、输出和异常处理。
- 检查不确定内容是否标注为“需要确认”。
