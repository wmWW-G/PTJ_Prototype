# High-Density Product Infographics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 让套图和详情图默认能够生成类似棒球帽参考图的高信息密度商品信息图，同时保留事实安全、商品一致性和现有极简模板。

**Architecture:** 后端维护受控布局配方、密度契约和两套新视觉模板，Planner 结构化输出并校验每张图的信息单元与可见标签数量。前端把高密度模板设为套图/详情图默认项，允许所有真实生图类型上传独立风格参考；个人模板只保存服务器允许的 layout_recipe_id，不接受任意构图 Prompt 注入。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、FastAPI、Pydantic、Python 3.14、pytest

## Global Constraints

- 本轮不新增第三方依赖，不实现 Pillow/Canvas 确定性叠字；只为未来叠字保留结构化 information_units。
- 主图固定 1 张、套图 6 张、详情图 8 张、海报 1 张，不改变 backend/templates.py 的槽位数量。
- 最终高信息密度契约统一覆盖九套视觉模板：每张 9–12 个信息单元、至少 4 个辅助视觉单元、5–8 条可见文案、目标有效内容占画布约 80%；每个辅助模块必须同时包含图片、短标签和一句解释。
- MOQ、价格、交期、认证、材质等级、产能、测试结论和客户品牌等硬信息，只能逐字来自 verified_supplemental_info；缺失时省略，不生成占位数字或虚假 Logo。
- 非数字、非认证类短标签只能概括用户输入、ProductContext 中已提取的事实或图片可直接观察的结构，禁止最高级和无法验证的比较。
- 风格参考图只学习构图、层级、配色和信息组织，不参与商品事实分析，不得复制参考图中的商品、品牌、Logo、文字、水印或受保护图形。
- layout_recipe_id 必须是服务器 Literal/注册表允许的稳定枚举；前端不得提交任意构图文字替代它。
- minimal_premium 保持低密度，主图和海报继续使用 standard_product；只把套图和详情图默认项切到新高密度模板。
- 保留工作区已有未提交改动；不要使用 git reset、git checkout --、git stash，不要暂存或提交文件。
- 所有新增或修改函数保留完整中文注释、参数、返回值和异常说明，并解释关键分支为什么存在。
- 完成实现后更新现有 CONTEXT.md 与 DEV_LOG.md，不新增其他说明文档。

---

### Task 1: 后端密度契约、布局配方和新视觉模板

**Files:**
- Modify: backend/domain.py
- Modify: backend/visual_templates.py
- Modify: backend/tests/test_templates.py
- Modify: backend/tests/test_api.py
- Modify: backend/tests/test_orchestrator.py

**Interfaces:**
- Produces: DensityLevel、LayoutRecipeId、InformationUnitKind、InformationUnitSource。
- Produces: InformationDensityProfile、ImageInformationUnit、LAYOUT_RECIPES。
- Extends: CustomVisualRoleSelection.layout_recipe_id: LayoutRecipeId | None。
- Extends: VisualTemplateDefinition.density_profile: InformationDensityProfile。
- Extends: ImagePrompt.information_units: list[ImageInformationUnit]。
- Produces: dense_product_set 和 dense_product_listing。

- [ ] **Step 1: 写失败测试**

在 backend/tests/test_templates.py 增加：

~~~python
from pydantic import ValidationError

from backend.domain import CustomVisualRoleSelection
from backend.visual_templates import (
    LAYOUT_RECIPES,
    build_custom_visual_template,
    get_visual_template,
)


def test_dense_templates_publish_fixed_high_density_contracts() -> None:
    dense_set = get_visual_template("dense_product_set")
    dense_listing = get_visual_template("dense_product_listing")

    assert dense_set.image_types == ["set"]
    assert len(dense_set.role_highlights) == 6
    assert dense_listing.image_types == ["listing"]
    assert len(dense_listing.role_highlights) == 8
    for template in (dense_set, dense_listing):
        profile = template.density_profile
        assert profile.level == "high"
        assert profile.min_information_units == 9
        assert profile.max_information_units == 12
        assert profile.min_supporting_visuals == 4
        assert profile.min_visible_labels == 5
        assert profile.max_visible_labels == 8
        assert profile.target_occupancy_percent == 80


def test_custom_role_can_apply_only_registered_layout_recipe() -> None:
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
~~~

