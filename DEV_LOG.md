# 开发日志

## 2026-07-20

- 修复本地原型四种图片类型统一报 `Failed to fetch`：根因是 Vite 从 5173 顺延到 5174 后，生产 API 的 CORS 只允许旧端口；同时本地前端仍默认连接未配置云端密钥的 `localhost:8000`。
- 后端新增仅限 `localhost` / `127.0.0.1` 的动态端口 CORS 正则，公网来源仍必须通过 `ALLOWED_ORIGINS` 显式放行；新增 5174 预检回归测试，防止开发端口变化再次导致全入口断连。
- 本地 `.env.local` 改为连接已配置完整的 `https://ptj-image-api.vercel.app`，不复制或下拉任何服务器密钥；Vite 5174 已重启加载新地址。
- 发布 Vercel Production `dpl_H5TGJjWbrxg4MjjR4PLEb75v8tFn`；健康检查为 `configured: true`，5174 跨域预检返回 200 并回显正确 `access-control-allow-origin`。
- 浏览器真实验收使用 PTJ-2、512、1:1 生成 1 张海报：页面从计划、生成到 Blob 图片完成，显示 `1 / 1`，模型耗时约 10.1 秒，不再出现 `Failed to fetch`。
- 完整回归：后端 53 项、前端 48 项全部通过；TypeScript 检查和 Vite Production 构建通过。仅保留 FastAPI TestClient 现有 httpx2 迁移弃用警告。
- 根据用户最新判断把三套 B2B 详情模板从 10 张收敛为 8 张 / 版：保留产品介绍、卖点、结构使用、材质工艺、场景、品质和合作等核心采购信息，降低生成成本与内容重复。
- 采购决策详情将“产品矩阵与型号”改为无需 SKU 的“产品介绍”，将“关键规格参数”改为无需尺寸/容量数值的“结构细节与使用说明”；同时移除 MOQ、贸易条款、真实规格等高交互字段。
- OEM/ODM 模板移除 MOQ 阶梯和交期数值要求，以定制总览、产品开发、材质颜色、结构配件、Logo、包装、打样量产和品质交付组成八图；工厂履约模板移除产能数据、证书、出口市场和物流时效输入，以真实动作表达制造与品控能力。
- 派出三个并行 ImageGen 任务，为采购决策、OEM/ODM 和工厂履约各生成 8 张项目内原创真实预览图，共 24 张；前后端模板均引用对应独立素材，不再重复使用少量杯子与工厂占位图。
- 后端单任务最大输出从 100 张同步收敛为 80 张，支持详情图 8 张 × 10 版；模板角色、构图、预览数组、静态回退、Capabilities 与结果标签保持一致。
- 模板详情保持逐图卡片和大图前后切换；每套实际渲染 8 张对应职责图片，用户无需先使用模板即可完整检查信息结构。
- 全量回归：前端 46 项、后端 48 项全部通过；TypeScript 检查、Vite Production 构建、lint 与 `git diff --check` 通过。仅保留 FastAPI TestClient 现有 httpx2 迁移弃用警告。
- 为详情图新增三套可真实选择的阿里国际站 B2B 模板：采购决策详情、OEM/ODM 定制详情、工厂履约详情；每套均提供独立职责、构图要求、预览素材和对应选填字段。
- 视觉模板新增 `image_types` 适用范围。前端按当前图片类型过滤模板，详情图只显示三套 B2B 模板，套图继续显示原有四套；套图与详情图分别保存自己的选择，来回切换不会串模板。
- 后端在执行前校验视觉模板与图片类型是否匹配，Planner 将详情模板的八个主题逐张绑定到标准详情槽位，并把“六张主题不得重复”改为适用于所有张数的通用约束。
- 新增详情图模板筛选、模板切换、Capabilities 暴露、错误类型拦截和八张 B2B Prompt 职责绑定测试。

## 2026-07-19

