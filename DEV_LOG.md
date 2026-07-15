# 开发日志

## 2026-05-30

- 新增 `coze_nodes/` 目录，用于保存用户提供的 Coze（扣子）节点素材。
- 保存原始剪贴板内容到 `coze_nodes/raw/7645250322341134390-coze-nodes-clipboard.txt`。
- 新增 `coze_nodes/NODE_INDEX.md`，整理开始、结束、大模型、代码、选择器、意图识别、批处理、图像生成、画板、抠图、画质提升等节点能力。
- 新增 `coze_nodes/PATH_INDEX.md`，整理文生图、图生图、批量抠图、批量画质提升、画板排版、意图识别分流、知识库增强和异步任务路径。
- 更新 `CONTEXT.md` 和 `AGENTS.md`，让后续 Agent 在设计 Coze 工作流前优先查看 `coze_nodes/`。
- 注意：原始 Coze 剪贴板内容的 `edges` 为空，本次登记为节点素材库，不是已连线的可运行工作流。

## 2026-06-29

- 更新项目定位：本项目优先用于保存和测试已经创建好的“生成生图 Prompt”的工作流。
- 补充说明：用户可以把 Coze 节点内容直接复制到 ChatGPT 网页端，让 ChatGPT 辅助操作、分析、测试或整理工作流。
- 更新 `CONTEXT.md`、`AGENTS.md`、`WORKFLOWS.md`、`coze_nodes/README.md` 和 `coze_nodes/PATH_INDEX.md`，避免后续误判为从零开发网页或从零设计工作流的项目。
- 登记并实测用户补充的 6 个 Coze `stream_run` 工作流调用；文档中只保留 `${COZE_API_TOKEN}` 占位，不保存明文 token。
- 发现 `7656348082263212066` HTTP 调用成功但业务输出为 `image_input:null`，后续需要检查工作流入参映射。
- 根据用户提供的 Coze 工作流名称截图，更新 `WORKFLOWS.md` 中 6 个工作流名称：`ptj_PicToPic_Poster`、`ptj_TextToPic_Poster`、`ptj_PicToPic_Listing`、`ptj_PicToPic_Set`、`ptj_TextToPicture_Set`、`ptj_TextToPicture_Listing`。

## 2026-07-15

- 通过已登录的批图匠页面盘点批量文生图、批量图生图、批量 AI 修图、批量模特换装和历史详情界面。
- 确认第一阶段使用 React、TypeScript、Vite 制作高保真可交互原型。
- 确认第一阶段不接入 Dify，不复刻登录、注册、充值、教程和账户页面。
- 新增原型设计规格 `docs/superpowers/specs/2026-07-15-ptj-prototype-design.md`。
- 初始化 React、TypeScript、Vite、Vitest 原型工程。
- 完成四个核心生成页面、历史任务详情、LocalStorage 数据层和响应式布局。
- 增加演示素材、上传校验、Mock 生成、重新编辑、再次生成和下载提示。
- 补充自动化测试和构建验证。
- 调整公网架构：GitHub Pages 托管前端，Vercel 仅用于后续的 Dify 后端代理。
- 增加 GitHub Pages Actions 工作流、Hash 路由和子路径静态资源适配。