在 backend/tests/test_api.py 的 capabilities 测试断言两套模板和完整 density_profile 返回；在 backend/tests/test_orchestrator.py 断言自定义职责携带 detail_callouts 后，Planner 收到的构图包含服务器注册配方且 density_profile.level 为 high。

- [ ] **Step 2: 运行红灯测试**

Run:

~~~bash
env PYTHONPATH=. .venv/bin/pytest backend/tests/test_templates.py backend/tests/test_api.py backend/tests/test_orchestrator.py -q
~~~

Expected: FAIL，明确缺少 LayoutRecipeId、density_profile、LAYOUT_RECIPES 或新模板。

- [ ] **Step 3: 实现领域类型**

在 backend/domain.py 定义：

~~~python
DensityLevel = Literal["minimal", "balanced", "high"]
LayoutRecipeId = Literal[
    "commercial_overview",
    "detail_callouts",
    "benefit_evidence",
    "variant_matrix",
    "craft_options",
    "application_matrix",
    "quality_proof",
    "packaging_trade",
]
InformationUnitKind = Literal[
    "hero",
    "supporting_visual",
    "detail_callout",
    "label",
    "badge",
    "variant",
    "process_step",
]
InformationUnitSource = Literal[
    "verified_input",
    "visual_evidence",
    "layout_instruction",
]


class InformationDensityProfile(BaseModel):
    """单张图片必须达到的可机器校验信息密度。"""

    level: DensityLevel = "balanced"
    min_information_units: int = Field(default=3, ge=1, le=12)
    max_information_units: int = Field(default=8, ge=1, le=12)
    min_supporting_visuals: int = Field(default=1, ge=0, le=8)
    min_visible_labels: int = Field(default=0, ge=0, le=8)
    max_visible_labels: int = Field(default=4, ge=0, le=8)
    target_occupancy_percent: int = Field(default=60, ge=40, le=90)

    @model_validator(mode="after")
    def validate_ranges(self) -> "InformationDensityProfile":
        if self.min_information_units > self.max_information_units:
            raise ValueError("最小信息单元数不能大于最大信息单元数")
        if self.min_visible_labels > self.max_visible_labels:
            raise ValueError("最小可见标签数不能大于最大可见标签数")
        return self


class ImageInformationUnit(BaseModel):
    """Planner 为单张图声明的一条可视信息或证据模块。"""

    kind: InformationUnitKind
    content: str = Field(min_length=1, max_length=160)
    source: InformationUnitSource
~~~

VisualTemplateDefinition 新增 density_profile，默认 InformationDensityProfile；CustomVisualRoleSelection 新增可选 layout_recipe_id；ImagePrompt 新增 information_units: list[ImageInformationUnit]，默认空数组、最多 12 项，保持旧计划兼容。

- [ ] **Step 4: 实现服务器布局配方和模板**

backend/visual_templates.py 注册以下精确配方：

~~~python
LAYOUT_RECIPES: dict[LayoutRecipeId, str] = {
    "commercial_overview": "1 个醒目短标题；1 个解释副标题；1 个占画面 45%–55% 的主商品；至少 4 个带图片、短标签和一句解释的辅助模块；有效内容约占画布 80%",
    "detail_callouts": "1 个醒目短标题；1 个解释副标题；1 个完整主商品；至少 4 个带图片、短标签和一句解释的辅助模块；有效内容约占画布 80%",
    "benefit_evidence": "1 个主商品；3 个真实卖点模块；每个卖点配对应局部证据或使用动作；另配 1–2 个辅助视觉；禁止只有图标没有证据",
    "variant_matrix": "1 个主商品；4–6 个颜色、款式或组合变体；2–3 条选择说明；变体整齐但避免无意义重复",
    "craft_options": "1 个主商品；3–4 个材质或工艺局部样片；每个样片配短标签；未确认的工艺只作中性结构示意",
    "application_matrix": "1 个主商品；2–3 个真实应用场景或采购对象；3 条用途短标签；商品在所有场景中保持同一身份",
    "quality_proof": "1 个主商品或成品；3 个来料、过程、成品检查步骤；2 个工具或细节证据；只显示用户确认的认证文字",
    "packaging_trade": "商品与包装同画面；3 个合作或包装步骤；2–3 个已确认交易信息徽章；未提供 MOQ、交期或认证时留出普通卖点而不编造",
}
~~~

