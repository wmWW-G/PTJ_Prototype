"""只从服务器环境变量读取运行配置。"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .domain import ImageModel


@dataclass(frozen=True, slots=True)
class Settings:
    """批图匠后端运行配置。

    字段可以为空，便于 `/api/health` 在未配置密钥时正常启动并报告缺项；
    真正开始生图前再由应用层阻止请求。
    """

    google_cloud_project: str = ""
    google_cloud_location: str = "global"
    google_service_account_json: str = ""
    google_prompt_planner_model: str = "gemini-3.5-flash"
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_gpt_image_2_model: str = "openai/gpt-image-2"
    openrouter_site_url: str = ""
    openrouter_app_name: str = "PTJ Prototype"
    blob_read_write_token: str = ""
    blob_allowed_host: str = ""
    allowed_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )
    # Vite 在默认端口被占用时会自动顺延。仅放行本机回环地址的任意端口，
    # 既避免 5174、5175 等开发端口全部报 ``Failed to fetch``，也不会把
    # 生产 API 的跨域权限扩大到其他公网域名。
    allowed_origin_regex: str = r"^http://(?:localhost|127\.0\.0\.1):\d+$"

    @classmethod
    def from_env(cls) -> "Settings":
        """从当前进程环境创建配置。

        Args:
            无。

        Returns:
            配置快照。后续环境变化不会修改已创建对象。

        Raises:
            不主动抛出异常；缺失配置由 ``missing_configuration`` 报告。
        """

        default_origins = "http://localhost:5173,http://127.0.0.1:5173"
        origins = tuple(
            origin.strip()
            for origin in os.getenv("ALLOWED_ORIGINS", default_origins).split(",")
            if origin.strip()
        )
        return cls(
            google_cloud_project=os.getenv("GOOGLE_CLOUD_PROJECT", "").strip(),
            google_cloud_location=os.getenv("GOOGLE_CLOUD_LOCATION", "global").strip() or "global",
            google_service_account_json=os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip(),
            google_prompt_planner_model=os.getenv(
                "GOOGLE_PROMPT_PLANNER_MODEL", "gemini-3.5-flash"
            ).strip()
            or "gemini-3.5-flash",
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY", "").strip(),
            openrouter_base_url=os.getenv(
                "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
            ).strip().rstrip("/")
            or "https://openrouter.ai/api/v1",
            openrouter_gpt_image_2_model=os.getenv(
                "OPENROUTER_GPT_IMAGE_2_MODEL", "openai/gpt-image-2"
            ).strip()
            or "openai/gpt-image-2",
            openrouter_site_url=os.getenv("OPENROUTER_SITE_URL", "").strip(),
            openrouter_app_name=os.getenv(
                "OPENROUTER_APP_NAME", "PTJ Prototype"
            ).strip()
            or "PTJ Prototype",
            blob_read_write_token=os.getenv("BLOB_READ_WRITE_TOKEN", "").strip(),
            blob_allowed_host=os.getenv("BLOB_ALLOWED_HOST", "").strip().lower(),
            allowed_origins=origins,
            allowed_origin_regex=os.getenv(
                "ALLOWED_ORIGIN_REGEX",
                r"^http://(?:localhost|127\.0\.0\.1):\d+$",
            ).strip(),
        )

    def missing_configuration(self) -> list[str]:
        """列出启用完整真实生图所缺少的环境变量名。

        Args:
            无。

        Returns:
            缺失变量名列表；只包含名称，不包含任何值。

        Raises:
            不抛出异常。
        """

        required = {
            "GOOGLE_CLOUD_PROJECT": self.google_cloud_project,
            "GOOGLE_SERVICE_ACCOUNT_JSON": self.google_service_account_json,
            "OPENROUTER_API_KEY": self.openrouter_api_key,
            "BLOB_READ_WRITE_TOKEN": self.blob_read_write_token,
            "BLOB_ALLOWED_HOST": self.blob_allowed_host,
        }
        return [name for name, value in required.items() if not value]

    def missing_for_model(self, model: "ImageModel") -> list[str]:
        """只检查执行当前模型必需的配置。

        所有任务都使用 Google Prompt Planner 和 Blob 存储；只有 GPT-Image-2
        额外依赖 OpenRouter Key。这样单个供应商暂未配置时，不会连带阻断其他
        已配置模型的真实生成。

        Args:
            model: 当前请求选择的图片模型。

        Returns:
            当前模型缺少的环境变量名，不包含任何变量值。

        Raises:
            不主动抛出异常。
        """

        required = {
            "GOOGLE_CLOUD_PROJECT": self.google_cloud_project,
            "GOOGLE_SERVICE_ACCOUNT_JSON": self.google_service_account_json,
            "BLOB_READ_WRITE_TOKEN": self.blob_read_write_token,
            "BLOB_ALLOWED_HOST": self.blob_allowed_host,
        }
        if model == "gpt_image_2_openrouter":
            required["OPENROUTER_API_KEY"] = self.openrouter_api_key
        return [name for name, value in required.items() if not value]

    def safe_status(self) -> dict[str, object]:
        """生成可公开给健康检查的脱敏状态。

        Args:
            无。

        Returns:
            仅包含是否完成配置、缺项名称和非敏感模型信息的字典。

        Raises:
            不抛出异常。
        """

        missing = self.missing_configuration()
        return {
            "configured": not missing,
            "missing": missing,
            "planner_model": self.google_prompt_planner_model,
            "google_location": self.google_cloud_location,
            "openrouter_image_model": self.openrouter_gpt_image_2_model,
        }
