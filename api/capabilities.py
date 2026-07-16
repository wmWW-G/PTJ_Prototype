"""Vercel ``/api/capabilities`` Python Function 入口。

该薄入口复用完整 FastAPI 应用，避免在部署文件中复制模型、模板和上传限制。
"""

from backend.app import app

__all__ = ["app"]
