"""批图匠后端共享的领域模型与业务异常。

本模块只描述“数据长什么样”和“业务错误是什么”，不包含网络调用。
这样模板、Prompt 规划、模型适配器和 API 路由可以使用同一套类型，避免字段漂移。
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator


ImageMode = Literal["text-to-image", "image-to-image"]
ImageType = Literal["main", "set", "listing", "poster"]
ImageModel = Literal["nano_banana_2", "nano_banana_pro", "gpt_image_2_openrouter"]
Resolution = Literal["512", "1K", "2K", "4K"]
Quality = Literal["low", "medium", "high"]


# 这些比例直接对应各模型官方能力，而不是前端自行拼出的公共交集：
# - Gemini 3.1 Flash Image（Nano Banana 2）支持 14 种比例；
# - Gemini 3 Pro Image（Nano Banana Pro）支持其中 10 种常规比例；
# - GPT-Image-2 原生 API 支持长短边不超过 3:1 的灵活尺寸。OpenRouter 当前
#   专用端点尚未开放 size/aspect_ratio，因此这里只登记常用且符合原生限制的
#   下拉预设，Adapter 继续把比例作为构图约束写入 Prompt。
MODEL_ASPECT_RATIOS: dict[ImageModel, tuple[str, ...]] = {
    "nano_banana_2": (
        "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1",
        "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
    ),
    "nano_banana_pro": (
        "1:1", "2:3", "3:2", "3:4", "4:3",
        "4:5", "5:4", "9:16", "16:9", "21:9",
    ),
    "gpt_image_2_openrouter": (
        "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4",
        "9:16", "16:9", "1:2", "2:1", "9:21", "21:9", "1:3", "3:1",
    ),
}

MODEL_RESOLUTIONS: dict[ImageModel, tuple[Resolution, ...]] = {
    "nano_banana_2": ("512", "1K", "2K", "4K"),
    "nano_banana_pro": ("1K", "2K", "4K"),
    # OpenRouter 用 low/medium/high 控制质量，前端继续用 1K/2K/4K 保存档位意图。
    "gpt_image_2_openrouter": ("1K", "2K", "4K"),
}


class UnsupportedTemplateError(ValueError):
    """表示调用方传入了服务器未登记的模板。"""


class UnsupportedCapabilityError(ValueError):
    """表示模型不支持请求中的比例、分辨率或编辑能力。"""


class PromptPlanError(RuntimeError):
    """表示文本模型没有返回可执行的结构化生图计划。"""


class ProviderError(RuntimeError):
    """表示图片供应商调用失败。

    Args:
        message: 便于开发者排查的错误说明，不应包含密钥。
        status_code: 上游 HTTP 状态码；没有 HTTP 响应时为 ``None``。
        retryable: 当前错误是否适合自动重试。
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        retryable: bool = False,
        retry_after_seconds: float | None = None,
    ) -> None:
        """保存脱敏错误信息及重试属性。

        Args:
            message: 脱敏后的错误信息。
            status_code: 可选的上游 HTTP 状态码。
            retryable: 是否允许编排器重试。
            retry_after_seconds: 上游建议等待的秒数；没有建议时为 ``None``。

        Returns:
            无。

        Raises:
            不主动抛出异常。
        """

        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable
        self.retry_after_seconds = retry_after_seconds


class ReferenceAsset(BaseModel):
    """已经上传到受控对象存储的参考图。"""

    url: HttpUrl
    mime_type: Literal["image/png", "image/jpeg", "image/webp"]
    filename: str = Field(min_length=1, max_length=255)


LogoPosition = Literal[
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
    "center",
]


class BinaryAsset(BaseModel):
    """下载后可直接发送给图片模型的二进制图片。"""

    data: bytes
    mime_type: Literal["image/png", "image/jpeg", "image/webp"]
    name: str = "reference-image"


class TemplateSlot(BaseModel):
    """一套图片中的单个固定职责槽位。"""

    index: int = Field(ge=1)
    role: str = Field(min_length=1)
    title: str = Field(min_length=1)
    objective: str = Field(min_length=1)
    composition: str = Field(min_length=1)
    text_policy: str = Field(min_length=1)


class TemplateDefinition(BaseModel):
    """由服务器维护的图片类型模板。"""

    id: str
    image_type: ImageType
    name: str
    slots: list[TemplateSlot] = Field(min_length=1)


