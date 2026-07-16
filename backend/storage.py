"""Vercel Blob 上传、结果保存与受控参考图下载。"""

from __future__ import annotations

import re
import uuid
from typing import Protocol
from urllib.parse import urlparse

from vercel import blob

from .domain import BinaryAsset, GeneratedBinary, ReferenceAsset


MAX_UPLOAD_BYTES = 4 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
_EXTENSIONS = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}


class InvalidAssetError(ValueError):
    """表示上传文件或参考图 URL 不满足安全约束。"""


class BlobBackendProtocol(Protocol):
    """便于测试替换的最小 Blob SDK 接口。"""

    async def put(self, path: str, body: bytes, *, content_type: str) -> str:
        """上传二进制并返回公开 URL。"""

    async def get(self, url: str) -> tuple[bytes, str]:
        """下载 URL 并返回内容和 MIME。"""


class VercelBlobBackend:
    """对官方 Vercel Blob Python SDK 的轻量封装。"""

    def __init__(self, token: str) -> None:
        """保存只存在于后端的 Blob Token。

        Args:
            token: Vercel 自动注入或手动配置的读写 Token。

        Returns:
            无。

        Raises:
            不主动抛出异常。
        """

        self._token = token

    async def put(self, path: str, body: bytes, *, content_type: str) -> str:
        """上传公开 Blob 并返回 URL。

        Args:
            path: 已限定前缀的对象路径。
            body: 图片二进制。
            content_type: 图片 MIME 类型。

        Returns:
            可供前端展示和后续图生图读取的 URL。

        Raises:
            vercel.blob.BlobError: Blob 服务拒绝请求时抛出。
        """

        result = await blob.put_async(
            path,
            body,
            access="public",
            content_type=content_type,
            add_random_suffix=False,
            overwrite=True,
            token=self._token,
        )
        return result.url

    async def get(self, url: str) -> tuple[bytes, str]:
        """读取受控 Blob 图片。

        Args:
            url: 已由上层白名单验证的 Blob URL。

        Returns:
            图片二进制和服务端报告的 MIME 类型。

        Raises:
            vercel.blob.BlobError: Blob 不存在或读取失败时抛出。
        """

        result = await blob.get_async(url, access="public", token=self._token)
        return result.content, result.content_type or "application/octet-stream"


def _safe_filename(filename: str, mime_type: str) -> str:
    """把用户文件名压缩成不含路径控制符的安全名称。

    Args:
        filename: 浏览器上传的原始文件名。
        mime_type: 已校验的图片 MIME，用于确定可信扩展名。

    Returns:
        只包含字母、数字、点、横线和下划线的文件名。

    Raises:
        InvalidAssetError: MIME 类型不在允许集合时抛出。
    """

    if mime_type not in _EXTENSIONS:
        raise InvalidAssetError(f"不支持的图片类型：{mime_type}")
    stem = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1].rsplit(".", 1)[0]
    normalized = re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-") or "image"
    return f"{normalized[:80]}.{_EXTENSIONS[mime_type]}"


class BlobStorage:
    """批图匠使用的 Vercel Blob 业务存储。"""

    def __init__(
        self,
        *,
        token: str,
        allowed_host: str,
        backend: BlobBackendProtocol | None = None,
    ) -> None:
        """创建带 URL 白名单的存储服务。

        Args:
            token: Blob 读写 Token。
            allowed_host: 唯一允许下载参考图的 Blob 主机名。
            backend: 测试可注入的底层实现。

        Returns:
            无。

        Raises:
            不主动抛出异常。
        """

        parsed_host = urlparse(allowed_host).hostname if "://" in allowed_host else allowed_host
        self._allowed_host = (parsed_host or "").lower()
        self._backend = backend or VercelBlobBackend(token)

    async def upload_reference(
        self,
        filename: str,
        content: bytes,
        mime_type: str,
    ) -> ReferenceAsset:
        """校验并上传一张用户参考图。

        Args:
            filename: 用户原始文件名，仅用于生成安全可读名称。
            content: 完整文件二进制。
            mime_type: 浏览器报告的 MIME；当前仅允许 PNG/JPEG/WebP。

        Returns:
            前端可放入生图请求的 ``ReferenceAsset``。

        Raises:
            InvalidAssetError: 类型不允许、文件为空或超过 4 MB 时抛出。
            vercel.blob.BlobError: 上传失败时由 SDK 透传。
        """

        if mime_type not in ALLOWED_IMAGE_TYPES:
            raise InvalidAssetError("仅支持 PNG、JPEG 和 WebP")
        if not content:
            raise InvalidAssetError("图片文件不能为空")
        if len(content) > MAX_UPLOAD_BYTES:
            raise InvalidAssetError("单张图片不能超过 4 MB")
        safe_name = _safe_filename(filename, mime_type)
        path = f"ptj/reference/{uuid.uuid4().hex}-{safe_name}"
        url = await self._backend.put(path, content, content_type=mime_type)
        return ReferenceAsset(url=url, mime_type=mime_type, filename=safe_name)

    async def load_reference(self, asset: ReferenceAsset) -> BinaryAsset:
        """从唯一允许的 Blob 前缀下载参考图。

        Args:
            asset: 前端回传的参考图描述。

        Returns:
            可直接交给图片模型的二进制图片。

        Raises:
            InvalidAssetError: URL 主机、协议、路径或响应类型不可信时抛出。
            vercel.blob.BlobError: Blob 下载失败时由 SDK 透传。
        """

        parsed = urlparse(str(asset.url))
        if parsed.scheme != "https":
            raise InvalidAssetError("参考图必须使用 HTTPS")
        if parsed.hostname is None or parsed.hostname.lower() != self._allowed_host:
            raise InvalidAssetError("参考图不属于允许的 Blob 主机")
        if not parsed.path.startswith("/ptj/reference/"):
            raise InvalidAssetError("参考图路径不在 ptj/reference 下")
        content, content_type = await self._backend.get(str(asset.url))
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise InvalidAssetError("Blob 返回了不支持的图片类型")
        if len(content) > MAX_UPLOAD_BYTES:
            raise InvalidAssetError("参考图超过 4 MB")
        return BinaryAsset(data=content, mime_type=content_type, name=asset.filename)

    async def save_generated(
        self,
        generated: GeneratedBinary,
        *,
        job_id: str,
        variant_index: int,
        image_index: int,
    ) -> str:
        """把模型返回图片保存到任务专属路径。

        Args:
            generated: 已解码的供应商图片。
            job_id: 当前任务 UUID。
            variant_index: 当前完整方案序号。
            image_index: 模板槽位序号。

        Returns:
            可公开展示的 Blob URL。

        Raises:
            InvalidAssetError: 供应商返回了不支持的图片 MIME 时抛出。
            vercel.blob.BlobError: 上传失败时由 SDK 透传。
        """

        if generated.mime_type not in ALLOWED_IMAGE_TYPES:
            raise InvalidAssetError(f"不支持保存的图片类型：{generated.mime_type}")
        extension = _EXTENSIONS[generated.mime_type]
        path = f"ptj/generated/{job_id}/{variant_index}/{image_index}.{extension}"
        return await self._backend.put(
            path,
            generated.data,
            content_type=generated.mime_type,
        )

