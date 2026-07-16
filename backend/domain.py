"""批图匠后端共享的领域模型与业务异常。

本模块只描述“数据长什么样”和“业务错误是什么”，不包含网络调用。
这样模板、Prompt 规划、模型适配器和 API 路由可以使用同一套类型，避免字段漂移。
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator


ImageMode = Literal["text-to-image", "image-to-image"]
ImageType = Literal["main", "set", "listing", "poster"]
ImageModel = Literal["nano_banana_2", "nano_banana_pro", "gpt_image_2_azure"]
Resolution = Literal["1K", "2K", "4K"]
Quality = Literal["low", "medium", "high"]


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
    ) -> None:
        """保存脱敏错误信息及重试属性。

        Args:
            message: 脱敏后的错误信息。
            status_code: 可选的上游 HTTP 状态码。
            retryable: 是否允许编排器重试。

        Returns:
            无。

        Raises:
            不主动抛出异常。
        """

        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable


class ReferenceAsset(BaseModel):
    """已经上传到受控对象存储的参考图。"""

    url: HttpUrl
    mime_type: Literal["image/png", "image/jpeg", "image/webp"]
    filename: str = Field(min_length=1, max_length=255)


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
    prompt: str = Field(min_length=1)
    negative_prompt: str = ""
    visible_text: list[str] = Field(default_factory=list)


class PromptPlan(BaseModel):
    """一整版图片的结构化 Prompt 计划。"""

    global_consistency_prompt: str = Field(min_length=1)
    image_prompts: list[ImagePrompt] = Field(min_length=1)


class AzureSize(BaseModel):
    """Azure GPT-Image-2 接口使用的像素尺寸。"""

    width: int
    height: int

    @property
    def api_value(self) -> str:
        """返回 Azure API 接收的 ``宽x高`` 字符串。

        Args:
            无。

        Returns:
            例如 ``"1024x1024"`` 的尺寸字符串。

        Raises:
            不抛出异常。
        """

        return f"{self.width}x{self.height}"


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

    mode: ImageMode
    image_type: ImageType
    template_id: str
    model: ImageModel
    aspect_ratio: str
    resolution: Resolution
    quality: Quality | None = None
    language: str = "zh-CN"
    variant_count: int = Field(default=1, ge=1, le=4)
    user_requirement: str = Field(min_length=1, max_length=4000)
    reference_assets: list[ReferenceAsset] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def validate_reference_mode(self) -> "GenerationRequest":
        """确保图生图请求确实带有参考图。

        Args:
            无；Pydantic 会在模型构造后调用本方法。

        Returns:
            校验通过的请求对象本身。

        Raises:
            ValueError: 图生图没有参考图，或文生图错误携带参考图时抛出。
        """

        if self.mode == "image-to-image" and not self.reference_assets:
            raise ValueError("图生图模式至少需要一张参考图")
        if self.mode == "text-to-image" and self.reference_assets:
            raise ValueError("文生图模式不能携带参考图")
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
