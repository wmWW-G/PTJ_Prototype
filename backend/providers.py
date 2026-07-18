"""Nano Banana 与 OpenRouter GPT-Image-2 的统一图片 Adapter。"""

from __future__ import annotations

import base64
import struct
from typing import Any, Mapping, Protocol, Sequence

import httpx

from .domain import (
    BinaryAsset,
    GeneratedBinary,
    ImageModel,
    ImageSpec,
    ProviderError,
    UnsupportedCapabilityError,
)


GOOGLE_IMAGE_MODELS: dict[str, str] = {
    "nano_banana_2": "gemini-3.1-flash-image",
    "nano_banana_pro": "gemini-3-pro-image",
}


def _png_dimensions(data: bytes) -> tuple[int | None, int | None]:
    """从 PNG IHDR 头读取实际宽高，不引入额外图片处理依赖。

    Args:
        data: 已解码的供应商图片字节。

    Returns:
        PNG 合法且头部完整时返回 ``(width, height)``；其他格式或损坏数据
        返回 ``(None, None)``，由结果卡安全隐藏实际尺寸。

    Raises:
        不抛出异常；长度与签名会在读取前验证。
    """

    png_signature = b"\x89PNG\r\n\x1a\n"
    if len(data) < 24 or not data.startswith(png_signature):
        return None, None
    try:
        width, height = struct.unpack(">II", data[16:24])
    except struct.error:
        return None, None
    if width <= 0 or height <= 0:
        return None, None
    return width, height


def _openrouter_error_message(response: httpx.Response) -> str:
    """从 OpenRouter 错误响应中提取不含凭证的诊断信息。

    Args:
        response: OpenRouter 返回的非 2xx 响应。

    Returns:
        HTTP 状态、上游错误码、简短消息和请求 ID。不会包含请求 Header、
        API Key、完整请求体或用户图片。

    Raises:
        不抛出异常；错误响应不是 JSON 时仅返回状态码和请求 ID。
    """

    parts = [f"OpenRouter 返回 HTTP {response.status_code}"]
    try:
        payload = response.json()
    except ValueError:
        payload = None
    if isinstance(payload, Mapping):
        error = payload.get("error")
        if isinstance(error, Mapping):
            code = error.get("code")
            message = error.get("message")
            if isinstance(code, str) and code.strip():
                parts.append(code.strip()[:120])
            if isinstance(message, str) and message.strip():
                # 压平换行并限制长度，既便于前端显示，也避免上游异常回显过多内容。
                parts.append(" ".join(message.split())[:360])
    request_id = response.headers.get("x-request-id") or response.headers.get(
        "apim-request-id"
    )
    if request_id:
        parts.append(f"request_id={request_id[:120]}")
    return " · ".join(parts)


def _openrouter_retry_after_seconds(response: httpx.Response) -> float | None:
    """读取 OpenRouter 429 响应建议的退避时间。

    Args:
        response: OpenRouter 返回的 HTTP 响应。

    Returns:
        建议等待秒数；响应没有合法提示时返回 ``None``。

    Raises:
        不抛出异常；异常 Header 会被安全忽略。
    """

    candidates = ((response.headers.get("retry-after"), 1.0),)
    for raw_value, scale in candidates:
        if raw_value is None:
            continue
        try:
            seconds = float(raw_value) * scale
        except ValueError:
            continue
        if seconds >= 0:
            # 防止异常上游值让 Vercel Function 无限等待。
            return min(seconds, 120.0)
    return None


class GenerateContentClient(Protocol):
    """Google 图片 Adapter 需要的最小客户端接口。"""

    async def generate_content(self, model: str, payload: dict[str, Any]) -> dict[str, Any]:
        """调用模型并返回 JSON。"""


