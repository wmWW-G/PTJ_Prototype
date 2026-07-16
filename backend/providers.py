"""Nano Banana 与 Azure GPT-Image-2 的统一图片 Adapter。"""

from __future__ import annotations

import base64
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
from .sizing import calculate_azure_size


GOOGLE_IMAGE_MODELS: dict[str, str] = {
    "nano_banana_2": "gemini-3.1-flash-image",
    "nano_banana_pro": "gemini-3-pro-image",
}


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


class AzureImageProvider:
    """Azure GPT-Image-2 文生图与编辑 Adapter。"""

    def __init__(
        self,
        *,
        endpoint: str,
        api_key: str,
        deployment: str,
        edit_api_version: str,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        """保存 Azure 连接配置。

        Args:
            endpoint: Azure OpenAI 资源 Endpoint。
            api_key: 仅位于服务端环境变量中的访问密钥。
            deployment: GPT-Image-2 部署名称。
            edit_api_version: 图片编辑接口 API Version。
            http_client: 可选 HTTPX 客户端，用于测试注入。

        Returns:
            无。

        Raises:
            不主动抛出异常。
        """

        self._endpoint = endpoint.rstrip("/")
        self._api_key = api_key
        self._deployment = deployment
        self._edit_api_version = edit_api_version
        self._http_client = http_client or httpx.AsyncClient(timeout=240)
        self._owns_client = http_client is None

    async def generate(self, prompt: str, spec: ImageSpec) -> GeneratedBinary:
        """调用 Azure GPT-Image-2 文生图。

        Args:
            prompt: 当前图片 Prompt。
            spec: 比例、清晰度和质量参数。

        Returns:
            解码后的图片及实际像素尺寸。

        Raises:
            ProviderError: 上游请求或返回解析失败时抛出。
            UnsupportedCapabilityError: 动态尺寸无法满足 Azure 约束时抛出。
        """

        size = calculate_azure_size(spec.aspect_ratio, spec.resolution)
        response = await self._request(
            "POST",
            f"{self._endpoint}/openai/v1/images/generations?api-version=preview",
            json={
                "model": self._deployment,
                "prompt": prompt,
                "size": size.api_value,
                "quality": spec.quality or "medium",
                "n": 1,
                "output_format": "png",
            },
        )
        result = self._extract_azure_image(response)
        return result.model_copy(update={"actual_width": size.width, "actual_height": size.height})

    async def edit(
        self,
        prompt: str,
        references: Sequence[BinaryAsset],
        spec: ImageSpec,
    ) -> GeneratedBinary:
        """调用 Azure 部署级图片编辑接口。

        Args:
            prompt: 当前槽位 Prompt。
            references: 用户原图或无图模式生成的基准图。
            spec: 比例、清晰度和质量参数。

        Returns:
            解码后的编辑图片及实际尺寸。

        Raises:
            UnsupportedCapabilityError: 参考图为空时抛出。
            ProviderError: 上游请求或解析失败时抛出。
        """

        if not references:
            raise UnsupportedCapabilityError("Azure 图片编辑至少需要一张参考图")
        size = calculate_azure_size(spec.aspect_ratio, spec.resolution)
        files = [
            ("image[]", (reference.name, reference.data, reference.mime_type))
            for reference in references
        ]
        data = {
            "prompt": prompt,
            "size": size.api_value,
            "quality": spec.quality or "medium",
            "n": "1",
            "output_format": "png",
        }
        response = await self._request(
            "POST",
            (
                f"{self._endpoint}/openai/deployments/{self._deployment}/images/edits"
                f"?api-version={self._edit_api_version}"
            ),
            data=data,
            files=files,
        )
        result = self._extract_azure_image(response)
        return result.model_copy(update={"actual_width": size.width, "actual_height": size.height})

    async def _request(self, method: str, url: str, **kwargs: Any) -> dict[str, Any]:
        """发送带 Azure API Key 的请求并统一错误。

        Args:
            method: HTTP 方法。
            url: 完整 Azure URL。
            **kwargs: HTTPX 的 json/data/files 等请求参数。

        Returns:
            上游响应 JSON。

        Raises:
            ProviderError: 网络错误、HTTP 错误或 JSON 无效时抛出。
        """

        try:
            response = await self._http_client.request(
                method,
                url,
                headers={"api-key": self._api_key},
                **kwargs,
            )
        except httpx.HTTPError as exc:
            raise ProviderError("无法连接 Azure OpenAI", retryable=True) from exc
        if response.is_error:
            raise ProviderError(
                f"Azure OpenAI 返回 HTTP {response.status_code}",
                status_code=response.status_code,
                retryable=response.status_code in {408, 429, 500, 502, 503, 504},
            )
        try:
            return response.json()
        except ValueError as exc:
            raise ProviderError("Azure OpenAI 返回了无效 JSON") from exc

    @staticmethod
    def _extract_azure_image(response: dict[str, Any]) -> GeneratedBinary:
        """从 Azure 响应中提取首张 Base64 图片。

        Args:
            response: Azure 图片接口的响应 JSON。

        Returns:
            解码后的图片。

        Raises:
            ProviderError: 图片缺失或 Base64 非法时抛出。
        """

        items = response.get("data", [])
        if not items or not items[0].get("b64_json"):
            raise ProviderError("Azure GPT-Image-2 没有返回图片")
        try:
            return GeneratedBinary(data=base64.b64decode(items[0]["b64_json"]))
        except (ValueError, TypeError) as exc:
            raise ProviderError("Azure 图片 Base64 无法解码") from exc

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
