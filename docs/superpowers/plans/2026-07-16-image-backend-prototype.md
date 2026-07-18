# 批图匠真实生图后端原型 Implementation Plan

> 历史实施计划：2026-07-18 起，Azure GPT-Image-2 已由 OpenRouter `openai/gpt-image-2` 替代；当前运行事实以 `CONTEXT.md` 和代码为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有批图匠 React 原型中接入可部署到 Vercel 的 FastAPI 后端，真实调用 Gemini Prompt Planner、Nano Banana 2、Nano Banana Pro 和 Azure GPT-Image-2，并流式展示多图生成进度。

**Architecture:** GitHub Pages 前端逐张上传参考图到 FastAPI，FastAPI 将文件写入 Vercel Blob；生图请求使用 NDJSON 流式响应。后端先根据服务器模板和用户输入规划结构化 Prompt，再按有图全并发、无图先基准图后分发的规则调用统一模型 Adapter。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、FastAPI、Pydantic、HTTPX、google-auth、Vercel Blob Python SDK、Pytest。

## Global Constraints

- 真实 API 只覆盖批量文生图和批量图生图；AI 修图和模特换装继续使用 Mock。
- 前端继续部署 GitHub Pages，FastAPI 部署 Vercel Python Function。
- 单张上传最大 4 MB，格式只允许 PNG、JPEG、WebP；单个上传区最多 10 张。
- 方案数量范围 1 到 4；单任务最大输出 24 张。
- 套图、详情图、主图、海报默认槽位数分别为 6、5、1、1，实际数量以服务器模板 `slots.length` 为准。
- 有参考图时全部槽位共享原参考图；无参考图时先生成图 1，其他槽位统一共享图 1。
- 供应商密钥只能来自 Vercel 环境变量，不能进入前端、Git 或日志。
- 所有生产函数必须有中文 docstring/注释、类型提示和明确异常边界。
- 后端使用 Python `logging` 记录关键阶段，前端保留必要的 `console.info/warn/error`。
- 自动测试不得调用真实模型；真实 Smoke Test 必须显式执行。

---

## 文件结构

```text
api/index.py                         Vercel FastAPI 入口
backend/app.py                       路由、CORS 和依赖组装
backend/settings.py                  环境变量和能力配置
backend/domain.py                    请求、模板、事件和供应商领域类型
backend/templates.py                 四种服务器模板
backend/sizing.py                    Azure 尺寸计算
backend/limiter.py                   并发与每分钟限流
backend/google_client.py             Google 鉴权和 REST 基础客户端
backend/planner.py                   Product Context 与 Prompt Planner
backend/providers.py                 Google/Azure 图片模型 Adapter
backend/storage.py                   Vercel Blob 上传和受控下载
backend/orchestrator.py              有图/无图、多方案与 NDJSON 事件编排
backend/tests/                        后端测试
src/features/generation/api.ts       上传、Capabilities 和 NDJSON 客户端
src/features/generation/liveTypes.ts 前端真实任务类型
src/features/generation/liveState.ts 流式事件状态归并
src/features/generation/components/LiveResultsPanel.tsx
src/features/generation/components/ModelControls.tsx
```

---

### Task 1: 后端领域模型、模板与 Azure 尺寸计算

**Files:**
- Create: `backend/__init__.py`
- Create: `backend/domain.py`
- Create: `backend/templates.py`
- Create: `backend/sizing.py`
- Create: `backend/tests/test_templates.py`
- Create: `backend/tests/test_sizing.py`
- Create: `requirements.txt`
- Create: `pytest.ini`

**Interfaces:**
- Consumes: 无。
- Produces: `GenerationRequest`、`TemplateDefinition`、`PromptPlan`、`StreamEvent`、`get_template(template_id)`、`calculate_azure_size(aspect_ratio, resolution)`。

- [ ] **Step 1: 写模板和尺寸失败测试**