class ImageProvider(Protocol):
    """编排器使用的统一图片供应商协议。"""

    async def generate(self, prompt: str, spec: ImageSpec) -> GeneratedBinary:
        """根据纯文本生成一张图片。"""

    async def edit(
        self,
        prompt: str,
        references: Sequence[BinaryAsset],
        spec: ImageSpec,
    ) -> GeneratedBinary:
        """根据参考图和文本生成一张图片。"""


def _extract_google_image(response: dict[str, Any]) -> GeneratedBinary:
    """从 Gemini 响应中提取首张内嵌图片。

    Args:
        response: Vertex generateContent 的响应 JSON。

    Returns:
        解码后的图片二进制。

    Raises:
        ProviderError: 响应里没有图片或 Base64 非法时抛出。
    """

    for candidate in response.get("candidates", []):
        for part in candidate.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                try:
                    return GeneratedBinary(
                        data=base64.b64decode(inline["data"]),
                        mime_type=inline.get("mimeType", "image/png"),
                    )
                except (ValueError, TypeError) as exc:
                    raise ProviderError("Google 图片 Base64 无法解码") from exc
    raise ProviderError("Google 图片模型没有返回图片，可能触发了内容过滤")


class GoogleImageProvider:
    """Nano Banana 2 和 Pro 共用的动态 Vertex Adapter。"""

    def __init__(self, client: GenerateContentClient) -> None:
        """注入可测试的 Vertex 客户端。

        Args:
            client: 具备 generateContent 能力的客户端。

        Returns:
            无。

        Raises:
            不抛出异常。
        """

        self._client = client

    async def generate(self, prompt: str, spec: ImageSpec) -> GeneratedBinary:
        """使用文字生成 Google 图片。

        Args:
            prompt: 单张图片完整 Prompt。
            spec: 模型、比例和分辨率规格。

        Returns:
            解码后的图片。

        Raises:
            UnsupportedCapabilityError: 请求的模型不是 Google 图片模型时抛出。
            ProviderError: 上游请求或图片解码失败时抛出。
        """

        return await self._call(prompt=prompt, references=(), spec=spec)

    async def edit(
        self,
        prompt: str,
        references: Sequence[BinaryAsset],
        spec: ImageSpec,
    ) -> GeneratedBinary:
        """使用原始参考图生成 Google 图片。

        Args:
            prompt: 当前槽位 Prompt。
            references: 一到多张受控参考图。
            spec: 模型、比例和分辨率规格。

        Returns:
            解码后的图片。

        Raises:
            UnsupportedCapabilityError: 模型非法或参考图为空时抛出。
            ProviderError: 上游请求或解码失败时抛出。
        """

        if not references:
            raise UnsupportedCapabilityError("Google 图生图至少需要一张参考图")
        return await self._call(prompt=prompt, references=references, spec=spec)

    async def _call(
        self,
        *,
        prompt: str,
        references: Sequence[BinaryAsset],
        spec: ImageSpec,
    ) -> GeneratedBinary:
        """组装一次 Google 图片请求并提取结果。

        Args:
            prompt: 当前图片 Prompt。
            references: 可为空的参考图集合。
            spec: 动态模型参数。

        Returns:
            生成图片。

        Raises:
            UnsupportedCapabilityError: 模型不在注册表时抛出。
            ProviderError: 上游或响应失败时抛出。
        """

        try:
            model_id = GOOGLE_IMAGE_MODELS[spec.model]
        except KeyError as exc:
            raise UnsupportedCapabilityError(f"不是 Google 图片模型：{spec.model}") from exc
        parts: list[dict[str, Any]] = [{"text": prompt}]
        parts.extend(
            {
                "inlineData": {
                    "mimeType": reference.mime_type,
                    "data": base64.b64encode(reference.data).decode("ascii"),
                }
            }
            for reference in references
        )
        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {
                    "aspectRatio": spec.aspect_ratio,
                    "imageSize": spec.resolution,
                },
            },
        }
        return _extract_google_image(await self._client.generate_content(model_id, payload))


