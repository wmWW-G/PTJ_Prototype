"""Google Vertex AI REST 客户端与服务账号鉴权。"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
from google.auth.transport.requests import Request
from google.oauth2 import service_account

from .domain import ProviderError


class GoogleVertexClient:
    """使用同一 Vertex Endpoint 调用文本和图片 Gemini 模型。"""

    _SCOPES = ("https://www.googleapis.com/auth/cloud-platform",)

    def __init__(
        self,
        *,
        project: str,
        location: str,
        service_account_json: str,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        """创建带服务账号凭证的异步客户端。

        Args:
            project: Google Cloud 项目 ID。
            location: Vertex 区域，本项目默认 ``global``。
            service_account_json: Vercel 环境变量中的完整服务账号 JSON。
            http_client: 可选的 HTTPX 客户端，测试时用于注入 MockTransport。

        Returns:
            无。

        Raises:
            ValueError: 服务账号 JSON 不是合法 JSON 时抛出。
            google.auth.exceptions.GoogleAuthError: 凭证字段非法时抛出。
        """

        account_info = json.loads(service_account_json)
        self._credentials = service_account.Credentials.from_service_account_info(
            account_info,
            scopes=self._SCOPES,
        )
        self._project = project
        self._location = location
        self._http_client = http_client or httpx.AsyncClient(timeout=180)
        self._owns_client = http_client is None
        self._token_lock = asyncio.Lock()

    async def _access_token(self) -> str:
        """刷新并返回 OAuth Access Token。

        Args:
            无。

        Returns:
            当前有效的短期 OAuth Token。

        Raises:
            google.auth.exceptions.RefreshError: Google 拒绝刷新凭证时抛出。
        """

        async with self._token_lock:
            if not self._credentials.valid or not self._credentials.token:
                # google-auth 的刷新调用是同步网络操作，放到线程中避免阻塞 FastAPI 事件循环。
                await asyncio.to_thread(self._credentials.refresh, Request())
            return str(self._credentials.token)

    async def generate_content(self, model: str, payload: dict[str, Any]) -> dict[str, Any]:
        """调用 Vertex `generateContent` 并返回 JSON。

        Args:
            model: Vertex 发布的 Gemini 模型 ID。
            payload: 官方 generateContent 请求体。

        Returns:
            Google 返回的完整 JSON 字典。

        Raises:
            ProviderError: 请求失败、限流、鉴权失败或响应不是 JSON 时抛出。
        """

        token = await self._access_token()
        url = (
            f"https://aiplatform.googleapis.com/v1/projects/{self._project}"
            f"/locations/{self._location}/publishers/google/models/{model}:generateContent"
        )
        try:
            response = await self._http_client.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
        except httpx.HTTPError as exc:
            raise ProviderError("无法连接 Google Vertex AI", retryable=True) from exc
        if response.is_error:
            retryable = response.status_code in {408, 429, 500, 502, 503, 504}
            raise ProviderError(
                f"Google Vertex AI 返回 HTTP {response.status_code}",
                status_code=response.status_code,
                retryable=retryable,
            )
        try:
            return response.json()
        except ValueError as exc:
            raise ProviderError("Google Vertex AI 返回了无效 JSON") from exc

    async def close(self) -> None:
        """关闭由本对象创建的 HTTP 连接池。

        Args:
            无。

        Returns:
            无。

        Raises:
            httpx.HTTPError: 连接池关闭失败时可能抛出。
        """

        if self._owns_client:
            await self._http_client.aclose()