```python
def test_default_template_counts() -> None:
    assert len(get_template("product_set_01").slots) == 6
    assert len(get_template("listing_01").slots) == 5
    assert len(get_template("main_01").slots) == 1
    assert len(get_template("poster_01").slots) == 1


def test_azure_square_4k_is_clamped_to_pixel_limit() -> None:
    size = calculate_azure_size("1:1", "4K")
    assert size.width % 16 == 0
    assert size.height % 16 == 0
    assert size.width * size.height <= 8_294_400
    assert size.width == size.height


def test_azure_wide_1k_meets_minimum_pixels() -> None:
    size = calculate_azure_size("16:9", "1K")
    assert size.width * size.height >= 655_360
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m pytest backend/tests/test_templates.py backend/tests/test_sizing.py -q`

Expected: FAIL，因为领域模块尚不存在。

- [ ] **Step 3: 实现 Pydantic 类型和服务器模板**

`GenerationRequest` 必须包含：

```python
class GenerationRequest(BaseModel):
    mode: Literal["text-to-image", "image-to-image"]
    image_type: Literal["main", "set", "listing", "poster"]
    template_id: str
    model: Literal["nano_banana_2", "nano_banana_pro", "gpt_image_2_azure"]
    aspect_ratio: str
    resolution: Literal["1K", "2K", "4K"]
    quality: Literal["low", "medium", "high"] | None = None
    language: str = "zh-CN"
    variant_count: int = Field(default=1, ge=1, le=4)
    user_requirement: str = Field(min_length=1, max_length=4000)
    reference_assets: list[ReferenceAsset] = Field(default_factory=list, max_length=10)
```

模板槽位必须逐项写明 `index`、`role`、`title`、`objective`、`composition` 和 `text_policy`。

- [ ] **Step 4: 实现 Azure 尺寸算法**

算法按比例建立宽高，使用 `1K=1024`、`2K=2048`、`4K=3840` 作为目标长边；先满足最小像素，再限制最大像素和最长边，最后向下取 16 的倍数并复核全部约束。非法比例抛出 `UnsupportedCapabilityError`。

- [ ] **Step 5: 运行测试确认通过**

Run: `python3 -m pytest backend/tests/test_templates.py backend/tests/test_sizing.py -q`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add backend requirements.txt pytest.ini
git commit -m "feat: add image generation domain and templates"
```

---

### Task 2: 配置、Google 鉴权、Prompt Planner 与模型 Adapter

**Files:**
- Create: `backend/settings.py`
- Create: `backend/google_client.py`
- Create: `backend/planner.py`
- Create: `backend/providers.py`
- Create: `backend/tests/test_settings.py`
- Create: `backend/tests/test_planner.py`
- Create: `backend/tests/test_providers.py`

**Interfaces:**
- Consumes: Task 1 的领域类型、模板和 Azure 尺寸。
- Produces: `Settings.from_env()`、`PromptPlanner.analyze_product()`、`PromptPlanner.plan_variant()`、`GoogleImageProvider`、`AzureImageProvider`、`ProviderRouter.get(model)`。

- [ ] **Step 1: 写配置和 Planner 失败测试**

测试必须验证：

```python
def test_missing_credentials_are_reported_without_secret_values(monkeypatch) -> None:
    monkeypatch.delenv("GOOGLE_SERVICE_ACCOUNT_JSON", raising=False)
    settings = Settings.from_env()
    assert "GOOGLE_SERVICE_ACCOUNT_JSON" in settings.missing_configuration()


async def test_planner_rejects_wrong_slot_count(fake_google_transport) -> None:
    fake_google_transport.reply({"image_prompts": []})
    with pytest.raises(PromptPlanError):
        await planner.plan_variant(template=get_template("product_set_01"), variant_index=1)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m pytest backend/tests/test_settings.py backend/tests/test_planner.py backend/tests/test_providers.py -q`

Expected: FAIL，因为客户端和 Adapter 尚不存在。

- [ ] **Step 3: 实现配置与 Google 鉴权客户端**

`Settings` 从环境变量读取所有值，`safe_status()` 只返回布尔配置状态。Google 客户端从 `GOOGLE_SERVICE_ACCOUNT_JSON` 解析服务账号并刷新 OAuth Token，REST Endpoint 使用 `aiplatform.googleapis.com/v1/projects/.../locations/global/publishers/google/models/...:generateContent`。

- [ ] **Step 4: 实现两阶段 Prompt Planner**

`analyze_product()` 使用结构化输出生成 `ProductContext`；有参考图时加入 `inlineData`，无图时只发送用户要求。`plan_variant()` 使用模板、Context、模型 Profile 和 `variant_index` 输出严格 `PromptPlan`。数量或索引错误时重新调用一次，再失败抛出 `PromptPlanError`。

- [ ] **Step 5: 实现 Google 和 Azure 图片 Adapter**

统一接口：

```python
class ImageProvider(Protocol):
    async def generate(self, prompt: str, spec: ImageSpec) -> GeneratedBinary: ...
    async def edit(
        self,
        prompt: str,
        references: Sequence[BinaryAsset],
        spec: ImageSpec,
    ) -> GeneratedBinary: ...
