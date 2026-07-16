"""商品理解与结构化生图 Prompt 规划。"""

from __future__ import annotations

import json
from typing import Any, Protocol, Sequence

from pydantic import ValidationError

from .domain import (
    BinaryAsset,
    ImageModel,
    ProductContext,
    PromptPlan,
    PromptPlanError,
    TemplateDefinition,
)


class GenerateContentClient(Protocol):
    """Planner 所需的最小 Google 客户端接口。"""

    async def generate_content(self, model: str, payload: dict[str, Any]) -> dict[str, Any]:
        """调用文本模型并返回响应 JSON。"""


def _extract_text(response: dict[str, Any]) -> str:
    """从 Gemini 响应中提取第一段非空文本。

    Args:
        response: Vertex generateContent 返回对象。

    Returns:
        第一段文本内容。

    Raises:
        PromptPlanError: 响应结构中没有文本时抛出。
    """

    for candidate in response.get("candidates", []):
        for part in candidate.get("content", {}).get("parts", []):
            if isinstance(part.get("text"), str) and part["text"].strip():
                return part["text"]
    raise PromptPlanError("Prompt Planner 没有返回文本")


def _decode_json_object(text: str) -> dict[str, Any]:
    """从 Gemini 文本中解码一个 JSON 对象，并容忍 Markdown 代码围栏。

    即使请求指定了 ``application/json``，模型偶发仍会输出
    `````json ... ``` ``。先尝试完整 JSON，再扫描文本中的首个可解析对象；
    只接受字典，避免把数组或普通值误当成业务结构。

    Args:
        text: Gemini 返回的文本内容。

    Returns:
        解码后的 JSON 对象。

    Raises:
        ValueError: 没有找到合法 JSON 对象时抛出。
    """

    cleaned = text.strip()
    if cleaned.startswith("```"):
        first_newline = cleaned.find("\n")
        if first_newline >= 0:
            cleaned = cleaned[first_newline + 1 :]
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3].rstrip()

    decoder = json.JSONDecoder()
    candidate_offsets = [0]
    candidate_offsets.extend(
        index for index, character in enumerate(cleaned) if character == "{" and index != 0
    )
    for offset in candidate_offsets:
        try:
            value, _end = decoder.raw_decode(cleaned[offset:])
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    raise ValueError("模型文本中没有合法 JSON 对象")


class PromptPlanner:
    """使用一个结构化文本模型完成商品分析和每版 Prompt 规划。"""

    def __init__(self, *, client: GenerateContentClient, model: str) -> None:
        """注入 Google 客户端和文本模型 ID。

        Args:
            client: 支持 generateContent 的客户端。
            model: 例如 ``gemini-3.5-flash`` 的文本模型 ID。

        Returns:
            无。

        Raises:
            不主动抛出异常。
        """

        self._client = client
        self._model = model

    async def analyze_product(
        self,
        *,
        user_requirement: str,
        references: Sequence[BinaryAsset] = (),
        language: str = "zh-CN",
    ) -> ProductContext:
        """把用户描述和可选参考图分析成统一商品上下文。

        Args:
            user_requirement: 用户提供的商品、卖点和视觉要求。
            references: 可选的原始参考图片二进制。
            language: 输出语言，例如 ``zh-CN``。

        Returns:
            通过 Pydantic 校验的 ``ProductContext``。

        Raises:
            PromptPlanError: 模型无文本、JSON 非法或字段缺失时抛出。
            ProviderError: Google 请求失败时由底层透传。
        """

        parts: list[dict[str, Any]] = [
            {
                "text": (
                    "你是电商商品视觉分析师。只依据用户输入和图片提取事实，不得编造参数、"
                    "认证、销量、工厂能力或客户案例。输出严格 JSON，字段为 product_name、"
                    "product_description、selling_points、visual_style、must_keep、prohibited_claims。"
                    f"输出语言：{language}。用户要求：{user_requirement}"
                )
            }
        ]
        for reference in references:
            import base64

            parts.append(
                {
                    "inlineData": {
                        "mimeType": reference.mime_type,
                        "data": base64.b64encode(reference.data).decode("ascii"),
                    }
                }
            )
        for attempt in range(2):
            request_parts = list(parts)
            if attempt:
                # 只修改文字说明，参考图仍保持原顺序和原内容，避免第二次分析漂移。
                request_parts[0] = {
                    "text": (
                        f"{parts[0]['text']}\n上次结构错误。只输出一个合法 JSON 对象，"
                        "不要 Markdown、解释或代码围栏。"
                    )
                }
            response = await self._client.generate_content(
                self._model,
                {
                    "contents": [{"role": "user", "parts": request_parts}],
                    "generationConfig": {"responseMimeType": "application/json"},
                },
            )
            try:
                return ProductContext.model_validate(
                    _decode_json_object(_extract_text(response))
                )
            except (ValidationError, ValueError, PromptPlanError):
                continue
        raise PromptPlanError("商品分析连续两次未返回符合约定的 JSON")

    async def plan_variant(
        self,
        *,
        template: TemplateDefinition,
        context: ProductContext,
        user_requirement: str,
        language: str,
        target_model: ImageModel,
        variant_index: int,
    ) -> PromptPlan:
        """为一版图片生成严格匹配模板槽位的 Prompt 数组。

        Args:
            template: 服务器模板，是槽位数量和职责的唯一来源。
            context: 商品分析结果。
            user_requirement: 用户原始补充要求。
            language: 可见文案和说明语言。
            target_model: 最终图片模型，用于调整提示词表达方式。
            variant_index: 当前方案序号，用于让多方案保持差异。

        Returns:
            索引和数量均匹配模板的 ``PromptPlan``。

        Raises:
            PromptPlanError: 连续两次无法得到合法结构时抛出。
            ProviderError: Google 请求失败时由底层透传。
        """

        base_instruction = {
            "task": "生成可直接交给图片模型的电商生图计划",
            "rules": [
                "严格按 slots 顺序和数量输出 image_prompts",
                "保持商品外观、颜色、材质、Logo 和结构一致",
                "不得虚构参数、认证、销量、产能、客户或测试结果",
                "可见文字只能来自用户明确提供的内容",
                "每个 prompt 必须独立完整，并包含全局一致性要求",
            ],
            "variant_index": variant_index,
            "language": language,
            "target_model": target_model,
            "user_requirement": user_requirement,
            "product_context": context.model_dump(),
            "template": template.model_dump(),
            "output_schema": {
                "global_consistency_prompt": "string",
                "image_prompts": [
                    {
                        "index": "integer",
                        "role": "string",
                        "prompt": "string",
                        "negative_prompt": "string",
                        "visible_text": ["string"],
                    }
                ],
            },
        }

        for attempt in range(2):
            if attempt:
                base_instruction["repair"] = (
                    f"上次结构错误。必须恰好输出 {len(template.slots)} 条，索引从 1 连续递增。"
                )
            response = await self._client.generate_content(
                self._model,
                {
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {"text": json.dumps(base_instruction, ensure_ascii=False)}
                            ],
                        }
                    ],
                    "generationConfig": {"responseMimeType": "application/json"},
                },
            )
            try:
                plan = PromptPlan.model_validate(
                    _decode_json_object(_extract_text(response))
                )
            except (ValidationError, ValueError, PromptPlanError):
                continue
            expected_indices = list(range(1, len(template.slots) + 1))
            actual_indices = [item.index for item in plan.image_prompts]
            if actual_indices == expected_indices:
                return plan
        raise PromptPlanError(
            f"Prompt Planner 连续两次未返回 {len(template.slots)} 个连续槽位"
        )