新增 dense_product_set，职责依次为：商品采购总览、结构细节拆解、核心卖点证据、颜色款式矩阵、材质与 Logo 工艺、包装与合作信息。新增 dense_product_listing，在前六项基础上插入应用场景矩阵、品质与信任证据，最终保持 8 项。

九套模板使用 `public/demo/templates-v2/` 下的 62 张独立 ImageGen 预览，不循环复用占位图；每张按最终统一密度契约验收。三份 manifest 保存完整实际 Prompt、参考角色和验收信息。字段全部选填，硬信息提示“只填真实资料”。

build_custom_visual_template() 在 selection.layout_recipe_id 存在时附加服务器注册配方；任一职责采用注册配方时，整套 profile 升级为固定 high 契约。无配方时继承来源模板的最高密度，不静默降级。

- [ ] **Step 5: 跑定向测试**

Run:

~~~bash
env PYTHONPATH=. .venv/bin/pytest backend/tests/test_templates.py backend/tests/test_api.py backend/tests/test_orchestrator.py -q
~~~

Expected: PASS。

---

### Task 2: Planner 强制高密度并守住事实边界

**Files:**
- Modify: backend/planner.py
- Modify: backend/tests/test_planner.py

**Interfaces:**
- Consumes: VisualTemplateDefinition.density_profile 和 ImagePrompt.information_units。
- Produces: _meets_density_contract(image_prompt, density_profile) -> bool。
- Preserves: minimal/balanced 模板兼容旧计划；只有 high 执行严格数量校验。

- [ ] **Step 1: 写红灯测试**

扩展测试辅助函数，使高密度单图返回 7 个 information_units、至少 3 个 supporting kind，以及 visible_text 三项。单元固定覆盖 hero、两个 detail_callout、一个 supporting_visual、两个 label、一个 badge，source 只用 verified_input、visual_evidence、layout_instruction。

新增测试：

1. Fake client 第一份响应只有 3 个单元，第二份有 7 个；Planner 必须请求两次且只接受第二份。
2. 请求中的 density_contract 与模板 profile 完全一致。
3. rules 包含：硬信息逐字来自 verified_supplemental_info；描述标签只能来自用户事实、ProductContext 或视觉证据；单一版式骨架允许多个证据单元；不得把“一种主要结构”解释成一个卖点。

- [ ] **Step 2: 验证测试先失败**

Run:

~~~bash
env PYTHONPATH=. .venv/bin/pytest backend/tests/test_planner.py -q
~~~

Expected: FAIL，旧 Planner 错误接受首份低密度响应或缺少 density_contract。

- [ ] **Step 3: 实现密度校验**

backend/planner.py 增加：

~~~python
SUPPORTING_INFORMATION_KINDS = {
    "supporting_visual",
    "detail_callout",
    "variant",
    "process_step",
}


def _meets_density_contract(
    image_prompt: ImagePrompt,
    profile: InformationDensityProfile,
) -> bool:
    """判断单张计划是否满足模板的可机器校验信息密度。"""

    if profile.level != "high":
        return True
    unit_count = len(image_prompt.information_units)
    supporting_count = sum(
        unit.kind in SUPPORTING_INFORMATION_KINDS
        for unit in image_prompt.information_units
    )
    label_count = len(image_prompt.visible_text)
    return (
        profile.min_information_units <= unit_count <= profile.max_information_units
        and supporting_count >= profile.min_supporting_visuals
        and profile.min_visible_labels <= label_count <= profile.max_visible_labels
    )
~~~

plan_variant() 请求增加顶层 density_contract，output_schema 增加 information_units；每条高密度 ImagePrompt 不合格就进入现有第二次修复。repair 文案写出当前阈值。refine_image_prompt() 携带现有 information_units，并要求重写后同步更新它们，但因为没有视觉模板 profile，不自行硬编码 7 个门槛。

把旧规则“可见文字只能来自用户明确提供的内容”替换为 Global Constraints 中更精确的两级规则：硬信息逐字 verified；安全描述可基于已提取事实或可观察证据生成。

- [ ] **Step 4: 跑 Planner 测试**

Run:

~~~bash
env PYTHONPATH=. .venv/bin/pytest backend/tests/test_planner.py -q
~~~

Expected: PASS，并证明低密度首份响应被拒绝。

---

### Task 3: 前端高密度默认模板、风格参考和 Prompt 密度可见性

