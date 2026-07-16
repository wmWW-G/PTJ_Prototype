# 批图匠项目上下文

## 项目目标

本项目现在同时保存早期 Coze 工作流档案，并提供一个可真正演示的批图匠前后端原型。当前真实链路不再调用 Coze 或 Dify：React 前端直接访问 FastAPI，FastAPI 调用文本 LLM 规划 Prompt，再调用 Google Cloud 或 Azure 图片模型。

## 请求从哪里进、从哪里出

前端入口是 `src/main.tsx` 和 `src/App.tsx`。文生图、图生图从 `src/features/generation/GenerationPage.tsx` 提交：

1. 图生图先逐张调用 `POST /api/uploads`，参考图保存到 Vercel Blob。
2. 前端调用 `POST /api/generations/stream`。
3. FastAPI 同时读取“张数/职责模板”和“视觉/信息模板”，调用 Gemini Prompt Planner 生成结构化计划。
4. `GenerationOrchestrator` 按有图/无图依赖关系调用模型 Adapter。
5. 结果图写入 Vercel Blob，并通过 `application/x-ndjson` 逐张返回。
6. 前端归并事件并写入 LocalStorage 历史。

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
- `backend/providers.py`：Nano Banana 2、Nano Banana Pro、Azure GPT-Image-2 Adapter。
- `backend/sizing.py`：Azure 动态实际尺寸换算。
- `backend/limiter.py`：模型并发、RPM、供应商 `retry-after` 退避和错峰重试。
- `backend/orchestrator.py`：有图全并发、无图基准图或独立构图分发、多方案循环。
- `backend/storage.py`：Vercel Blob 上传、保存、URL 白名单和 SSRF 防护。
- `src/features/generation/api.ts`：上传、Capabilities 和 NDJSON 客户端。
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

## 新需求通常改哪里

- 改单版图片职责或张数：`backend/templates.py`，同时更新模板测试。
- 新增整套视觉风格或信息字段：`backend/visual_templates.py`，并同步前端静态回退模板。
- 加图片模型：`backend/providers.py`、`backend/app.py` 的路由注册和 Capabilities。
- 改有图/无图并发关系：`backend/orchestrator.py`，必须先改测试。
- 改比例和参数：`backend/sizing.py`、Provider Adapter 和 ModelControls。
- 改实时卡片：`liveTypes.ts`、`liveState.ts`、`LiveResultsPanel.tsx`。
- 改上传限制：后端 `storage.py` 与前端 `UploadZone.tsx` 必须同步。

不要把密钥写入前端、`VITE_*`、源码或日志；不要让后端下载任意用户 URL；不要把图 2 继续传给图 3，所有副图只共享原图或同版图 1。

`visual_template_id` 决定视觉方向和每个槽位的展示主题，`template_id` 仍然是张数与稳定 role 的唯一来源。Planner 会把视觉模板的 `role_highlights` 按顺序绑定到各槽位；例如企业实力六图固定为企业总览、仓储与交付、品控流程、研发与定制、认证背书、产能与服务。`supplemental_info` 全部选填；空字段代表未知，Planner 不得补写认证、产能、客户等事实。

Azure GPT-Image-2 当前最多三路并发，剩余槽位等待前一批完成，避免一版套图的五张副图同时冲击 East US 2 配额。429 必须优先遵守 Azure `retry-after-ms` / `Retry-After`，再叠加错峰延迟；不要重新提高到四路并发，除非已确认部署实际 RPM 和并发容量。

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
