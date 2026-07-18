# 批图匠项目上下文

## 项目目标

本项目现在同时保存早期 Coze 工作流档案，并提供一个可真正演示的批图匠前后端原型。当前真实链路不再调用 Coze 或 Dify：React 前端直接访问 FastAPI，FastAPI 调用文本 LLM 规划 Prompt，再调用 Google Cloud 或 OpenRouter 图片模型。

## 请求从哪里进、从哪里出

前端入口是 `src/main.tsx` 和 `src/App.tsx`。统一生图页面位于 `#/generation`，由 `src/features/generation/GenerationPage.tsx` 提交：

1. 参考图为选填；如果用户上传图片，前端先逐张调用 `POST /api/uploads`，参考图保存到 Vercel Blob。
2. 前端调用 `POST /api/generations/stream`。
3. FastAPI 根据 `reference_assets` 是否为空自动确定 `text-to-image` 或 `image-to-image`，前端不再提交 `mode`。
4. FastAPI 同时读取“张数/职责模板”和“视觉/信息模板”，调用 Gemini Prompt Planner 生成结构化计划。
5. `GenerationOrchestrator` 按有图/无图依赖关系调用模型 Adapter。
6. 结果图写入 Vercel Blob，并通过 `application/x-ndjson` 逐张返回。
7. 前端归并事件并写入 LocalStorage 历史；任务仍保存实际模式，便于历史详情说明是否使用了参考图。

完整方案数量由下拉框选择，前后端统一允许 1–10 版；当前单版最多 6 张，因此单任务最大输出为 60 张。

其他后端入口：

- `GET /api/health`：脱敏配置状态。
- `GET /api/capabilities`：模型、比例、分辨率、张数模板、视觉模板和上传限制。
- `POST /api/uploads`：单张 PNG/JPEG/WebP，最大 4 MB。

## 关键模块

- `api/health.py`、`api/capabilities.py`、`api/uploads.py`、`api/generations/stream.py`：Vite + FastAPI 混合部署的精确 Vercel 函数入口，全部复用同一个 `backend.app:app`。
- `backend/app.py`：FastAPI、CORS、路由和真实依赖组装。
- `backend/domain.py`：统一请求、模板、Prompt、图片和流事件类型。
- `backend/templates.py`：四种服务器模板，是单版张数的唯一事实来源。
- `backend/visual_templates.py`：视觉模板、预览图、信息重点和选填字段注册表。
- `backend/planner.py`：商品分析和结构化 Prompt 计划。
- `backend/providers.py`：Nano Banana 2、Nano Banana Pro、OpenRouter GPT-Image-2 Adapter。
- `backend/limiter.py`：模型并发、RPM、供应商 `retry-after` 退避和错峰重试。
- `backend/orchestrator.py`：有图全并发、无图基准图或独立构图分发、多方案循环。
- `backend/storage.py`：Vercel Blob 上传、保存、URL 白名单和 SSRF 防护。
- `src/features/generation/api.ts`：上传、Capabilities 和 NDJSON 客户端；统一请求不再携带 `mode`。
- `src/features/generation/liveState.ts`：流事件纯函数归并。
- `src/features/generation/components/ModelControls.tsx`：动态模型参数。
- `src/features/generation/components/LiveResultsPanel.tsx`：逐张结果控制台。
- `src/features/generation/components/VisualTemplatePicker.tsx`：模板摘要、右侧选择抽屉、每套模板的二级详情和动态选填信息。
- `src/features/tasks/`：LocalStorage 历史和旧数据兼容。

早期 Coze 档案仍位于 `WORKFLOWS.md` 和 `coze_nodes/`，它们不是当前真实生图运行依赖。

## 核心状态和事件

后端类型定义在 `backend/domain.py`，前端镜像定义在 `src/features/generation/liveTypes.ts`。

主要任务事件：

```text
job_started → planning → plan_ready → variant_started
→ anchor_started/anchor_completed（仅无图模式）
→ image_started/image_retrying/image_completed/image_failed
→ variant_completed → job_completed 或 job_failed
```

任务状态：`queued`、`generating`、`completed`、`partial_success`、`failed`。