class VisualTemplateField(BaseModel):
    """视觉模板可向用户收集的一条选填信息。"""

    key: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=40)
    placeholder: str = Field(default="", max_length=160)
    required: bool = False


class VisualTemplateDefinition(BaseModel):
    """控制整套图片风格和信息密度的视觉模板。"""

    id: str = Field(min_length=1, max_length=64)
    # 同一个视觉模板只能出现在适合的业务类型中。例如详情图模板不能混入
    # 六张套图选择器，否则 Planner 会收到错误数量的职责定义。
    image_types: list[ImageType] = Field(min_length=1, max_length=4)
    name: str = Field(min_length=1, max_length=40)
    category: str = Field(min_length=1, max_length=24)
    description: str = Field(min_length=1, max_length=160)
    art_direction: str = Field(min_length=1, max_length=600)
    information_focus: list[str] = Field(default_factory=list, max_length=12)
    # B2B 详情页当前以八张图覆盖产品、使用、品质与合作链路；保留到 12
    # 的结构余量，方便以后增加行业专属角色，而不改变现有模板的默认数量。
    role_highlights: list[str] = Field(default_factory=list, max_length=12)
    role_compositions: list[str] = Field(default_factory=list, max_length=12)
    generated_anchor_strategy: Literal["reuse", "independent"] = "reuse"
    preview_images: list[str] = Field(default_factory=list, max_length=12)
    fields: list[VisualTemplateField] = Field(default_factory=list, max_length=16)


class CustomVisualRoleSelection(BaseModel):
    """用户从同类预设模板中挑选的一条图片职责。

    只保存来源模板和职责下标，不允许前端直接提交任意 Prompt。后端会根据
    已登记模板重新读取标题、构图、预览图和选填字段，避免跨类型混用或注入。
    """

    template_id: str = Field(min_length=1, max_length=64)
    role_index: int = Field(ge=0, le=11)


class ProductContext(BaseModel):
    """Prompt Planner 对商品和视觉约束的统一理解。"""

    product_name: str
    product_description: str
    selling_points: list[str] = Field(default_factory=list)
    visual_style: str
    must_keep: list[str] = Field(default_factory=list)
    prohibited_claims: list[str] = Field(default_factory=list)


class ImagePrompt(BaseModel):
    """单个模板槽位对应的生图提示词。"""

    index: int = Field(ge=1)
    role: str
    title: str = ""
    prompt: str = Field(min_length=1)
    negative_prompt: str = ""
    visible_text: list[str] = Field(default_factory=list)


class PromptPlan(BaseModel):
    """一整版图片的结构化 Prompt 计划。"""

    global_consistency_prompt: str = Field(min_length=1)
    image_prompts: list[ImagePrompt] = Field(min_length=1)


class ImageSpec(BaseModel):
    """与具体供应商无关的单张图片生成规格。"""

    model: ImageModel
    aspect_ratio: str
    resolution: Resolution
    quality: Quality | None = None


class GeneratedBinary(BaseModel):
    """供应商返回并已解码的图片。"""

    data: bytes
    mime_type: str = "image/png"
    provider_request_id: str | None = None
    actual_width: int | None = None
    actual_height: int | None = None


