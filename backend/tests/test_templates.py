"""服务器模板的行为测试。"""

import pytest

from backend.domain import UnsupportedTemplateError
from backend.templates import get_template


def test_default_template_counts() -> None:
    """四种默认模板必须保持已确认的 6、8、1、1 槽位数量。"""

    assert len(get_template("product_set_01").slots) == 6
    assert len(get_template("listing_01").slots) == 8
    assert len(get_template("main_01").slots) == 1
    assert len(get_template("poster_01").slots) == 1


def test_template_indices_are_continuous() -> None:
    """模板索引必须从 1 连续递增，避免流式结果与槽位错位。"""

    template = get_template("product_set_01")
    assert [slot.index for slot in template.slots] == [1, 2, 3, 4, 5, 6]


def test_unknown_template_is_rejected() -> None:
    """未知模板不能静默回退，否则前端选择和最终张数会失真。"""

    with pytest.raises(UnsupportedTemplateError):
        get_template("missing-template")
