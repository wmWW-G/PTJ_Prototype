"""Vercel ``/api/health`` Python Function 入口。

文件只负责让混合 Vite 项目的精确 URL 进入共享 FastAPI 应用；健康检查、
CORS 和脱敏配置状态仍由 ``backend.app`` 统一实现。
"""

from backend.app import app

__all__ = ["app"]
