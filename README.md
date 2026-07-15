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

## 部署到 Vercel

仓库已经包含 `vercel.json`。在 Vercel 导入 GitHub 仓库后，构建命令使用 `npm run build`，输出目录使用 `dist`。

## Dify 接入边界

当前版本只使用 Mock 数据和 LocalStorage，不调用 Dify。后续接入时应通过 Vercel Serverless Functions 代理请求，Dify API Key 只能放在 Vercel 环境变量中，不能写入 `VITE_*` 变量或前端源码。
