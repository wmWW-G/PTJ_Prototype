# 批图匠项目上下文

## 项目目标

本项目现在同时保存早期 Coze 工作流档案，并提供一个可真正演示的批图匠前后端原型。当前真实链路不再调用 Coze 或 Dify：React 前端直接访问 FastAPI，FastAPI 调用文本 LLM 规划 Prompt，再调用 Google Cloud 或 Azure 图片模型。

## 请求从哪里进、从哪里出

前端入口是 `src/main.tsx` 和 `src/App.tsx`。文生图、图生图从 `src/features/generation/GenerationPage.tsx` 提交：

1. 图生图先逐张调用 `POST /api/uploads`，参考图保存到 Vercel Blob。
2. 前端调用 `POST /api/generations/stream`。
3. FastAPI 读取服务器模板，调用 Gemini Prompt Planner 生成结构化计划。
4. `GenerationOrchestrator` 按有图/无图依赖关系调用模型 Adapter。
5. 结果图写入 Vercel Blob，并通过 `application/x-ndjson` 逐张返回。
6. 前端归并事件并写入 LocalStorage 历史。

其他后端入口：

- `GET /api/health`：脱敏配置状态。
- `GET /api/capabilities`：模型、比例、分辨率、模板张数和上传限制。
- `POST /api/uploads`：单张 PNG/JPEG/WebP，最大 4 MB。

## 关键模块

- `api/index.py`：Vercel Python Function 入口。
- `backend/app.py`：FastAPI、CORS、路由和真实依赖组装。
- `backend/domain.py`：统一请求、模板、Prompt、图片和流事件类型。
- `backend/templates.py`：四种服务器模板，是单版张数的唯一事实来源。
- `backend/planner.py`：商品分析和结构化 Prompt 计划。
- `backend/providers.py`：Nano Banana 2、Nano Banana Pro、Azure GPT-Image-2 Adapter。
- `backend/sizing.py`：Azure 动态实际尺寸换算。
- `backend/limiter.py`：模型并发、RPM 和临时错误重试。
- `backend/orchestrator.py`：有图全并发、无图基准图后分发、多方案循环。
- `backend/storage.py`：Vercel Blob 上传、保存、URL 白名单和 SSRF 防护。
- `src/features/generation/api.ts`：上传、Capabilities 和 NDJSON 客户端。
- `src/features/generation/liveState.ts`：流事件纯函数归并。
- `src/features/generation/components/ModelControls.tsx`：动态模型参数。
- `src/features/generation/components/LiveResultsPanel.tsx`：逐张结果控制台。
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
- 加图片模型：`backend/providers.py`、`backend/app.py` 的路由注册和 Capabilities。
- 改有图/无图并发关系：`backend/orchestrator.py`，必须先改测试。
- 改比例和参数：`backend/sizing.py`、Provider Adapter 和 ModelControls。
- 改实时卡片：`liveTypes.ts`、`liveState.ts`、`LiveResultsPanel.tsx`。
- 改上传限制：后端 `storage.py` 与前端 `UploadZone.tsx` 必须同步。

不要把密钥写入前端、`VITE_*`、源码或日志；不要让后端下载任意用户 URL；不要把图 2 继续传给图 3，所有副图只共享原图或同版图 1。

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
