"""只从服务器环境变量读取运行配置。"""

from __future__ import annotations

import os
from dataclasses import dataclass


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
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_gpt_image_2_deployment: str = ""
    azure_openai_edit_api_version: str = "2025-04-01"
    blob_read_write_token: str = ""
    blob_allowed_host: str = ""
    allowed_origins: tuple[str, ...] = ("http://localhost:5173",)

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

        origins = tuple(
            origin.strip()
            for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
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
            azure_openai_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", "").strip().rstrip("/"),
            azure_openai_api_key=os.getenv("AZURE_OPENAI_API_KEY", "").strip(),
            azure_gpt_image_2_deployment=os.getenv(
                "AZURE_GPT_IMAGE_2_DEPLOYMENT", ""
            ).strip(),
            azure_openai_edit_api_version=os.getenv(
                "AZURE_OPENAI_EDIT_API_VERSION", "2025-04-01"
            ).strip()
            or "2025-04-01",
            blob_read_write_token=os.getenv("BLOB_READ_WRITE_TOKEN", "").strip(),
            blob_allowed_host=os.getenv("BLOB_ALLOWED_HOST", "").strip().lower(),
            allowed_origins=origins,
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
            "AZURE_OPENAI_ENDPOINT": self.azure_openai_endpoint,
            "AZURE_OPENAI_API_KEY": self.azure_openai_api_key,
            "AZURE_GPT_IMAGE_2_DEPLOYMENT": self.azure_gpt_image_2_deployment,
            "BLOB_READ_WRITE_TOKEN": self.blob_read_write_token,
            "BLOB_ALLOWED_HOST": self.blob_allowed_host,
        }
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
        }