**Files:**
- Modify: src/features/generation/liveTypes.ts
- Modify: src/features/generation/components/VisualTemplatePicker.tsx
- Modify: src/features/generation/components/VisualTemplatePicker.module.css
- Modify: src/features/generation/components/PromptImageComposer.tsx
- Modify: src/features/generation/components/PromptReviewPanel.tsx
- Modify: src/features/generation/GenerationPage.tsx
- Modify: src/features/generation/GenerationPage.module.css
- Modify: src/features/generation/components/VisualTemplatePicker.test.tsx
- Modify: src/features/generation/GenerationPage.test.tsx

**Interfaces:**
- Consumes: capabilities.density_profile 和 Prompt information_units。
- Produces: 套图默认 dense_product_set，详情图默认 dense_product_listing。
- Produces: 全部真实生图类型最多 1 张独立 style_reference_assets。

- [ ] **Step 1: 写红灯测试**

VisualTemplatePicker.test.tsx 断言：九套模板全部显示“高信息量”，62 条预览路径全局唯一；`minimal_premium` 也必须保留高密度信息结构，不能退回大留白。

GenerationPage.test.tsx 断言：初始套图选中“高信息量商品套图”，详情图选中“高信息量采购详情”；套图存在“参考设计图”上传；风格图和商品图分别进入 style_reference_assets 与 reference_assets；只有风格图也会提交为图生图输入，但绝不进入 reference_assets。

Prompt 审核场景增加 7 个 information_units，界面显示“7 个信息单元”，不展开内部 source。

- [ ] **Step 2: 验证测试先失败**

Run:

~~~bash
npm run test:run -- src/features/generation/components/VisualTemplatePicker.test.tsx src/features/generation/GenerationPage.test.tsx
~~~

Expected: FAIL，旧默认项、标准布局缺少参考设计图、审核面板没有密度摘要。

- [ ] **Step 3: 扩展前端类型与回退模板**

liveTypes.ts 增加与后端同名的 union types、InformationDensityProfile、ImageInformationUnit。PlannedImagePrompt 新增可选 information_units；VisualTemplateCapability 新增可选 density_profile。

DEFAULT_VISUAL_TEMPLATES 增加 dense_product_set 和 dense_product_listing，字段、职责、预览、构图和阈值与后端一致。模板卡和详情页对 level === "high" 显示“高信息量”，缺失 profile 的旧后端视为 balanced。

- [ ] **Step 4: 让参考设计适用于全部真实生图类型**

复用 PromptImageComposer 现有单张参考设计卡，不复制上传逻辑：

- main 和 standard 两种 layout 都显示。
- 非主图提示为“只学习整套的信息结构、构图和视觉风格”。
- 日志从“主图参考设计”改成“参考设计”。
- activeGenerationMode 只要 styleFiles.length > 0 就是 image-to-image。
- handlePromptPlanning() 对所有 imageType 上传 styleFiles，不再以 imageType === "main" 截断。
- 历史任务继续使用现有 styleImages 字段。

- [ ] **Step 5: 切换默认项并显示信息单元数**

GenerationPage.tsx 使用：

~~~typescript
const defaultVisualTemplateIds: Record<TemplatedImageType, string> = {
  set: "dense_product_set",
  listing: "dense_product_listing",
};
~~~

PromptReviewPanel 在单张标题下显示“X 个信息单元 · Y 条画面文案”；没有新字段时不显示，保持旧响应兼容。

- [ ] **Step 6: 跑前端定向测试与类型检查**

Run:

~~~bash
npm run test:run -- src/features/generation/components/VisualTemplatePicker.test.tsx src/features/generation/GenerationPage.test.tsx
npm run lint
~~~

Expected: PASS，TypeScript exit 0。

---

### Task 4: 让个人模板配方真正进入后端生成

**Files:**
- Modify: src/features/tasks/types.ts
- Modify: src/features/generation/personalTemplateRepository.ts
- Create: src/features/generation/personalTemplateRepository.test.ts
- Modify: src/features/generation/components/VisualTemplatePicker.tsx
- Modify: src/features/generation/components/VisualTemplatePicker.test.tsx
- Modify: src/features/generation/api.test.ts only if fixtures require the optional field
- Modify: backend/tests/test_orchestrator.py only if Task 1 did not cover end-to-end custom recipe

**Interfaces:**
- Produces: 前端 LayoutRecipeId 和 CustomVisualRoleSelection.layout_recipe_id?: LayoutRecipeId。
- Preserves: 没有 layout_recipe_id 的旧 LocalStorage v1 记录继续可读。

