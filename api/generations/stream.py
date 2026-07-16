"""Vercel ``/api/generations/stream`` Python Function 入口。

NDJSON 流、服务端配置检查、模型编排和错误处理全部复用共享 FastAPI 应用；
该文件只解决 Vite 与 Python 共存时的精确函数路由问题。
"""

from backend.app import app

__all__ = ["app"]