- 将“生图模板”限定为套图专用；主图不再展示套图模板，详情图与海报继续使用通用商品输入。
- 主图改为上下双图片输入：上方“参考设计图”最多 1 张，只学习构图、光线、配色和画面风格；下方“产品素材图”最多 6 张，用于确定用户自己的商品主体，支持点击、拖拽、粘贴、缩略图预览和移除。
- 主图补充文字压缩为 500 字选填输入，仅用于背景、场景、文案和必须保留细节；图片仍可独立提交。
- 统一“参考设计图”和“产品素材图”的卡片骨架、标题区、虚线上传区、边框、圆角与留白；两张空态卡片在 1094px 视口下均为 334.7 × 146px。补充文字拆为下方独立紧凑面板，不再造成第二张图片卡片尺寸失衡。
- 请求新增 `style_reference_assets`，与产品 `reference_assets`、品牌 `logo_asset` 分离。Planner 只分析产品素材；最终模型按“产品素材 → 参考设计 → Logo”接收参考图，并通过 Prompt 禁止复制参考图中的商品、品牌、Logo、文字、水印或受保护图形。
- 新增主图模板显隐、双图片上传、样式参考自动分流和编排语义隔离回归测试；在 1094 × 920 本地浏览器完成两组图片独立上传、紧凑 Logo 浮层和横向溢出验收。
- 最终回归：前端 45 项、后端 46 项全部通过；TypeScript 检查、Vite Production 构建与 `git diff --check` 通过。仅保留 FastAPI TestClient 现有 `httpx2` 迁移弃用警告，不影响本次功能。

## 2026-07-18

