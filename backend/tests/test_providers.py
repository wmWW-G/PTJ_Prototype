"""真实生图模型 Adapter 的请求映射测试。"""

import base64
from typing import Any

import httpx
import pytest

from backend.domain import BinaryAsset, ImageSpec, ProviderError
from backend.providers import AzureImageProvider, GoogleImageProvider, ProviderRouter


class FakeGoogleClient:
    """返回内嵌 PNG 的 Google 客户端替身。"""

    def __init__(self) -> None:
        self.requests: list[tuple[str, dict[str, Any]]] = []

    async def generate_content(self, model: str, payload: dict[str, Any]) -> dict[str, Any]:
        """保存请求并返回最小合法图片响应。"""

        self.requests.append((model, payload))
        return {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "inlineData": {
                                    "mimeType": "image/png",
                                    "data": base64.b64encode(b"png-data").decode(),
                                }
                            }
                        ]
                    }
                }
            ]
        }


@pytest.mark.asyncio
async def test_google_provider_maps_dynamic_model_ratio_and_resolution() -> None:
    """Google Adapter 必须把三个动态参数放到单个请求里。"""

    client = FakeGoogleClient()
    provider = GoogleImageProvider(client)
    result = await provider.generate(
        "高级商品主图",
        ImageSpec(model="nano_banana_pro", aspect_ratio="16:9", resolution="4K"),
    )

    model, payload = client.requests[0]
    assert model == "gemini-3-pro-image"
    assert payload["generationConfig"]["imageConfig"] == {
        "aspectRatio": "16:9",
        "imageSize": "4K",
    }
    assert result.data == b"png-data"


@pytest.mark.asyncio
async def test_google_edit_includes_reference_image() -> None:
    """Google 图生图请求必须包含原始参考图，而非只发送文字。"""

    client = FakeGoogleClient()
    provider = GoogleImageProvider(client)
    await provider.edit(
        "保持商品结构",
        [BinaryAsset(data=b"reference", mime_type="image/png", name="original")],
        ImageSpec(model="nano_banana_2", aspect_ratio="1:1", resolution="2K"),
    )

    parts = client.requests[0][1]["contents"][0]["parts"]
    assert any("inlineData" in part for part in parts)


@pytest.mark.asyncio
async def test_azure_generate_uses_calculated_size_and_quality() -> None:
    """Azure Adapter 应把产品比例转换为动态像素尺寸，并独立传质量。"""

    async def handler(request: httpx.Request) -> httpx.Response:
        payload = __import__("json").loads(request.content)
        assert payload["size"].count("x") == 1
        assert payload["quality"] == "high"
        assert payload["model"] == "gpt-image-2"
        return httpx.Response(
            200,
            json={"data": [{"b64_json": base64.b64encode(b"azure-image").decode()}]},
        )

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = AzureImageProvider(
        endpoint="https://example.openai.azure.com",
        api_key="test-key",
        deployment="gpt-image-2",
        edit_api_version="2025-04-01",
        http_client=http_client,
    )
    result = await provider.generate(
        "商品主图",
        ImageSpec(
            model="gpt_image_2_azure",
            aspect_ratio="16:9",
            resolution="2K",
            quality="high",
        ),
    )

    await http_client.aclose()
    assert result.data == b"azure-image"


@pytest.mark.asyncio
async def test_azure_generate_normalizes_foundry_project_endpoint() -> None:
    """Foundry 项目 URL 必须转换成 GPT-Image API 要求的资源 Endpoint。

    用户从 Foundry 项目页复制的 URL 会带有 ``services.ai.azure.com/api/projects``；
    图片 API 则要求同一资源的 ``openai.azure.com`` 主机。若直接拼接，Azure
    会在真正生成前返回 HTTP 400。
    """

    async def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).startswith(
            "https://demo-resource.openai.azure.com/openai/v1/images/generations"
        )
        return httpx.Response(
            200,
            json={"data": [{"b64_json": base64.b64encode(b"azure-image").decode()}]},
        )

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = AzureImageProvider(
        endpoint="https://demo-resource.services.ai.azure.com/api/projects/demo-project",
        api_key="test-key",
        deployment="gpt-image-2",
        edit_api_version="2025-04-01",
        http_client=http_client,
    )

    result = await provider.generate(
        "商品主图",
        ImageSpec(
            model="gpt_image_2_azure",
            aspect_ratio="1:1",
            resolution="1K",
            quality="low",
        ),
    )

    await http_client.aclose()
    assert result.data == b"azure-image"


@pytest.mark.asyncio
async def test_azure_error_exposes_safe_code_and_message() -> None:
    """Azure 失败时应保留脱敏错误详情，不能只显示没有信息量的 HTTP 400。"""

    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400,
            headers={"x-request-id": "request-123"},
            json={
                "error": {
                    "code": "invalid_request_error",
                    "message": "The endpoint or deployment is invalid.",
                }
            },
        )

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = AzureImageProvider(
        endpoint="https://example.openai.azure.com",
        api_key="test-key",
        deployment="gpt-image-2",
        edit_api_version="2025-04-01",
        http_client=http_client,
    )

    with pytest.raises(ProviderError) as captured:
        await provider.generate(
            "商品主图",
            ImageSpec(
                model="gpt_image_2_azure",
                aspect_ratio="1:1",
                resolution="1K",
                quality="low",
            ),
        )

    await http_client.aclose()
    message = str(captured.value)
    assert "invalid_request_error" in message
    assert "endpoint or deployment is invalid" in message
    assert "request-123" in message


def test_provider_router_returns_registered_model() -> None:
    """业务层只通过模型名取 Adapter，不关心供应商分支。"""

    google = GoogleImageProvider(FakeGoogleClient())
    router = ProviderRouter({"nano_banana_2": google})
    assert router.get("nano_banana_2") is google