- [ ] **Step 1: 写红灯测试**

覆盖交互：打开自定义套图第 2 张“结构细节”→生成 mock→采用→保存；断言 LocalStorage customRoles[1].layout_recipe_id === "detail_callouts"。从“自定义”分类重新打开并使用，断言 onCustomRolesChange 收到同一 ID。

在 personalTemplateRepository.test.ts 增加测试：旧记录没有该字段仍返回；未知 ID 的记录被过滤，不能进入请求。

- [ ] **Step 2: 验证测试先失败**

Run:

~~~bash
npm run test:run -- src/features/generation/components/VisualTemplatePicker.test.tsx
~~~

Expected: FAIL，当前保存职责丢失配方。

- [ ] **Step 3: 绑定固定配方**

导出只读 LAYOUT_RECIPE_IDS。CUSTOM_PREVIEW_SLOTS 八张依次绑定：

~~~typescript
[
  "commercial_overview",
  "detail_callouts",
  "benefit_evidence",
  "craft_options",
  "variant_matrix",
  "application_matrix",
  "quality_proof",
  "packaging_trade",
]
~~~

用户采用候选图时，先同步计算 nextRoles，把 draftCustomRoles[targetSlotIndex].layout_recipe_id 写入这个新数组，再同时用 nextRoles 更新 state、onCustomRolesChange 和后续保存依据；不能依赖 React 异步 state 立即读回，也不能把编辑框自由文本当成后端构图规则。保存、重新打开、确认和 GenerationPage 请求继续沿用 custom_visual_roles 通路。

isCustomRoleSelection() 接受缺字段的旧记录；字段存在时必须属于 LAYOUT_RECIPE_IDS。

- [ ] **Step 4: 跑前后端配方测试**

Run:

~~~bash
npm run test:run -- src/features/generation/components/VisualTemplatePicker.test.tsx src/features/generation/personalTemplateRepository.test.ts src/features/generation/api.test.ts
env PYTHONPATH=. .venv/bin/pytest backend/tests/test_templates.py backend/tests/test_orchestrator.py -q
~~~

Expected: PASS，未知前端或后端 recipe ID 都被拒绝。

---

### Task 5: 文档、全量验证和交付证据

**Files:**
- Modify: CONTEXT.md
- Modify: DEV_LOG.md

**Interfaces:**
- Documents: 模板 ID、密度阈值、八个 recipe ID、硬信息边界、风格参考隔离、个人模板回传。
- Verifies: 全量测试、类型检查和生产构建。

- [ ] **Step 1: 更新文档**

CONTEXT.md 补充：

- dense_product_set / dense_product_listing 是套图和详情图默认高信息量模板。
- density_profile 与 information_units 的职责。
- 八个 layout_recipe_id 只由服务器注册，个人模板仅保存 ID。
- 风格参考适用于全部真实生图类型，但不进入商品分析。
- 当前文字仍由图片模型生成，精确叠字属于后续阶段，不能声称已完成。

DEV_LOG.md 增加“2026-07-23：高信息密度商品信息图模板”，记录实现和真实验证命令，不改写历史。

- [ ] **Step 2: 运行全部验证**

Run:

~~~bash
npm run test:run
env PYTHONPATH=. .venv/bin/pytest backend/tests -q
npm run lint
npm run build
~~~

Expected:

- Vitest 全部通过，测试数高于基线 57。
- pytest 全部通过，测试数高于基线 58；仅允许既有 StarletteDeprecationWarning。
- lint 和 build exit 0。

- [ ] **Step 3: 自检范围和安全**

Run:

~~~bash
git status --short
git diff --check
rg -n "TBD|TODO|implement later" backend src -g '!backend/tests/**' -g '!*.test.ts' -g '!*.test.tsx'
~~~

Expected: diff check exit 0；生产代码没有自由构图注入、占位文本或敏感信息；不暂存、不提交现有用户改动。

---

## Self-Review

- Spec coverage: 九套高密度模板、9–12 单元契约、四个以上图文解说模块、安全文案、风格参考、个人配方回传、62 张独立预览与文档均有任务。
- Placeholder scan: 没有未完成占位项或未定义接口。
- Type consistency: 前后端统一 layout_recipe_id、density_profile、information_units；八个 recipe ID 只有一套固定拼写。
- Scope: 本轮不新增图像后处理依赖，不宣称解决图片模型文字准确率，只完成可执行模板与结构化准备。
