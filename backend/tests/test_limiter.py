"""受控并发、限流和重试测试。"""

import asyncio

import pytest

from backend.domain import ProviderError
from backend.limiter import AsyncRateLimiter


@pytest.mark.asyncio
async def test_limiter_never_exceeds_concurrency() -> None:
    """大量任务同时进入时，活跃请求不能超过配置上限。"""

    limiter = AsyncRateLimiter(max_concurrency=2, requests_per_minute=1000)
    active = 0
    maximum = 0

    async def operation() -> str:
        """记录并发峰值的模拟请求。"""

        nonlocal active, maximum
        active += 1
        maximum = max(maximum, active)
        await asyncio.sleep(0.01)
        active -= 1
        return "ok"

    await asyncio.gather(*(limiter.run(operation) for _ in range(6)))
    assert maximum == 2


@pytest.mark.asyncio
async def test_retryable_error_is_retried_twice() -> None:
    """408/429/5xx 一类临时错误最多可在初次失败后重试两次。"""

    limiter = AsyncRateLimiter(
        max_concurrency=1,
        requests_per_minute=1000,
        retry_delays=(0, 0),
    )
    calls = 0

    async def operation() -> str:
        """前两次失败、第三次成功的模拟请求。"""

        nonlocal calls
        calls += 1
        if calls < 3:
            raise ProviderError("临时失败", status_code=429, retryable=True)
        return "ok"

    assert await limiter.run(operation) == "ok"
    assert calls == 3


@pytest.mark.asyncio
async def test_non_retryable_error_fails_immediately() -> None:
    """参数、权限或内容错误不能盲目重试。"""

    limiter = AsyncRateLimiter(max_concurrency=1, requests_per_minute=1000)
    calls = 0

    async def operation() -> str:
        """模拟不可重试错误。"""

        nonlocal calls
        calls += 1
        raise ProviderError("内容被拒绝", status_code=400, retryable=False)

    with pytest.raises(ProviderError):
        await limiter.run(operation)
    assert calls == 1

