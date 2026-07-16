"""异步并发上限、每分钟限流与临时错误重试。"""

from __future__ import annotations

import asyncio
import random
import time
from collections import deque
from collections.abc import Awaitable, Callable
from typing import TypeVar

from .domain import ProviderError


T = TypeVar("T")
RetryCallback = Callable[[int, ProviderError, float], Awaitable[None]]


class AsyncRateLimiter:
    """为单个模型组合并发信号量和滑动窗口 RPM 限制。"""

    def __init__(
        self,
        *,
        max_concurrency: int,
        requests_per_minute: int,
        retry_delays: tuple[float, float] = (1.0, 2.5),
        retry_jitter_seconds: float = 0.0,
    ) -> None:
        """创建限流器。

        Args:
            max_concurrency: 同一时刻允许发往该模型的最大请求数。
            requests_per_minute: 最近 60 秒内允许启动的请求数。
            retry_delays: 第一次和第二次重试前的基础等待秒数。
            retry_jitter_seconds: 每次重试额外增加的随机错峰秒数上限。

        Returns:
            无。

        Raises:
            ValueError: 并发数、RPM 或重试延迟非法时抛出。
        """

        if max_concurrency < 1:
            raise ValueError("max_concurrency 必须大于 0")
        if requests_per_minute < 1:
            raise ValueError("requests_per_minute 必须大于 0")
        if len(retry_delays) != 2 or any(delay < 0 for delay in retry_delays):
            raise ValueError("retry_delays 必须包含两个非负等待时间")
        if retry_jitter_seconds < 0:
            raise ValueError("retry_jitter_seconds 不能小于 0")
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._requests_per_minute = requests_per_minute
        self._retry_delays = retry_delays
        self._retry_jitter_seconds = retry_jitter_seconds
        self._timestamps: deque[float] = deque()
        self._window_lock = asyncio.Lock()

    async def _wait_for_rate_slot(self) -> None:
        """等待滑动窗口出现一个可用请求名额。

        Args:
            无。

        Returns:
            无；返回时已经登记当前请求时间。

        Raises:
            asyncio.CancelledError: 调用任务被取消时透传。
        """

        while True:
            async with self._window_lock:
                now = time.monotonic()
                while self._timestamps and now - self._timestamps[0] >= 60:
                    self._timestamps.popleft()
                if len(self._timestamps) < self._requests_per_minute:
                    self._timestamps.append(now)
                    return
                wait_seconds = max(0.01, 60 - (now - self._timestamps[0]))
            # 必须在锁外等待，否则其他完成任务无法及时清理窗口。
            await asyncio.sleep(wait_seconds)

    async def run(
        self,
        operation: Callable[[], Awaitable[T]],
        *,
        on_retry: RetryCallback | None = None,
    ) -> T:
        """在并发与 RPM 保护下执行操作，并重试临时供应商错误。

        Args:
            operation: 无参数异步函数，每次调用发起一次真实供应商请求。
            on_retry: 可选回调，参数依次为重试序号、异常和等待秒数。

        Returns:
            operation 的成功结果。

        Raises:
            ProviderError: 不可重试错误，或两次重试后仍失败时抛出。
            Exception: operation 抛出的其他异常原样透传。
            asyncio.CancelledError: 请求被取消时透传。
        """

        for attempt in range(3):
            try:
                async with self._semaphore:
                    await self._wait_for_rate_slot()
                    return await operation()
            except ProviderError as exc:
                if not exc.retryable or attempt >= 2:
                    raise
                # 429 必须优先遵守 Azure 返回的 retry-after-ms；随机错峰可避免
                # 同一批并发请求在同一毫秒再次撞上限流。
                delay = max(
                    self._retry_delays[attempt],
                    exc.retry_after_seconds or 0.0,
                )
                if self._retry_jitter_seconds:
                    delay += random.uniform(0.0, self._retry_jitter_seconds)
                if on_retry is not None:
                    await on_retry(attempt + 1, exc, delay)
                if delay:
                    await asyncio.sleep(delay)
        raise RuntimeError("不可达的重试状态")