生图模式不再由界面选择。`backend/domain.py` 会在构造 `GenerationRequest` 时按参考图自动归一：无参考图为 `text-to-image`，有参考图为 `image-to-image`。旧客户端即使继续传入 `mode`，后端也以实际参考图为准。

## 新需求通常改哪里

- 改单版图片职责或张数：`backend/templates.py`，同时更新模板测试。
- 新增整套视觉风格或信息字段：`backend/visual_templates.py`，并同步前端静态回退模板。
- 加图片模型：`backend/providers.py`、`backend/app.py` 的路由注册和 Capabilities。
- 改有图/无图并发关系：`backend/orchestrator.py`，必须先改测试。
- 改比例和参数：Provider Adapter、`GET /api/capabilities` 和 ModelControls。
- 改实时卡片：`liveTypes.ts`、`liveState.ts`、`LiveResultsPanel.tsx`。
- 改上传限制：后端 `storage.py` 与前端 `UploadZone.tsx` 必须同步。
- 改有图/无图自动分流：`backend/domain.py` 的 `GenerationRequest.infer_reference_mode`，并同步 `GenerationPage.tsx` 的状态提示和请求测试。

不要把密钥写入前端、`VITE_*`、源码或日志；不要让后端下载任意用户 URL；不要把图 2 继续传给图 3，所有副图只共享原图或同版图 1。

`visual_template_id` 决定视觉方向和每个槽位的展示主题，`template_id` 仍然是张数与稳定 role 的唯一来源。Planner 会把视觉模板的 `role_highlights` 按顺序绑定到各槽位；例如企业实力六图固定为企业总览、仓储与交付、品控流程、研发与定制、认证背书、产能与服务。`supplemental_info` 全部选填；空字段代表未知，Planner 不得补写认证、产能、客户等事实。

OpenRouter GPT-Image-2 当前最多三路并发，剩余槽位等待前一批完成，避免一版套图的副图同时冲击 Key 额度和上游路由。429 必须优先遵守 OpenRouter `Retry-After`，再叠加错峰延迟；不要提高并发，除非已通过当前 Key 的真实批量测试确认容量。

OpenRouter 模型 ID 固定为 `openai/gpt-image-2`，文生图和图生图都走 `POST /api/v1/images`，图生图通过 `input_references` 发送后端已校验的 Data URL。当前模型端点只声明 `quality`、`background`、`n`、`input_references` 和 `output_compression`；未声明 `resolution`、`aspect_ratio` 或 `size`。因此后端不得照搬 Azure 尺寸字段：页面按 GPT-Image-2 原生 3:1 尺寸边界提供常用比例预设，Adapter 把所选比例写入严格构图 Prompt，清晰度映射到 low/medium/high。

Google 比例必须按模型区分：Nano Banana 2（`gemini-3.1-flash-image`）支持 14 种比例和 `512/1K/2K/4K`，Nano Banana Pro（`gemini-3-pro-image`）支持 10 种比例和 `1K/2K/4K`。前端比例使用下拉框，能力集合由 `/api/capabilities` 返回；后端 `GenerationRequest` 会再次拒绝模型不支持的比例或清晰度。

旧历史任务里的 `gpt_image_2_azure` 只作为兼容输入读取，并立即迁移成 `gpt_image_2_openrouter`；它不是可调用的供应商或配置入口。

企业实力模板的预览素材位于 `public/demo/generated/ai-supplier-*.jpg`，均为项目内通过 ImageGen 生成的原创演示图。不要重新使用用户提供的其他店铺截图或从截图裁切素材。

企业实力文生套图使用 `generated_anchor_strategy="independent"`：图 1 仍先生成并正常返回，但图 2–6 不得把这张已排版的“企业总览”当图生图参考，应独立文生图。六张的商品身份、配色和品牌气质保持一致，但必须按 `role_compositions` 使用不同的版式骨架。有图模式仍共享用户上传的原始商品图，不受这条规则影响。

## 本地运行与验证

```bash
npm install
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn backend.app:app --reload --port 8000
npm run dev
```

完整无费用验证：

```bash
.venv/bin/python -m pytest backend/tests -q
npm run test:run
npm run lint
npm run build
```

真实收费 Smoke Test 入口在 `backend/smoke.py`，必须显式指定 `--model`。
