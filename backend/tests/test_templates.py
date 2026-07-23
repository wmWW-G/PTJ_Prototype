"""服务器模板的行为测试。"""

import hashlib
from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.domain import CustomVisualRoleSelection, UnsupportedTemplateError
from backend.templates import get_template
from backend.visual_templates import (
    LAYOUT_RECIPES,
    VISUAL_TEMPLATES,
    build_custom_visual_template,
    get_visual_template,
)


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


def test_all_visual_templates_publish_reference_level_density_contracts() -> None:
    """所有模板都必须达到用户确认的图文解说最低密度。"""

    dense_set = get_visual_template("dense_product_set")
    dense_listing = get_visual_template("dense_product_listing")

    assert dense_set.image_types == ["set"]
    assert dense_set.name == "高信息量商品套图"
    assert len(dense_set.role_highlights) == 6
    assert dense_listing.image_types == ["listing"]
    assert dense_listing.name == "高信息量采购详情"
    assert len(dense_listing.role_highlights) == 8
    for template in VISUAL_TEMPLATES.values():
        # “极简”只能描述配色和视觉语气，不能继续给模型发送少文字、
        # 大留白等与用户参考图相冲突的指令。
        visual_direction = f"{template.description}{template.art_direction}"
        assert "少文字" not in visual_direction
        assert "大面积留白" not in visual_direction
        profile = template.density_profile
        assert profile.level == "high"
        assert profile.min_information_units == 9
        assert profile.max_information_units == 12
        assert profile.min_supporting_visuals == 4
        assert profile.min_visible_labels == 5
        assert profile.max_visible_labels == 8
        assert profile.target_occupancy_percent == 80
        assert len(template.role_compositions) == len(template.role_highlights)
        assert all(
            "醒目标题" in composition
            and "解释副标题" in composition
            and "至少 4 个" in composition
            and "一句解释" in composition
            for composition in template.role_compositions
        )


def test_every_visual_template_role_has_a_unique_existing_preview() -> None:
    """每个职责必须有独立且真实存在的预览图，禁止重复占位素材。

    用户会根据模板详情中的逐张预览决定最终选择，因此角色数量、图片数量、
    唯一路径数量必须完全一致。文件检查还能防止前后端字符串已更新、但图片
    没有真正落入 ``public`` 的假交付。
    """

    public_root = Path(__file__).resolve().parents[2] / "public"
    all_preview_paths: list[str] = []
    all_preview_digests: set[str] = set()
    for template_id, template in VISUAL_TEMPLATES.items():
        role_count = len(template.role_highlights)
        assert len(template.preview_images) == role_count, template_id
        assert len(set(template.preview_images)) == role_count, template_id
        preview_digests: set[str] = set()
        for preview_path in template.preview_images:
            all_preview_paths.append(preview_path)
            preview_file = public_root / preview_path
            assert preview_file.is_file(), (
                f"{template_id} 缺少预览文件：{preview_path}"
            )
            # 路径不同仍可能只是复制了同一张占位图；内容摘要可以守住真正的
            # “一职责一画面”，同时不依赖 Pillow 等额外图像处理依赖。
            digest = hashlib.sha256(preview_file.read_bytes()).hexdigest()
            preview_digests.add(digest)
            all_preview_digests.add(digest)
        assert len(preview_digests) == role_count, (
            f"{template_id} 存在内容完全相同的重复预览图"
        )
    assert len(all_preview_paths) == 62
    assert len(set(all_preview_paths)) == 62
    assert len(all_preview_digests) == 62


def test_custom_role_can_apply_only_registered_layout_recipe() -> None:
    """自定义职责只能引用服务器白名单配方，不能传入任意构图文字。"""

    roles = [
        CustomVisualRoleSelection(
            template_id="standard_product",
            role_index=index,
            layout_recipe_id="detail_callouts" if index == 0 else None,
        )
        for index in range(6)
    ]
    custom = build_custom_visual_template(
        image_type="set",
        selections=roles,
        expected_count=6,
    )

    assert LAYOUT_RECIPES["detail_callouts"] in custom.role_compositions[0]
    assert custom.density_profile.level == "high"

    with pytest.raises(ValidationError):
        CustomVisualRoleSelection(
            template_id="standard_product",
            role_index=0,
            layout_recipe_id="free-form-injection",
        )