- 修复统一生图工作区在中等窗口宽度下可左右滑动的问题：主内容设置 `min-width: 0` 与 `overflow-x: clip`，双栏右侧取消 500/620px 强制最小宽度，允许结果区在视口内收缩，960px 以下继续切换单栏。
- 移除生图表单中的“批量加文字 / LOGO”完整区域；真实参数 2×2 网格将“画面比例”和“完整方案数量”对调，形成“比例｜模型、清晰度｜数量”的布局。
- 移除真实生图参数卡底部面向开发者的模型实现说明；“完整方案数量”由加减步进器改成 1–10 下拉框，后端 `variant_count` 上限同步提高到 10，Capabilities 的单任务最大输出同步为 60 张。
- 删除“补充文字要求”标题下方与输入框占位内容重复的辅助说明，保留字段名、输入框内引导和字数统计，进一步压缩输入区的信息噪声。
- 生图模型统一使用产品名称并固定排序：PTJ-1 对应 GPT-Image-2、PTJ-2 对应 Nano Banana 2、PTJ-3 对应 Nano Banana Pro；新任务默认选择 PTJ-1，真实请求仍保留原内部模型标识，结果区与历史详情同步显示 PTJ 名称。
- 统一真实生图参数卡的字号密度：标签降为 11px、下拉值降为 12px、数量值降为 12px、辅助统计和模型说明降为 8–9px，同时把控件高度收敛到 38px，与上方模板和图片输入区保持一致。
- 继续压缩统一生图表单：补充文字 textarea 最小高度从 92px 降为 64px；“完整方案数量”不再占用整行，而是与生图模型、输出清晰度、画面比例组成 2×2 参数网格，总张数以紧凑摘要保留。
- 根据最新标注把合并输入区改为“图片优先”：商品参考图成为顶部主操作，突出点击上传、直接粘贴和拖拽；文字框下移并缩小为“补充文字要求（选填）”，只承担卖点、场景、风格和保留细节说明。
- 放宽真实生成提交条件：有参考图时允许不填写文字，前端会用不虚构卖点的中性执行说明满足 Planner 非空字段；图片和文字都没有时才提示用户先上传图片或补充文字。
- 按最新页面标注收敛统一生图左栏：移除内容区“批量生图”标题，使表单与右侧生成记录顶部对齐；AI 修图和模特换装仍保留各自页面标题。
- 将原先分开的“上传商品参考图”和“产品+卖点”合并为一个输入面板：保留文字输入，并新增图片粘贴、整区拖拽、点击上传、内嵌缩略图、点击放大预览、Escape/遮罩关闭和悬浮 X 删除；所有入口共用同一套 MIME、4MB 和 10 张上限校验，后端文生图/图生图自动分流逻辑不变。
- 把“完整方案数量”、每版固定张数和总张数计算移入“真实生图参数”卡，与模型、清晰度和画面比例形成一个完整参数区；AI 修图和模特换装继续使用原数量布局。
- 新增合并输入的粘贴、拖拽、预览、删除，以及方案数量归属和计算回归测试。
- 本轮最终回归为前端 39 项全部通过；TypeScript 类型检查、Vite Production 构建与 `git diff --check` 通过，并在本地浏览器确认数量从 1 版切换为 2 版时总张数由 6 联动为 12。
- 用户已在 Vercel 为 Preview 与 Production 配置加密的 `OPENROUTER_API_KEY`；未读取、回显或写入密钥值。重新部署 Preview `dpl_C4CQHHjXCYyYDTtyJ5u8Rvww1qLk` 后，健康检查返回 `configured: true`、`missing: []`。
- Preview 上完成 GPT-Image-2 / OpenRouter 的完整端到端矩阵：使用最低 `1K + low + 1:1`，主图/套图/详情图/海报分别成功 `1/1、6/6、5/5、1/1`，四条请求均收到 `plan_ready`、Blob 图片地址与最终 `job_completed`，合计 13 张、零失败；证据位于 `/tmp/ptj-gpt-cloud-matrix-20260718/`，不进入仓库。
- 三模型完整云端验收现已全部完成：Nano Banana 2、Nano Banana Pro、GPT-Image-2 各覆盖主图/套图/详情图/海报，合计生成 39 张、零失败。GPT 云端主图额外下载抽查为有效 1254×1254 PNG，主体与白底电商主图要求一致。
- 发布 Vercel Production `dpl_CN1CBHe1e89f7t2vgbHodwmbryXC`，正式域名 `https://ptj-image-api.vercel.app`；正式健康检查为 `configured: true`、无缺项，Capabilities 返回 Nano Banana 2 / Pro / GPT-Image-2 分别 14 / 10 / 15 种比例。
- 正式环境补跑 GPT-Image-2 最低质量主图 Smoke Test：收到 `plan_ready`，生成并保存 1 张 1254×1254 Blob 图片，最终 `job_completed` 且 `completed: 1、failed: 0`，确认 Production Scope 的 OpenRouter Key 可真实调用。
- 刷新本地原型进行浏览器验收：结果区标题为“生成记录”，任务进度轨、底部状态栏、重复摘要、视图切换、重新编辑与再次生成均不再出现；画面比例为下拉框，三模型选项数和最低清晰度与正式 API 一致。
- 最终自动回归：后端 41 项、前端 36 项全部通过；TypeScript 类型检查、Vite Production 构建与 `git diff --check` 通过。仅保留 FastAPI TestClient 关于未来 `httpx2` 的现有弃用警告，不影响本次功能。
- Vercel Preview `dpl_D1WDHEnouh1SLanTKTrG4iENt8EU` 完成真实矩阵验收：Nano Banana 2 使用官方最低 `512`，主图/套图/详情图/海报分别成功 `1/1、6/6、5/5、1/1`；Nano Banana Pro 使用官方最低 `1K`，四类同样成功 `1/1、6/6、5/5、1/1`。八条请求均出现 `plan_ready`，最终为 `job_completed`，合计 26 张、零失败。
- 使用同批真实 Gemini Planner 计划和本地指定的 OpenRouter Key 直接验收 GPT-Image-2 Adapter：`1K + low + 1:1` 下主图/套图/详情图/海报分别成功 `1/1、6/6、5/5、1/1`，合计 13 张、零失败；套图和详情图的副图通过 `input_references` 成功，证明 OpenRouter 文生图与图生图路径均可用。临时证据位于 `/tmp/ptj-google-matrix-20260718/` 和 `/tmp/ptj-gpt-provider-matrix-20260718/`，不进入仓库。
- 按 Google、OpenAI 与 OpenRouter 官方能力重做模型参数：画面比例改为下拉框；Nano Banana 2 提供 14 种比例和最低 `512`，Nano Banana Pro 提供 10 种比例，GPT-Image-2 提供符合原生 3:1 尺寸边界的常用比例预设。
- 后端新增模型级比例和清晰度校验，避免前端历史状态或手写请求把不受支持的组合送给供应商；OpenRouter 当前端点仍不伪造未开放的尺寸字段，GPT 比例继续作为严格构图约束写入 Prompt。
- 真实生图配置改为按当前模型检查：Google Planner 与 Blob 仍是共同依赖，但缺少 OpenRouter Key 时不再连带阻断 Nano Banana 2 / Pro，便于供应商隔离验收和降级排障。
- 移除结果区“排队中 / 正在生成 / 已完成”任务进度轨；标题从只适合单任务的“本次生成结果”改为可承载历史内容的“生成记录”。
- 根据结果区页面标注移除底部生成/排队/完成状态栏、重复的任务摘要卡，以及网格/列表视图切换；结果固定使用网格展示。
- 将生图时间、模型、尺寸上移到“图片类型 · 张数”标题下方，替换原来的 Prompt 摘要，在精简界面的同时保留必要任务信息。
- 移除结果区的“重新编辑”和“再次生成”操作及其无用回调，底部只保留“全部下载”。
- 根据页面标注精简统一生图左栏：移除顶部“输入内容 / 生成设置 / 并发生成”步骤条，以及上传区下方“自动识别文生图/图生图”提示条；是否上传参考图仍由后端自动分流，不改变真实执行逻辑。
- 生图模板详情抽屉的预览区由一大三小的非对称拼图改为 3×2 六宫格，四套模板均补齐六个预览槽位；移动端自动改为 2×3，避免缩略图过窄。
- 新增六宫格数量和冗余提示移除回归测试，防止后续重新出现标注中要求删除的界面。
- 将 GPT-Image-2 的真实供应商从 Azure 全面切换为 OpenRouter，内部模型名更新为 `gpt_image_2_openrouter`，OpenRouter 模型 ID 固定为 `openai/gpt-image-2`。
- 文生图与图生图统一调用 `POST https://openrouter.ai/api/v1/images`；图生图把后端已校验的参考图转为 Data URL，通过 `input_references` JSON 字段传递，不再使用 Azure multipart 编辑接口。
- 移除 Azure Endpoint、API Key、Deployment 配置和动态尺寸算法；新增 `OPENROUTER_API_KEY`、Base URL、模型 ID 与可选应用归因配置，密钥只允许存在于后端环境变量。
- 按 OpenRouter 实时能力记录收紧参数：GPT-Image-2 发送 `quality` 与 `n`，不发送端点未声明支持的 `size`、`resolution` 或 `aspect_ratio`；页面提供符合 GPT 原生 3:1 边界的常用比例预设，并将选择作为严格构图约束写入 Prompt。
- 旧 LocalStorage/API 请求中的 `gpt_image_2_azure` 会自动迁移为 OpenRouter 模型名，确保历史任务可继续重新生成但不会再调用 Azure。
- 补充 OpenRouter 文生图、图生图、Bearer 鉴权、错误脱敏、429 退避、默认配置和旧模型名迁移测试；Smoke Test 新增可选 `--reference` 图生图验证。
- OpenRouter HTTP 客户端不继承宿主机代理环境，避免本地 SOCKS 变量造成可选依赖启动失败，也防止服务端 Key 与图片被意外转交给未登记代理。
- OpenRouter 未单独返回宽高时，后端会从 PNG IHDR 读取真实尺寸，继续为结果卡提供实际像素信息且不新增图片处理依赖。
- 使用用户指定的本机 Key 完成两次低质量真实 Smoke Test：`openai/gpt-image-2` 文生图与携带 `input_references` 的图生图均成功，返回有效 1254×1254 PNG；测试图仅保存在 `/tmp`，Key 未写入仓库。
- 将“批量文生图”和“批量图生图”合并为单一“批量生图”入口 `#/generation`，左侧导航不再展示两个重复页面。
- 统一页面始终展示“上传商品参考图（选填）”：没有上传时提示文生图，上传后立即提示图生图及参考图数量。
- 前端真实生图请求不再提交 `mode`；FastAPI 根据 `reference_assets` 是否为空自动归一为 `text-to-image` 或 `image-to-image`，旧客户端传入的冲突模式也会被纠正。
- 保留 `#/text-to-image` 和 `#/image-to-image` 到新入口的重定向，避免旧收藏、历史链接和外部入口失效。
- 统一生图页面合并展示两种模式的历史记录；任务和详情仍保留实际模式，便于判断该任务是否使用参考图。
- 同页重新编辑会保留当前上传的 File 对象；跨页面打开历史任务时不会把远程缩略图伪装成本地文件，如需图生图要重新选择参考图。
- 新增统一导航、自动模式切换和后端模式推断回归测试；前端 31 项测试、TypeScript 检查以及相关后端 10 项测试均通过。

