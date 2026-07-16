"""Vercel FastAPI 零配置入口测试。"""

import json
from pathlib import Path


def test_vercel_uses_fastapi_zero_config_without_rewrite() -> None:
    """api/index.py 已是 catch-all，额外 rewrite 会篡改 FastAPI 原始路径。"""

    config = json.loads(Path("vercel.json").read_text(encoding="utf-8"))

    assert "rewrites" not in config
    assert config["functions"]["api/index.py"]["maxDuration"] == 300
