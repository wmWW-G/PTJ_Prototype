"""Vercel ``/api/generations/refine-prompt`` Python Function 入口。

单张 Prompt 优化、鉴权配置与错误处理全部复用共享 FastAPI 应用；该文件只
负责让 Vite 与 Python 混合部署能够精确命中新路由。
"""

from backend.app import app

__all__ = ["app"]
