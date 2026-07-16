# PTJ Prototype

批图匠真实生图原型：React 前端保留原高保真工作台，FastAPI 后端直接调用 Google Cloud 与 Azure，不再经过 Coze、Dify 或固定参数工作流。

已真实接入的业务页：

- 批量文生图
- 批量图生图

继续使用轻量 Mock 的展示页：

- 批量 AI 修图
- 批量模特换装

## 核心生成逻辑

- 主图、套图、详情图、海报分别由服务器模板决定 1、6、5、1 个槽位。
- `variant_count` 表示完整生成几版，不表示一版有几张。
- 有参考图：所有槽位复用用户原图并受控并发。
- 无参考图：先生成图 1，随后图 2 到 N 统一复用图 1 并发生成。
- 视觉模板会把自己的展示主题逐张绑定到固定槽位，企业实力套图不会再回退成普通使用场景图。
- Azure GPT-Image-2 使用三路并发、其余槽位排队，并优先遵守 429 响应中的退避时间。
- Nano Banana 2、Nano Banana Pro 和 Azure GPT-Image-2 的参数差异只存在于后端 Adapter。
- 结果通过 NDJSON 实时返回，单张完成即在右侧控制台出现。

## 本地运行

前端：

```bash
npm install
cp .env.example .env.local
npm run dev
```

后端：

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn backend.app:app --reload --port 8000
```

本地前端默认访问 `http://localhost:8000`。如果后端运行在其他地址，在 `.env.local` 中设置 `VITE_API_BASE_URL`。

## Vercel 后端配置

1. 把当前仓库导入 Vercel，Python Runtime 使用 `.python-version` 中的 3.12。
2. 创建 Vercel Blob Store。
3. 根据 `.env.example` 在 Vercel Project Settings 中添加 Google、Azure、Blob 和 CORS 环境变量。
4. 部署后先打开 `/api/health`，确认 `configured: true`。
5. 打开 `/api/capabilities`，确认三个模型与四个模板可见。

由于仓库同时包含 Vite 与 FastAPI，`api/health.py`、`api/capabilities.py`、
`api/uploads.py` 和 `api/generations/stream.py` 分别提供精确的 Vercel
Python Function 路由，并共同复用 `backend.app:app`。不要合并成只能匹配
`/api` 的单个 `api/index.py`，也不需要添加 rewrite。

密钥只能放在 Vercel 环境变量，不能放进 `VITE_*`、源码、Git、日志或截图。

## GitHub Pages 前端配置

前端仍由 `.github/workflows/deploy-pages.yml` 发布到 GitHub Pages。请在 GitHub 仓库：

```text
Settings → Secrets and variables → Actions → Variables
```

新增：

```text
VITE_API_BASE_URL=https://你的-vercel-项目.vercel.app
```

公网前端：`https://wmww-g.github.io/PTJ_Prototype/`

## 验证

不产生模型费用的完整验证：

```bash
.venv/bin/python -m pytest backend/tests -q
npm run test:run
npm run lint
npm run build
```

显式真实 Smoke Test（每条命令会产生一次模型费用）：

```bash
.venv/bin/python -m backend.smoke --model nano_banana_2
.venv/bin/python -m backend.smoke --model nano_banana_pro
.venv/bin/python -m backend.smoke --model gpt_image_2_azure
```

没有配置真实密钥时，Smoke Test 会明确列出缺少的环境变量，不会静默切换 Mock。