## 2026-07-17

- 登记 Dify Cloud 应用“生图固定工作流”，控制台应用 ID 为 `07afb65a-1d26-45d1-b312-5b1e91d37d40`，后续计划用于当前原型的固定生图执行。
- 将 Dify Service API Key 保存到 macOS 钥匙串服务 `PTJ_DIFY_FIXED_IMAGE_API_KEY`，仓库仅记录 `${DIFY_FIXED_IMAGE_API_KEY}`，未保存任何密钥明文。
- 通过无费用只读接口 `GET /info` 与 `GET /parameters` 验证凭据有效，确认应用模式为 `workflow`，并登记 10 个实际输入变量。
- 本次没有调用 `POST /workflows/run`，没有触发生图或模型费用；原型执行链尚未切换到 Dify，输出结构仍待接入时实测。

## 2026-07-16

- 修复企业实力套图六张高度重复的问题：根因是无图模式把已排版的图 1“企业总览”当作后五张的图生图基准，模型因此同时复制了九宫格、地图、图标和背景。
- 企业实力模板现在使用独立构图策略：纯文生图的图 2–6 不再引用图 1，标准商品套图和用户上传原图的图生图链路保持原样。
- 为企业总览、仓储与交付、品控流程、研发与定制、认证背书、产能与服务增加六种互不重复的强制构图，并限定全局一致性只约束商品、配色和品牌气质。
- 新增编排、Planner 和 Capabilities 回归测试，防止企业套图再次复用首图版式。
- 修复企业实力套图仍沿用标准商品套图主题的问题：Prompt Planner 现在把视觉模板的 `role_highlights` 逐张绑定到固定槽位，企业实力六图明确为企业总览、仓储与交付、品控流程、研发与定制、认证背书、产能与服务；前端结果卡和 Prompt 详情同步显示这些动态职责名称。
- 修复 GPT-Image-2 套图突发并发导致的 Azure 429：并发从 4 降为 3，其余槽位排队，RPM 保护从错误的 60 调整为 6，本地退避改为 10/30 秒并加入随机错峰；Provider 读取 Azure `retry-after-ms` / `Retry-After`，限流器优先按上游建议等待。
- 新增企业实力槽位映射、动态职责标题、Azure 429 Header 解析和 Provider 退避优先级测试。
- 修复 GPT-Image-2 套图仅第一张成功的问题：Azure 纯生成原本走 v1 接口，后续编辑却错误使用 deployment 路径和无效的 `2025-04-01` 版本，导致所有副图立即返回 HTTP 404；现已统一为 `/openai/v1/images/edits?api-version=preview`，并通过 multipart `model` 与重复 `image` 字段传递部署名和参考图。
- 新增 Azure v1 图片编辑请求映射回归测试，固定检查 URL、multipart 类型、模型字段和参考图字段，防止再次出现“首图成功、后续全失败”。
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
- 修复 Azure GPT-Image-2 在 Vercel 环境使用 Foundry Project Endpoint 时被错误拼接为图片 API 地址、立即返回 HTTP 400 的问题；后端现在会把 `*.services.ai.azure.com/api/projects/*` 规范化为对应的 `*.openai.azure.com` 资源地址。
- Azure 非成功响应现在会安全提取 HTTP 状态、Azure 错误码、脱敏错误说明与 request ID，避免前端只显示没有诊断价值的 `HTTP 400`；不会回显 API Key、请求头、Prompt 或图片内容。
- 增强 Gemini Prompt Planner 的结构化 JSON 容错：支持 Markdown JSON 代码围栏和前后说明文本；商品分析首次结构错误时会携带修复指令自动重试一次。
- 使用 GitHub Pages 正式页面完成 Azure GPT-Image-2、1K、Low、1:1、单张主图真实 Smoke Test：不再立即返回 HTTP 400，最终成功返回并展示可下载图片。
- 根据页面评审把模型展示名从 `GPT-Image-2 · Azure` 简化为 `GPT-Image-2`；选择该模型时不再新增“生成质量”控件，原“输出清晰度”直接切换为低、中、高，并分别映射为 `1K + low`、`2K + medium`、`4K + high`。
- 根据 Product Design 选定稿新增“生图模板”：表单展示紧凑预览，点击“更换模板”从右侧抽屉查看和切换整套视觉方向。
- 新增标准商品、企业实力、极简质感、场景故事 4 套视觉模板；模板与主图/套图/详情图/海报的槽位模板解耦，避免复制生成流程。
- 每套模板提供动态补充字段且全部选填；企业实力模板可补充公司名称、经验、OEM/ODM、产能、认证、服务和市场等真实信息。
- 前端把 `visual_template_id` 和 `supplemental_info` 传给后端；Planner 只使用非空且属于当前模板的事实，禁止根据空字段虚构认证、产能或合作客户。
- 浏览器设计 QA 首轮发现企业实力预览仍复用商品素材、抽屉受父级动画影响未固定到视口；补充工厂/仓储/研发/品控预览并用 Portal 修复后复验通过。
- 每张模板卡新增独立“查看详情”入口；详情层完整展示大图预览、6 张图片职责、信息重点、全部选填字段，并支持返回列表或直接选择使用。
- 删除此前从外部店铺截图裁切的 4 张企业实力示例图，改用 ImageGen 生成的无品牌、无文字、无水印原创工厂、仓储、研发和品控素材。
- 当前验证：后端 57 项、前端 32 项全部通过，TypeScript 检查和生产构建通过。

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

