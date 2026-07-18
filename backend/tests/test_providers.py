"""真实生图模型 Adapter 的请求映射测试。"""

import base64
from typing import Any

import httpx
import pytest

from backend.domain import BinaryAsset, ImageSpec, ProviderError
from backend.providers import GoogleImageProvider, OpenRouterImageProvider, ProviderRouter


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
async def test_openrouter_generate_uses_images_api_and_supported_parameters() -> None:
    """OpenRouter Adapter 只发送 GPT-Image-2 当前端点声明支持的字段。"""

    async def handler(request: httpx.Request) -> httpx.Response:
        payload = __import__("json").loads(request.content)
        assert str(request.url) == "https://openrouter.ai/api/v1/images"
        assert request.headers["authorization"] == "Bearer test-key"
        assert request.headers["http-referer"] == "https://example.com/product"
        assert request.headers["x-title"] == "PTJ Prototype Test"
        assert payload["quality"] == "high"
        assert payload["model"] == "openai/gpt-image-2"
        assert payload["n"] == 1
        assert "16:9" in payload["prompt"]
        assert "2K" in payload["prompt"]
        assert "size" not in payload
        assert "resolution" not in payload
        assert "aspect_ratio" not in payload
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "b64_json": base64.b64encode(b"openrouter-image").decode(),
                        "media_type": "image/webp",
                    }
                ]
            },
        )

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = OpenRouterImageProvider(
        api_key="test-key",
        site_url="https://example.com/product",
        app_name="PTJ Prototype Test",
        http_client=http_client,
    )
    result = await provider.generate(
        "商品主图",
        ImageSpec(
            model="gpt_image_2_openrouter",
            aspect_ratio="16:9",
            resolution="2K",
            quality="high",
        ),
    )

    await http_client.aclose()
    assert result.data == b"openrouter-image"
    assert result.mime_type == "image/webp"


@pytest.mark.asyncio
async def test_openrouter_generate_maps_resolution_to_quality_when_unspecified() -> None:
    """调用方不传质量时，应把统一清晰度档位映射为 OpenRouter quality。"""

    async def handler(request: httpx.Request) -> httpx.Response:
        payload = __import__("json").loads(request.content)
        assert payload["quality"] == "low"
        return httpx.Response(
            200,
            json={"data": [{"b64_json": base64.b64encode(b"image").decode()}]},
        )

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = OpenRouterImageProvider(
        api_key="test-key",
        http_client=http_client,
    )
    result = await provider.generate(
        "商品主图",
        ImageSpec(
            model="gpt_image_2_openrouter",
            aspect_ratio="1:1",
            resolution="1K",
        ),
    )

    await http_client.aclose()
    assert result.data == b"image"


@pytest.mark.asyncio
async def test_openrouter_error_exposes_safe_code_and_message() -> None:
    """OpenRouter 失败时保留脱敏诊断，不能包含 Authorization Key。"""

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
    provider = OpenRouterImageProvider(
        api_key="test-key",
        http_client=http_client,
    )

    with pytest.raises(ProviderError) as captured:
        await provider.generate(
            "商品主图",
            ImageSpec(
                model="gpt_image_2_openrouter",
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
    assert "test-key" not in message


@pytest.mark.asyncio
async def test_openrouter_429_exposes_retry_after_seconds() -> None:
    """OpenRouter 429 的 Retry-After 秒数必须交给限流器。"""

    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            429,
            headers={"retry-after": "2.5"},
            json={"error": {"code": "rate_limit_exceeded", "message": "slow down"}},
        )

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = OpenRouterImageProvider(
        api_key="test-key",
        http_client=http_client,
    )

    with pytest.raises(ProviderError) as captured:
        await provider.generate(
            "商品主图",
            ImageSpec(
                model="gpt_image_2_openrouter",
                aspect_ratio="1:1",
                resolution="1K",
                quality="low",
            ),
        )

    await http_client.aclose()
    assert captured.value.retryable is True
    assert captured.value.retry_after_seconds == 2.5


@pytest.mark.asyncio
async def test_openrouter_edit_uses_json_data_url_references() -> None:
    """OpenRouter 图生图必须通过同一 Images API 的 input_references 传图。"""

    async def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://openrouter.ai/api/v1/images"
        assert request.headers["content-type"].startswith("application/json")
        payload = __import__("json").loads(request.content)
        assert payload["model"] == "openai/gpt-image-2"
        references = payload["input_references"]
        assert len(references) == 1
        assert references[0]["type"] == "image_url"
        assert references[0]["image_url"]["url"].startswith("data:image/png;base64,")
        assert references[0]["image_url"]["url"].endswith(
            base64.b64encode(b"reference").decode()
        )
        return httpx.Response(
            200,
            json={
                "data": [{"b64_json": base64.b64encode(b"openrouter-edited").decode()}]
            },
        )

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = OpenRouterImageProvider(
        api_key="test-key",
        http_client=http_client,
    )

    result = await provider.edit(
        "保持商品一致并更换场景",
        [BinaryAsset(data=b"reference", mime_type="image/png", name="anchor.png")],
        ImageSpec(
            model="gpt_image_2_openrouter",
            aspect_ratio="1:1",
            resolution="2K",
            quality="medium",
        ),
    )

    await http_client.aclose()
    assert result.data == b"openrouter-edited"


def test_provider_router_returns_registered_model() -> None:
    """业务层只通过模型名取 Adapter，不关心供应商分支。"""

    google = GoogleImageProvider(FakeGoogleClient())
    router = ProviderRouter({"nano_banana_2": google})
    assert router.get("nano_banana_2") is google


def test_openrouter_extracts_actual_png_dimensions() -> None:
    """OpenRouter 没有单独返回尺寸时，结果卡仍应显示 PNG 的真实宽高。"""

    # PNG 签名后依次是 IHDR 长度、IHDR 类型，再是大端宽高。
    png_header = (
        b"\x89PNG\r\n\x1a\n"
        + b"\x00\x00\x00\rIHDR"
        + (1254).to_bytes(4, "big")
        + (1254).to_bytes(4, "big")
    )
    result = OpenRouterImageProvider._extract_image(
        {"data": [{"b64_json": base64.b64encode(png_header).decode()}]}
    )

    assert result.actual_width == 1254
    assert result.actual_height == 1254
