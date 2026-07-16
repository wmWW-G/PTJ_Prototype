"""Vercel ``/api/uploads`` Python Function 入口。

上传校验和 Blob 存储逻辑仍集中在 ``backend.app`` 与 ``backend.storage``，
本文件仅提供精确的 Vercel 文件路由。
"""

from backend.app import app

__all__ = ["app"]
