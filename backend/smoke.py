"""显式调用真实图片模型的收费 Smoke Test。

自动化测试永远不调用真实模型。只有开发者主动执行本模块并配置环境变量时，
才会产生一次真实图片请求和对应供应商费用。
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from .domain import ImageSpec
from .google_client import GoogleVertexClient
from .providers import AzureImageProvider, GoogleImageProvider, ImageProvider
from .settings import Settings


def _parser() -> argparse.ArgumentParser:
    """创建 Smoke Test 命令行解析器。

    Args:
        无。

    Returns:
        包含模型和输出路径参数的解析器。

    Raises:
        不抛出异常。
    """

    parser = argparse.ArgumentParser(
        description="显式调用一个真实生图模型并把结果保存到本地（会产生费用）",
    )
    parser.add_argument(
        "--model",
        required=True,
        choices=["nano_banana_2", "nano_banana_pro", "gpt_image_2_azure"],
        help="需要验证的真实图片模型",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="输出 PNG 路径；默认写入当前目录 smoke-模型名.png",
    )
    return parser


def _assert_configuration(settings: Settings, model: str) -> None:
    """在产生费用前检查当前模型所需环境变量。

    Args:
        settings: 当前环境配置。
        model: 命令行选择的统一模型名。

    Returns:
        无。

    Raises:
        RuntimeError: 当前模型缺少必要环境变量时抛出。
    """

    google_required = {
        "GOOGLE_CLOUD_PROJECT": settings.google_cloud_project,
        "GOOGLE_SERVICE_ACCOUNT_JSON": settings.google_service_account_json,
    }
    azure_required = {
        "AZURE_OPENAI_ENDPOINT": settings.azure_openai_endpoint,
        "AZURE_OPENAI_API_KEY": settings.azure_openai_api_key,
        "AZURE_GPT_IMAGE_2_DEPLOYMENT": settings.azure_gpt_image_2_deployment,
    }
    required = azure_required if model == "gpt_image_2_azure" else google_required
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(f"缺少环境变量：{', '.join(missing)}")


async def _provider(settings: Settings, model: str) -> ImageProvider:
    """根据模型名创建真实 Adapter。

    Args:
        settings: 已校验配置。
        model: 统一模型名。

    Returns:
        Google 或 Azure 图片 Adapter。

    Raises:
        ValueError: Google 服务账号 JSON 非法时抛出。
    """

    if model == "gpt_image_2_azure":
        return AzureImageProvider(
            endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            deployment=settings.azure_gpt_image_2_deployment,
        )
    google_client = GoogleVertexClient(
        project=settings.google_cloud_project,
        location=settings.google_cloud_location,
        service_account_json=settings.google_service_account_json,
    )
    return GoogleImageProvider(google_client)


async def run_smoke(model: str, output: Path) -> Path:
    """执行一次最小真实文生图并保存 PNG。

    Args:
        model: 需要验证的统一图片模型名。
        output: 本地输出文件路径。

    Returns:
        已写入图片的路径。

    Raises:
        RuntimeError: 环境变量缺失时抛出。
        ProviderError: 供应商请求失败或没有返回图片时抛出。
        OSError: 本地输出文件无法写入时抛出。
    """

    settings = Settings.from_env()
    _assert_configuration(settings, model)
    provider = await _provider(settings, model)
    result = await provider.generate(
        "A clean studio product photo of a matte white ceramic mug, centered, warm soft light, no text, no logo.",
        ImageSpec(
            model=model,  # type: ignore[arg-type] -- argparse 已限制为领域允许值。
            aspect_ratio="1:1",
            resolution="1K",
            quality="low" if model == "gpt_image_2_azure" else None,
        ),
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(result.data)
    return output


def main() -> None:
    """解析命令行并运行收费 Smoke Test。

    Args:
        无。

    Returns:
        无。

    Raises:
        argparse.ArgumentError: 参数非法时由 argparse 终止程序。
        RuntimeError: 配置缺失时向命令行明确报告。
        ProviderError: 真实供应商调用失败时透传，便于开发者排查。
        OSError: 输出图片写入失败时透传。
    """

    args = _parser().parse_args()
    output = args.output or Path(f"smoke-{args.model}.png")
    saved = asyncio.run(run_smoke(args.model, output))
    print(f"Smoke Test 成功，图片已保存：{saved.resolve()}")


if __name__ == "__main__":
    main()