# 2026-07-18：恢复紧凑 Logo 入口并接通真实生图请求

- 在商品参考图标题右侧加入醒目的“添加 Logo”紧凑按钮，不再恢复原先占据整段空间的 Logo 区域。
- 点击按钮后用浮层完成 Logo 上传、预览、移除和位置选择；默认右下角并提示安全边距。
- 前端把 Logo 与商品参考图分开上传，历史任务保存 Logo 地址和位置。
- 后端新增独立 `logo_asset` / `logo_position` 字段；Logo 不参与商品主体分析，只作为最后一张图片编辑参考。
- 生图 Prompt 明确要求原样保留 Logo 的文字、颜色、比例和图形结构，并按用户位置克制展示。
- 新增前后端测试，覆盖紧凑入口、默认位置、Logo 自动触发图生图以及编排引用顺序。
- 收紧统一生图页信息层级：移除商品参考图的重复说明和标题栏“最多 10 张”，并把每版固定张数直接合并到主图、套图、详情图、海报四个类型按钮中。

# 2026-07-20：套图与详情图自定义模板

- 在生图模板抽屉中新增醒目的“自定义套图 / 自定义详情图”卡片；它与现有预设并列，不新增独立页面。
- 套图只能从现有套图职责中自由组合 6 项，详情图只能从三套现有 B2B 详情职责中自由组合 8 项；首次打开以当前预设为起点，减少从空白配置的成本。
- 自定义编排器展示已选顺序、来源模板和真实预览图，支持逐项替换、上移、下移和移除；选满固定数量后才允许提交，最终顺序直接对应生成图片顺序。
- 前端任务和 LocalStorage 新增 `customVisualRoles`；编辑历史自定义任务时恢复职责组合，普通预设任务不携带多余自定义数据。
- 真实请求新增 `custom_visual_roles`。后端只接受来源模板 ID 与职责下标，并重新读取服务器登记内容；新增固定数量、重复职责、下标和图片类型校验，阻止跨类型职责混用和任意 Prompt 注入。
- 验证结果：前端 48 项、后端 52 项全部通过；TypeScript 检查与 Vite Production 构建通过。浏览器视觉验收记录见 `design-qa.md`。
