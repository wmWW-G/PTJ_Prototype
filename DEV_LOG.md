# 开发日志

## 2026-07-16

- 将文生图和图生图从工作流原型升级为 React + FastAPI 真实生图原型；AI 修图和模特换装继续使用 Mock。
- 新增服务器模板：主图 1 张、套图 6 张、详情图 5 张、海报 1 张，实际输出数量由模板槽位决定。
- 新增 Gemini 3.5 Flash 商品分析与结构化 Prompt Planner，错误槽位数量会自动修复一次。
- 新增 Nano Banana 2、Nano Banana Pro 和 Azure GPT-Image-2 统一 Adapter，比例、分辨率和 Azure 质量均为动态参数。
- 新增 Azure 任意合法尺寸换算，自动满足 16 倍数、长边、总像素和 3:1 比例限制。
- 新增有图全并发、无图先图 1 后并发的生成编排，以及每模型并发、RPM、408/429/5xx 重试和部分成功状态。
- 新增 Vercel Blob 参考图上传、结果保存、4 MB 限制、MIME 校验、受控主机/路径下载和 SSRF 防护。
- 新增 FastAPI health、capabilities、uploads 和 NDJSON streaming 路由；密钥只读取 Vercel 环境变量。
- 前端新增三模型参数控件、完整方案数量、逐张实时结果、实际尺寸、耗时、重试和错误展示。
- 扩展 LocalStorage 任务结构并兼容旧 v2 历史数据；未完成任务在关闭浏览器后不恢复服务端执行。
- 新增显式真实模型 Smoke Test；默认自动测试不调用模型、不产生费用。
- 当前自动验证覆盖后端模板、尺寸、Planner、Provider、并发、重试、存储、API，以及前端 NDJSON、实时状态、模型控件和页面回归。
- 浏览器验收发现 `127.0.0.1:5173` 未包含在默认 CORS；补充双本地域名并新增回归测试，复验返回 `CORS_OK`。
- 按 Vercel 2026 FastAPI 零配置规则移除多余 `/api/*` rewrite；首次误把 `api/index.py` 当作 catch-all，线上复测发现其只匹配 `/api`，导致 capabilities 和 generation 的 OPTIONS/POST 均返回 404。
- 尝试改为根目录 `app.py` 后，Vercel 虽成功构建 Vite，但没有把根 ASGI 应用加入混合项目路由表，生产 `/api/capabilities` 仍为 404。
- 最终为 health、capabilities、uploads、generations/stream 建立精确的 `api/**/*.py` 薄入口，全部复用 `backend.app:app`，并恢复 300 秒 Python Function 配置；不复制任何业务逻辑。
- 创建并部署 Vercel 项目 `ptj-image-api`，稳定 API 地址为 `https://ptj-image-api.vercel.app`。
- 为 Vercel 生产环境配置 GitHub Pages CORS，并在 GitHub Actions 中设置 `VITE_API_BASE_URL`，修复公网前端回退 `localhost:8000` 导致的 `Failed to fetch`。
- Vercel Production 已补齐 Google、Azure 与 Blob 必需变量，`/api/health` 实测返回 `configured: true` 且无缺项；日志仅记录变量状态，不记录任何密钥值。
- 使用 GitHub Pages 正式页面完成 Nano Banana 2、1K、1:1、单张主图真实 Smoke Test：Prompt 规划、图片生成、Blob 保存与前端渲染全链路成功，页面显示 `1 / 1`、`COMPLETED`，模型耗时约 10.6 秒。

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
- 根据用户反馈纠正品牌视觉：移除紫色主题，将全局品牌色、选中态、按钮、焦点和浅色背景统一为橙色体系。
- 真实操作原站批量文生图的主图、套图、详情图和海报切换，确认四种类型共用表单，仅更换选中态。
- 同步原站“左侧表单 + 右侧生成内容”的桌面双栏工作台，并让文生图和图生图共用任务卡、多图套图、重新编辑、再次生成和全部下载交互。
- 根据用户确认的真实规则修正图片数量：主图 1 张、套图 6 张、详情图 5 张、海报 1 张，并增加回归测试防止张数再次偏移。
- 根据用户选定的 Product Design 方案重做文生图、图生图工作台：增加三步生成引导、图片类型固定张数提示、单任务结果面板、生成进度、网格/列表视图和任务状态汇总。
- 为新版套图结果生成 6 张统一风格的本地电商杯子素材，并压缩为适合网页加载的 JPEG。
- 将原型 LocalStorage 键升级到 `ptj.prototype.tasks.v2`，避免旧版演示任务继续显示错误张数或旧版素材。
- 通过 14 项自动化测试、生产构建，以及 1440×1024 浏览器实测文生图生成流程和图生图上传入口。
