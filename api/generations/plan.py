"""Vercel ``/api/generations/plan`` Python Function 入口。

该文件只负责让 Vite 与 FastAPI 混合部署能精确命中 Prompt 规划
路由；“只规划、不生图”的强制约束由共享 FastAPI 应用实现。
"""

from backend.app import app

__all__ = ["app"]
