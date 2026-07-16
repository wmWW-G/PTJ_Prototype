"""Azure GPT-Image-2 动态图片尺寸换算。"""

from __future__ import annotations

import math

from .domain import AzureSize, UnsupportedCapabilityError


_RATIOS: dict[str, tuple[int, int]] = {
    "1:1": (1, 1),
    "3:2": (3, 2),
    "2:3": (2, 3),
    "4:3": (4, 3),
    "3:4": (3, 4),
    "16:9": (16, 9),
    "9:16": (9, 16),
}
_LONG_EDGES: dict[str, int] = {"1K": 1024, "2K": 2048, "4K": 3840}
_MIN_PIXELS = 655_360
_MAX_PIXELS = 8_294_400
_MAX_EDGE = 3840


def _round_to_multiple(value: float, *, mode: str = "nearest") -> int:
    """将像素值转换为 Azure 要求的 16 倍数。

    Args:
        value: 尚未对齐的正数像素值。
        mode: ``nearest``、``up`` 或 ``down``，决定舍入方向。

    Returns:
        至少为 16 的整数像素值。

    Raises:
        ValueError: mode 不是三个允许值之一时抛出。
    """

    if mode == "up":
        blocks = math.ceil(value / 16)
    elif mode == "down":
        blocks = math.floor(value / 16)
    elif mode == "nearest":
        blocks = round(value / 16)
    else:
        raise ValueError(f"未知舍入模式：{mode}")
    return max(16, blocks * 16)


def calculate_azure_size(aspect_ratio: str, resolution: str) -> AzureSize:
    """把产品层比例和分辨率档位换算为合法 Azure 像素尺寸。

    先以 1K/2K/4K 为目标长边，再按比例计算短边。如果组合低于最小像素，
    就等比放大；如果高于总像素或最长边上限，就等比缩小。最后对齐为 16 的倍数。

    Args:
        aspect_ratio: 产品支持的比例，例如 ``"16:9"``。
        resolution: 产品分辨率档位：``"1K"``、``"2K"`` 或 ``"4K"``。

    Returns:
        包含宽、高和 API 字符串的 ``AzureSize``。

    Raises:
        UnsupportedCapabilityError: 比例、分辨率非法，或无法构造合法尺寸时抛出。
    """

    if aspect_ratio not in _RATIOS:
        raise UnsupportedCapabilityError(f"Azure 不支持比例：{aspect_ratio}")
    if resolution not in _LONG_EDGES:
        raise UnsupportedCapabilityError(f"不支持分辨率档位：{resolution}")

    ratio_width, ratio_height = _RATIOS[aspect_ratio]
    target_long_edge = _LONG_EDGES[resolution]

    # 先按目标长边建立原始尺寸，保持用户选择的横竖方向。
    if ratio_width >= ratio_height:
        raw_width = float(target_long_edge)
        raw_height = target_long_edge * ratio_height / ratio_width
    else:
        raw_height = float(target_long_edge)
        raw_width = target_long_edge * ratio_width / ratio_height

    raw_pixels = raw_width * raw_height

    # 1K 宽图可能达不到 Azure 最小像素数，因此需要先整体放大。
    if raw_pixels < _MIN_PIXELS:
        scale = math.sqrt(_MIN_PIXELS / raw_pixels)
        raw_width *= scale
        raw_height *= scale

    # 4K 正方形等组合会超过最大总像素，必须整体缩小而不是裁切。
    max_scale = min(
        1.0,
        _MAX_EDGE / max(raw_width, raw_height),
        math.sqrt(_MAX_PIXELS / (raw_width * raw_height)),
    )
    raw_width *= max_scale
    raw_height *= max_scale

    width = _round_to_multiple(raw_width)
    height = _round_to_multiple(raw_height)

    # 最近舍入可能刚好越过上限；逐块缩小较长边，直到所有硬约束满足。
    while (
        width * height > _MAX_PIXELS
        or max(width, height) > _MAX_EDGE
        or max(width / height, height / width) > 3
    ):
        if width >= height:
            width -= 16
        else:
            height -= 16

    # 最近舍入也可能让 1K 宽图略低于最小像素；按比例整体向上对齐。
    while width * height < _MIN_PIXELS:
        scale = math.sqrt(_MIN_PIXELS / (width * height))
        next_width = _round_to_multiple(width * scale, mode="up")
        next_height = _round_to_multiple(height * scale, mode="up")
        if max(next_width, next_height) > _MAX_EDGE:
            break
        width, height = next_width, next_height

    size = AzureSize(width=width, height=height)
    if not (
        size.width % 16 == 0
        and size.height % 16 == 0
        and max(size.width, size.height) <= _MAX_EDGE
        and _MIN_PIXELS <= size.width * size.height <= _MAX_PIXELS
        and max(size.width / size.height, size.height / size.width) <= 3
    ):
        raise UnsupportedCapabilityError(
            f"无法为 {aspect_ratio}/{resolution} 构造合法 Azure 尺寸"
        )
    return size