class GenerationRequest(BaseModel):
    """前端提交的一次完整生图任务。"""

    # mode 保留在领域对象中，供 Planner、编排器和历史事件读取；调用方无需决定。
    # 默认值同时兼容旧客户端生成的 OpenAPI SDK，真正值会在下方校验器中按参考图覆盖。
    mode: ImageMode = "text-to-image"
    image_type: ImageType
    template_id: str
    visual_template_id: str = "standard_product"
    model: ImageModel
    aspect_ratio: str
    resolution: Resolution
    quality: Quality | None = None
    language: str = "zh-CN"
    variant_count: int = Field(default=1, ge=1, le=10)
    user_requirement: str = Field(min_length=1, max_length=4000)
    supplemental_info: dict[str, str] = Field(default_factory=dict)
    # 自定义模板只提交“来源模板 + 职责下标”。真实标题和构图由服务器登记表恢复，
    # 因而前端不能借此把任意文字注入视觉模板定义。
    custom_visual_roles: list[CustomVisualRoleSelection] = Field(
        default_factory=list,
        max_length=12,
    )
    # 参考设计图只负责构图与风格，不参与商品主体分析。
    style_reference_assets: list[ReferenceAsset] = Field(default_factory=list, max_length=3)
    # 用户自己的产品素材决定商品真实外观与结构。
    reference_assets: list[ReferenceAsset] = Field(default_factory=list, max_length=10)
    # Logo 与商品参考图分开，避免 Planner 把纯品牌图形当成商品主体。
    logo_asset: ReferenceAsset | None = None
    logo_position: LogoPosition = "bottom-right"

    @field_validator("supplemental_info")
    @classmethod
    def validate_supplemental_info(cls, value: dict[str, str]) -> dict[str, str]:
        """限制选填信息的数量和长度，避免把任意大对象送进 Prompt。

        Args:
            value: 前端提交的模板补充信息键值对。

        Returns:
            去除首尾空白、保留空值语义的安全字典。

        Raises:
            ValueError: 字段过多、键过长或单项内容过长时抛出。
        """

        if len(value) > 20:
            raise ValueError("模板补充信息最多 20 项")
        normalized: dict[str, str] = {}
        for key, item in value.items():
            clean_key = key.strip()
            clean_value = item.strip()
            if not clean_key or len(clean_key) > 64:
                raise ValueError("模板补充信息字段名无效")
            if len(clean_value) > 500:
                raise ValueError(f"模板补充信息 {clean_key} 最多 500 字")
            normalized[clean_key] = clean_value
        return normalized

    @field_validator("custom_visual_roles")
    @classmethod
    def validate_custom_visual_roles(
        cls,
        value: list[CustomVisualRoleSelection],
    ) -> list[CustomVisualRoleSelection]:
        """拒绝重复职责，保证用户选择顺序可以稳定映射到生成槽位。

        Args:
            value: 前端按最终顺序提交的职责来源列表。

        Returns:
            原顺序不变的职责列表。

        Raises:
            ValueError: 同一模板的同一职责被重复选择时抛出。
        """

        role_keys = [(item.template_id, item.role_index) for item in value]
        if len(role_keys) != len(set(role_keys)):
            raise ValueError("自定义模板不能重复选择同一职责")
        return value

    @model_validator(mode="before")
    @classmethod
    def infer_reference_mode(cls, value: Any) -> Any:
        """根据设计参考图、产品素材或 Logo 是否存在自动确定生图模式。

        Args:
            value: Pydantic 尚未构造模型前收到的原始请求对象。

        Returns:
            写入正确 ``mode`` 的请求副本；非字典输入原样交回 Pydantic 处理。

        Raises:
            不主动抛出异常；字段类型和参考图结构仍由 Pydantic 正常校验。
        """

        if not isinstance(value, dict):
            return value

        normalized = dict(value)
        # 旧版浏览器历史任务和旧客户端可能仍提交 Azure 内部模型名。这个映射
        # 只负责无损迁移，不会保留或调用任何 Azure 配置与请求路径。
        if normalized.get("model") == "gpt_image_2_azure":
            normalized["model"] = "gpt_image_2_openrouter"
        normalized["mode"] = (
            "image-to-image"
            if (
                normalized.get("style_reference_assets")
                or normalized.get("reference_assets")
                or normalized.get("logo_asset")
            )
            else "text-to-image"
        )
        return normalized

    @model_validator(mode="after")
    def validate_model_capabilities(self) -> GenerationRequest:
        """拒绝当前模型官方能力之外的比例或清晰度。

        Returns:
            已确认模型、比例和清晰度组合合法的请求本身。

        Raises:
            ValueError: 比例或清晰度不属于当前模型能力时抛出。
        """

        if self.aspect_ratio not in MODEL_ASPECT_RATIOS[self.model]:
            raise ValueError(f"{self.model} 不支持画面比例 {self.aspect_ratio}")
        if self.resolution not in MODEL_RESOLUTIONS[self.model]:
            raise ValueError(f"{self.model} 不支持清晰度 {self.resolution}")
        return self


class StreamEvent(BaseModel):
    """NDJSON 流中的一条可增量消费事件。"""

    type: str
    job_id: str
    variant_index: int | None = None
    image_index: int | None = None
    status: str | None = None
    message: str | None = None
    image_url: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