class OpenRouterImageProvider:
    """OpenRouter GPT-Image-2 文生图与图生图 Adapter。

    OpenRouter 的专用 Images API 使用同一个 ``/images`` 端点：纯文生图只发
    ``prompt``，图生图额外发送 ``input_references``。当前 GPT-Image-2 能力
    端点没有声明 ``size`` 或 ``aspect_ratio``，因此比例与细节档位会作为
    Prompt 约束；质量只通过官方支持的 ``quality`` 字段传递。
    """

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "openai/gpt-image-2",
        base_url: str = "https://openrouter.ai/api/v1",
        site_url: str = "",
        app_name: str = "PTJ Prototype",
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        """保存 OpenRouter 连接配置。

        Args:
            api_key: 仅位于服务端环境变量中的 OpenRouter Key。
            model: OpenRouter 模型 ID，默认固定为 ``openai/gpt-image-2``。
            base_url: OpenRouter API 根地址，便于测试或企业代理覆盖。
            site_url: 可选的来源站点，用于 OpenRouter 应用归因。
            app_name: 可选的应用名称，用于 OpenRouter 应用归因。
            http_client: 可选 HTTPX 客户端，用于测试注入。

        Returns:
            无。

        Raises:
            不主动抛出异常。
        """

        self._api_key = api_key
        self._model = model
        self._base_url = base_url.strip().rstrip("/")
        self._site_url = site_url.strip()
        self._app_name = app_name.strip()
        # 服务端请求不继承开发机的 HTTP(S)_PROXY。这样既避免误把图片和 Key
        # 交给未知代理，也不会因本机 SOCKS 环境缺少可选 socksio 依赖而无法启动。
        self._http_client = http_client or httpx.AsyncClient(
            timeout=240,
            trust_env=False,
        )
        self._owns_client = http_client is None

    async def generate(self, prompt: str, spec: ImageSpec) -> GeneratedBinary:
        """通过 OpenRouter 调用 GPT-Image-2 文生图。

        Args:
            prompt: 当前图片 Prompt。
            spec: 比例、清晰度和质量参数。

        Returns:
            解码后的图片。

        Raises:
            ProviderError: 上游请求或返回解析失败时抛出。
        """

        response = await self._request(self._payload(prompt=prompt, spec=spec))
        return self._extract_image(response)

    async def edit(
        self,
        prompt: str,
        references: Sequence[BinaryAsset],
        spec: ImageSpec,
    ) -> GeneratedBinary:
        """通过 OpenRouter 的 ``input_references`` 调用 GPT-Image-2 图生图。

        Args:
            prompt: 当前槽位 Prompt。
            references: 用户原图或无图模式生成的基准图。
            spec: 比例、清晰度和质量参数。

        Returns:
            解码后的编辑图片。

        Raises:
            UnsupportedCapabilityError: 参考图为空时抛出。
            ProviderError: 上游请求或解析失败时抛出。
        """

        if not references:
            raise UnsupportedCapabilityError("OpenRouter 图片编辑至少需要一张参考图")
        payload = self._payload(prompt=prompt, spec=spec)
        # OpenRouter Images API 接受 HTTP URL 或 Data URL。参考图已在后端下载并
        # 做过 MIME/大小校验，这里转成 Data URL 可避免再次暴露 Blob 鉴权链路。
        payload["input_references"] = [
            {
                "type": "image_url",
                "image_url": {
                    "url": (
                        f"data:{reference.mime_type};base64,"
                        f"{base64.b64encode(reference.data).decode('ascii')}"
                    )
                },
            }
            for reference in references
        ]
        response = await self._request(payload)
        return self._extract_image(response)

    def _payload(self, *, prompt: str, spec: ImageSpec) -> dict[str, Any]:
        """组装 OpenRouter Images API 支持的请求字段。

        Args:
            prompt: 当前图片 Prompt。
            spec: 统一模型规格。

        Returns:
            不包含 OpenRouter 当前未声明支持的 size、resolution、aspect_ratio。

        Raises:
            不抛出异常。
        """

        quality = spec.quality or {"1K": "low", "2K": "medium", "4K": "high"}[
            spec.resolution
        ]
        constrained_prompt = (
            f"{prompt}\n\n"
            "Output composition requirements: "
            f"compose for a {spec.aspect_ratio} canvas; "
            f"use {spec.resolution} detail intent."
        )
        return {
            "model": self._model,
            "prompt": constrained_prompt,
            "quality": quality,
            "n": 1,
        }

    async def _request(self, payload: dict[str, Any]) -> dict[str, Any]:
        """发送带 Bearer Key 的 OpenRouter 图片请求并统一错误。

        Args:
            payload: 已组装的 Images API JSON 请求体。

        Returns:
            上游响应 JSON。

        Raises:
            ProviderError: 网络错误、HTTP 错误或 JSON 无效时抛出。
        """

        try:
            headers = {
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            }
            if self._site_url:
                headers["HTTP-Referer"] = self._site_url
            # HTTP 标准请求头必须能编码为 ASCII。X-Title 只是可选归因字段，
            # 自定义中文名时宁可省略，也不能让真实生图请求在本地编码阶段失败。
            if self._app_name and self._app_name.isascii():
                headers["X-Title"] = self._app_name
            response = await self._http_client.post(
                f"{self._base_url}/images",
                headers=headers,
                json=payload,
            )
        except httpx.HTTPError as exc:
            raise ProviderError("无法连接 OpenRouter", retryable=True) from exc
        if response.is_error:
            raise ProviderError(
                _openrouter_error_message(response),
                status_code=response.status_code,
                retryable=response.status_code in {408, 429, 500, 502, 503, 504},
                retry_after_seconds=_openrouter_retry_after_seconds(response),
            )
        try:
            return response.json()
        except ValueError as exc:
            raise ProviderError("OpenRouter 返回了无效 JSON") from exc

    @staticmethod
    def _extract_image(response: dict[str, Any]) -> GeneratedBinary:
        """从 OpenRouter 响应中提取首张 Base64 图片。

        Args:
            response: OpenRouter Images API 的响应 JSON。

        Returns:
            解码后的图片。

        Raises:
            ProviderError: 图片缺失或 Base64 非法时抛出。
        """

        items = response.get("data", [])
        if not items or not items[0].get("b64_json"):
            raise ProviderError("OpenRouter GPT-Image-2 没有返回图片")
        try:
            image_data = base64.b64decode(items[0]["b64_json"], validate=True)
            mime_type = items[0].get("media_type") or "image/png"
            width, height = _png_dimensions(image_data)
            return GeneratedBinary(
                data=image_data,
                mime_type=mime_type,
                actual_width=width,
                actual_height=height,
            )
        except (ValueError, TypeError) as exc:
            raise ProviderError("OpenRouter 图片 Base64 无法解码") from exc

    async def close(self) -> None:
        """关闭由 Adapter 创建的 HTTP 客户端。

        Args:
            无。

        Returns:
            无。

        Raises:
            httpx.HTTPError: 关闭连接池失败时可能抛出。
        """

        if self._owns_client:
            await self._http_client.aclose()


class ProviderRouter:
    """根据统一模型名返回已注册 Adapter。"""

    def __init__(self, providers: Mapping[str, ImageProvider]) -> None:
        """复制模型到 Adapter 的映射。

        Args:
            providers: 模型名到实现对象的映射。

        Returns:
            无。

        Raises:
            不主动抛出异常。
        """

        self._providers = dict(providers)

    def get(self, model: ImageModel | str) -> ImageProvider:
        """按模型名读取 Adapter。

        Args:
            model: 前端和领域层使用的统一模型名。

        Returns:
            已注册的图片供应商 Adapter。

        Raises:
            UnsupportedCapabilityError: 模型没有注册时抛出。
        """

        try:
            return self._providers[model]
        except KeyError as exc:
            raise UnsupportedCapabilityError(f"未注册的图片模型：{model}") from exc
