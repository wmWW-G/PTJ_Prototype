"""Vercel FastAPI 零配置入口测试。"""

import json
from pathlib import Path


def test_vercel_uses_explicit_api_entrypoints_without_rewrite() -> None:
    """混合 Vite 项目必须为每个公开 API 路径提供明确的 Python 入口。

    该仓库同时包含 Vite 和 FastAPI，Vercel 会优先构建 Vite。根级
    ``app.py`` 不会自动进入前端项目的路由表，而单个 ``api/index.py``
    在此部署模式下也只对应 ``/api``。因此为 health、capabilities、
    uploads 和 generations/stream 提供精确的函数文件，再复用同一个
    FastAPI ``app``，可以让预检和业务请求都进入应用中间件与路由。

    Args:
        无。

    Returns:
        无；断言失败时由 pytest 报告配置回归。

    Raises:
        AssertionError: API 入口缺失、重新加入 rewrite 或函数配置错误时抛出。
    """

    config = json.loads(Path("vercel.json").read_text(encoding="utf-8"))

    entrypoints = {
        Path("api/health.py"),
        Path("api/capabilities.py"),
        Path("api/uploads.py"),
        Path("api/generations/stream.py"),
    }

    assert all(path.is_file() for path in entrypoints)
    assert not Path("app.py").exists()
    assert not Path("api/index.py").exists()
    assert "rewrites" not in config
    assert config["functions"]["api/**/*.py"]["maxDuration"] == 300