```

Google Adapter 动态传 `aspectRatio`、`imageSize` 和模型 ID；Azure 文生图和图生图统一使用 `/openai/v1/images/*?api-version=preview`，图生图通过 multipart 的 `model` 与 `image` 字段提交。所有返回统一为 `GeneratedBinary`。

- [ ] **Step 6: 运行测试确认通过**

Run: `python3 -m pytest backend/tests/test_settings.py backend/tests/test_planner.py backend/tests/test_providers.py -q`

Expected: PASS，测试全部使用 Fake Transport。

- [ ] **Step 7: 提交**

```bash
git add backend
git commit -m "feat: add prompt planner and image providers"
```

---

### Task 3: 限流、重试与生成编排

**Files:**
- Create: `backend/limiter.py`
- Create: `backend/orchestrator.py`
- Create: `backend/tests/test_limiter.py`
- Create: `backend/tests/test_orchestrator.py`

**Interfaces:**
- Consumes: `PromptPlanner`、`ProviderRouter`、`TemplateDefinition`、`ImageProvider`。
- Produces: `AsyncRateLimiter.run()`、`GenerationOrchestrator.stream(request)` 异步事件流。

- [ ] **Step 1: 写有图和无图编排失败测试**

```python
async def test_reference_mode_uses_original_references_for_every_slot() -> None:
    events = [event async for event in orchestrator.stream(reference_request)]
    assert provider.edit_reference_groups == [["original"]] * 6
    assert any(event.type == "job_completed" for event in events)


async def test_text_mode_generates_anchor_before_fan_out() -> None:
    events = [event async for event in orchestrator.stream(text_request)]
    assert provider.calls[0].method == "generate"
    assert all(call.references == ["anchor"] for call in provider.calls[1:])
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m pytest backend/tests/test_limiter.py backend/tests/test_orchestrator.py -q`

Expected: FAIL，因为编排器尚不存在。

- [ ] **Step 3: 实现限流与重试**

每个模型实例组合 Semaphore 与滑动窗口请求时间队列。408、429、500、502、503、504 最多重试两次；429 优先读取 `Retry-After`。参数、权限和内容过滤异常直接返回非重试失败。

- [ ] **Step 4: 实现异步事件编排**

流程必须发出：`job_started -> planning -> plan_ready -> variant_started -> image/anchor events -> variant_completed -> job_completed`。有图槽位通过 `asyncio.gather` 受控并发；无图先等待基准图写入存储，再并发其余槽位。单张副图失败允许 `partial_success`。

- [ ] **Step 5: 运行测试确认通过**

Run: `python3 -m pytest backend/tests/test_limiter.py backend/tests/test_orchestrator.py -q`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add backend
git commit -m "feat: orchestrate concurrent image generation"
```

---

### Task 4: Vercel Blob、FastAPI 路由与 NDJSON

**Files:**
- Create: `backend/storage.py`
- Create: `backend/app.py`
- Create: `api/index.py`
- Create: `backend/tests/test_storage.py`
- Create: `backend/tests/test_api.py`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `Settings`、`GenerationOrchestrator`。
- Produces: `/api/health`、`/api/capabilities`、`/api/uploads`、`/api/generations/stream`。

- [ ] **Step 1: 写 API 失败测试**

```python
def test_upload_rejects_files_larger_than_four_mb(client) -> None:
    response = client.post("/api/uploads", files={"file": ("large.png", b"x" * (4 * 1024 * 1024 + 1), "image/png")})
    assert response.status_code == 413


def test_health_lists_missing_configuration_without_values(client) -> None:
    payload = client.get("/api/health").json()
    assert "configured" in payload
    assert "AZURE_OPENAI_API_KEY" not in str(payload.get("values", {}))
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m pytest backend/tests/test_storage.py backend/tests/test_api.py -q`

Expected: FAIL，因为 FastAPI 入口尚不存在。

- [ ] **Step 3: 实现 Blob 存储和白名单下载**

上传路径使用 `ptj/reference/{uuid}-{safe_filename}`，生成路径使用 `ptj/generated/{job_id}/{variant}/{index}.{ext}`。下载只允许 `BLOB_ALLOWED_HOST` 且参考图路径以 `ptj/reference/` 开头。

- [ ] **Step 4: 实现 FastAPI 与 NDJSON StreamingResponse**

`/api/generations/stream` 将每个 Pydantic Event 序列化为一行 JSON 加换行。CORS Origin 从 `ALLOWED_ORIGINS` 拆分。缺少真实凭证时返回明确配置错误，不切换 Mock。

- [ ] **Step 5: 配置 Vercel Python Function**

`api/index.py` 导出 `backend.app.app`；`vercel.json` 为 `api/index.py` 设置 `maxDuration: 300`，并保留 GitHub Pages 前端独立部署边界。

- [ ] **Step 6: 运行后端完整测试**

Run: `python3 -m pytest backend/tests -q`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add api backend vercel.json requirements.txt
git commit -m "feat: expose streaming generation API"
```

---

### Task 5: 前端 API 客户端、事件类型与状态归并

**Files:**
- Create: `src/features/generation/liveTypes.ts`
- Create: `src/features/generation/api.ts`
- Create: `src/features/generation/liveState.ts`
- Create: `src/features/generation/api.test.ts`
- Create: `src/features/generation/liveState.test.ts`
- Modify: `src/features/tasks/types.ts`
- Modify: `src/features/tasks/taskRepository.ts`

**Interfaces:**
- Consumes: Task 4 的 HTTP/NDJSON 合同。
- Produces: `uploadReference(file)`、`streamGeneration(request, onEvent, signal)`、`reduceGenerationEvent(state, event)`。

- [ ] **Step 1: 写 NDJSON 分片和状态失败测试**

测试必须覆盖一行被拆成多个网络 chunk、多个事件位于同一 chunk、未知事件被忽略、单图完成即时更新、`partial_success` 正确保存。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- src/features/generation/api.test.ts src/features/generation/liveState.test.ts`

Expected: FAIL，因为客户端模块尚不存在。

- [ ] **Step 3: 实现前端类型和流式解析器**

使用 `TextDecoder` 累积残留文本，只按换行解析完整 JSON；HTTP 非 2xx 时读取统一错误并抛出 `GenerationApiError`。API Base URL 来自 `VITE_API_BASE_URL`，不得包含任何供应商密钥。

- [ ] **Step 4: 扩展任务持久化结构**

任务增加 `templateId`、`resolution`、`quality`、`variantCount`、`actualSize`、`liveImages` 和 `providerMetadata`。仓库读取旧 `v2` 数据时提供默认值，避免现有历史记录崩溃。

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test:run -- src/features/generation/api.test.ts src/features/generation/liveState.test.ts src/features/tasks/taskRepository.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/features/generation src/features/tasks
git commit -m "feat: add streaming generation client"
```

---

### Task 6: 动态模型控件与实时结果控制台

**Files:**
- Create: `src/features/generation/components/ModelControls.tsx`
- Create: `src/features/generation/components/ModelControls.test.tsx`
- Create: `src/features/generation/components/LiveResultsPanel.tsx`
- Create: `src/features/generation/components/LiveResultsPanel.test.tsx`
- Modify: `src/features/generation/GenerationPage.tsx`
- Modify: `src/features/generation/GenerationPage.module.css`
- Modify: `src/features/generation/GenerationPage.test.tsx`
- Modify: `src/features/generation/components/UploadZone.tsx`

**Interfaces:**
- Consumes: Task 5 的 API 客户端和 Live State。
- Produces: 文生图/图生图真实提交、动态模型参数和逐张结果 UI。

- [ ] **Step 1: 写动态模型控件失败测试**

```tsx
it("shows quality only for Azure GPT-Image-2", async () => {
  const user = userEvent.setup();
  render(<ModelControls value={initialValue} onChange={onChange} />);
  await user.selectOptions(screen.getByLabelText("生图模型"), "gpt_image_2_azure");
  expect(screen.getByLabelText("生成质量")).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- src/features/generation/components/ModelControls.test.tsx src/features/generation/components/LiveResultsPanel.test.tsx src/features/generation/GenerationPage.test.tsx`

Expected: FAIL，因为组件尚不存在。

- [ ] **Step 3: 实现模型控件**

三个模型使用不同能力表；常用比例直接展示，高级比例折叠。切换模型时保留兼容参数，不兼容时回到 `1:1 + 2K`。Azure 显示独立质量和实际尺寸提示，Google 4K 显示预览标识。

- [ ] **Step 4: 实现实时结果控制台**

按方案和模板槽位预建结果位。每张结果显示状态、角色、图片、实际尺寸、耗时、重试次数和错误原因。Prompt Plan 放入折叠区域。已完成图片支持单张下载。

- [ ] **Step 5: 接入 GenerationPage**

文生图和图生图改用真实 `streamGeneration`；AI 修图和模特换装保留原 `handleGenerate` Mock。上传区真实模式调用 `uploadReference`，生成按钮显示预计总图数。组件卸载时通过 AbortController 终止前端流。

- [ ] **Step 6: 运行前端测试确认通过**

Run: `npm run test:run -- src/features/generation`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/features/generation src/features/tasks
git commit -m "feat: connect live image generation workspace"
```

---

### Task 7: 文档、开发日志、Smoke Test 与交付验证

**Files:**
- Create: `backend/smoke.py`
- Create: `.env.example`
- Modify: `README.md`
- Modify: `CONTEXT.md`
- Modify: `DEV_LOG.md`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: 完整前后端。
- Produces: 本地运行、Vercel 配置、显式真实 Smoke Test 和最终验证说明。

- [ ] **Step 1: 实现显式 Smoke Test CLI**

命令：

```bash
python3 -m backend.smoke --model nano_banana_2
python3 -m backend.smoke --model nano_banana_pro
python3 -m backend.smoke --model gpt_image_2_azure
```

CLI 必须要求 `--confirm-live-call` 才真正调用，并把图片写入临时目录；缺少参数时只打印将要调用的模型和预计规格。

- [ ] **Step 2: 更新 README、CONTEXT 和日志**

README 写清前端、后端、环境变量、Vercel Blob、CORS、4 MB 限制、测试和部署。CONTEXT 将旧的“后续接入 Dify”改为真实 FastAPI 架构。DEV_LOG 记录设计、测试、接口和关键决策，不记录密钥。

- [ ] **Step 3: 运行后端完整验证**

Run: `python3 -m pytest backend/tests -q`

Expected: 0 failures。

- [ ] **Step 4: 运行前端完整验证**

Run: `npm run test:run && npm run lint && npm run build`

Expected: 0 failures，TypeScript 构建成功，Vite 生成 `dist/`。

- [ ] **Step 5: 本地 API 验收**

Run: `uvicorn backend.app:app --host 127.0.0.1 --port 8000`

检查 `/api/health` 和 `/api/capabilities` 返回 200；缺少密钥时状态必须明确显示未配置。

- [ ] **Step 6: 浏览器验收**

运行前端并检查：模型切换、比例/分辨率联动、Azure 质量、图片上传、缺配置错误、Mock 页面回归和历史记录。

- [ ] **Step 7: 提交**

```bash
git add backend .env.example README.md CONTEXT.md DEV_LOG.md design-qa.md
git commit -m "docs: complete image backend prototype handoff"
```

---

## 最终验收命令

```bash
python3 -m pytest backend/tests -q
npm run test:run
npm run lint
npm run build
git status --short
```

真实 API 不属于自动验证；只有用户配置 Vercel/本地环境变量并显式执行 `--confirm-live-call` 时才产生模型费用。
