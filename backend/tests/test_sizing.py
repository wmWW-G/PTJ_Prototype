"""Azure GPT-Image-2 动态尺寸算法测试。"""

import pytest

from backend.domain import UnsupportedCapabilityError
from backend.sizing import calculate_azure_size


@pytest.mark.parametrize("ratio", ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"])
@pytest.mark.parametrize("resolution", ["1K", "2K", "4K"])
def test_all_supported_sizes_stay_inside_azure_constraints(ratio: str, resolution: str) -> None:
    """所有前端可选组合都必须在调用 Azure 前满足硬性限制。"""

    size = calculate_azure_size(ratio, resolution)

    assert size.width % 16 == 0
    assert size.height % 16 == 0
    assert max(size.width, size.height) <= 3840
    assert 655_360 <= size.width * size.height <= 8_294_400
    assert max(size.width / size.height, size.height / size.width) <= 3


def test_azure_square_4k_is_clamped_to_pixel_limit() -> None:
    """正方形 4K 不能直接生成 3840 平方，必须受总像素限制。"""

    size = calculate_azure_size("1:1", "4K")

    assert size.width == size.height
    assert size.width * size.height <= 8_294_400
    assert size.api_value == f"{size.width}x{size.height}"


def test_azure_wide_1k_meets_minimum_pixels() -> None:
    """16:9 的 1K 长边会低于最小像素，需要自动放大。"""

    size = calculate_azure_size("16:9", "1K")

    assert size.width * size.height >= 655_360


def test_unsupported_ratio_is_rejected() -> None:
    """后端不能把未知比例原样发送给 Azure。"""

    with pytest.raises(UnsupportedCapabilityError):
        calculate_azure_size("8:1", "2K")


def test_unsupported_resolution_is_rejected() -> None:
    """后端只能接受产品层定义的三个分辨率档位。"""

    with pytest.raises(UnsupportedCapabilityError):
        calculate_azure_size("1:1", "8K")

