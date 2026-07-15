# PTJ Prototype

批图匠核心业务高保真可交互原型，覆盖批量文生图、批量图生图、批量 AI 修图、批量模特换装和历史任务详情。

## 本地运行

```bash
npm install
npm run dev
```

## 验证

```bash
npm run test:run
npm run build
```

## 公网部署

前端通过 `.github/workflows/deploy-pages.yml` 自动部署到 GitHub Pages。推送 `main` 分支后，GitHub Actions 会构建并发布 `dist`。

公网地址：`https://wmww-g.github.io/PTJ_Prototype/`

Vercel 不托管前端，只用于后续的 `/api/*` 后端函数。GitHub Pages 前端调用后端时，需使用 Vercel 项目的完整 HTTPS 域名。

## Dify 接入边界

当前版本只使用 Mock 数据和 LocalStorage，不调用 Dify。后续接入时应通过 Vercel Serverless Functions 代理请求，Dify API Key 只能放在 Vercel 环境变量中，不能写入 `VITE_*` 变量或前端源码。Vercel 后端还需显式允许 GitHub Pages 域名的 CORS 请求。
