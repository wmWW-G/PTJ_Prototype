"""Vercel Blob 路径、类型、大小和下载白名单测试。"""

import pytest

from backend.domain import GeneratedBinary, ReferenceAsset
from backend.storage import BlobStorage, InvalidAssetError


class FakeBlobBackend:
    """记录上传和读取参数的内存 Blob 替身。"""

    def __init__(self) -> None:
        self.puts: list[tuple[str, bytes, str]] = []

    async def put(self, path: str, body: bytes, *, content_type: str) -> str:
        """记录上传并返回公开 URL。"""

        self.puts.append((path, body, content_type))
        return f"https://blob.example/{path}"

    async def get(self, url: str) -> tuple[bytes, str]:
        """返回固定参考图。"""

        return b"reference", "image/png"


@pytest.mark.asyncio
async def test_upload_reference_uses_safe_prefix() -> None:
    """用户文件名不能逃离 ptj/reference 目录。"""

    backend = FakeBlobBackend()
    storage = BlobStorage(
        token="test-token",
        allowed_host="blob.example",
        backend=backend,
    )

    asset = await storage.upload_reference("../../危险 名称.png", b"png", "image/png")

    assert backend.puts[0][0].startswith("ptj/reference/")
    assert ".." not in backend.puts[0][0]
    assert str(asset.url).startswith("https://blob.example/ptj/reference/")


@pytest.mark.asyncio
async def test_load_reference_rejects_untrusted_host() -> None:
    """后端不能下载用户提交的任意 URL，避免 SSRF。"""

    storage = BlobStorage(
        token="test-token",
        allowed_host="blob.example",
        backend=FakeBlobBackend(),
    )
    asset = ReferenceAsset(
        url="https://attacker.example/ptj/reference/a.png",
        mime_type="image/png",
        filename="a.png",
    )

    with pytest.raises(InvalidAssetError):
        await storage.load_reference(asset)


@pytest.mark.asyncio
async def test_generated_images_use_job_scoped_path() -> None:
    """结果图路径必须包含任务、方案和图片索引，方便排查。"""

    backend = FakeBlobBackend()
    storage = BlobStorage(
        token="test-token",
        allowed_host="blob.example",
        backend=backend,
    )

    url = await storage.save_generated(
        GeneratedBinary(data=b"image", mime_type="image/png"),
        job_id="job123",
        variant_index=2,
        image_index=5,
    )

    assert backend.puts[0][0] == "ptj/generated/job123/2/5.png"
    assert url.endswith("/ptj/generated/job123/2/5.png")

