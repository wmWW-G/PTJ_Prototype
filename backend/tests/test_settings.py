"""环境变量配置测试。"""

from backend.settings import Settings


def test_missing_credentials_are_reported_without_secret_values(monkeypatch) -> None:
    """健康状态应报告缺项，但绝不能回显密钥值。"""

    names = [
        "GOOGLE_CLOUD_PROJECT",
        "GOOGLE_SERVICE_ACCOUNT_JSON",
        "OPENROUTER_API_KEY",
        "OPENROUTER_BASE_URL",
        "OPENROUTER_GPT_IMAGE_2_MODEL",
        "BLOB_READ_WRITE_TOKEN",
        "BLOB_ALLOWED_HOST",
    ]
    for name in names:
        monkeypatch.delenv(name, raising=False)

    settings = Settings.from_env()

    assert "GOOGLE_SERVICE_ACCOUNT_JSON" in settings.missing_configuration()
    assert settings.safe_status()["configured"] is False
    assert "secret" not in str(settings.safe_status()).lower()


def test_default_models_and_location_are_stable(monkeypatch) -> None:
    """没有覆盖时使用已确认的 Google/OpenRouter 模型与 global 区域。"""

    monkeypatch.delenv("GOOGLE_CLOUD_LOCATION", raising=False)
    monkeypatch.delenv("GOOGLE_PROMPT_PLANNER_MODEL", raising=False)
    monkeypatch.delenv("OPENROUTER_BASE_URL", raising=False)
    monkeypatch.delenv("OPENROUTER_GPT_IMAGE_2_MODEL", raising=False)

    settings = Settings.from_env()

    assert settings.google_cloud_location == "global"
    assert settings.google_prompt_planner_model == "gemini-3.5-flash"
    assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"
    assert settings.openrouter_gpt_image_2_model == "openai/gpt-image-2"


def test_provider_specific_configuration_does_not_block_google_models() -> None:
    """未配置 OpenRouter 时，两个 Google 模型仍应允许执行。"""

    settings = Settings(
        google_cloud_project="project",
        google_service_account_json="{}",
        blob_read_write_token="blob-token",
        blob_allowed_host="blob.example",
    )

    assert settings.missing_for_model("nano_banana_2") == []
    assert settings.missing_for_model("nano_banana_pro") == []
    assert settings.missing_for_model("gpt_image_2_openrouter") == [
        "OPENROUTER_API_KEY"
    ]


def test_default_cors_allows_both_localhost_spellings(monkeypatch) -> None:
    """本地浏览器使用 localhost 或 127.0.0.1 都应能读取 API。"""

    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    settings = Settings.from_env()

    assert "http://localhost:5173" in settings.allowed_origins
    assert "http://127.0.0.1:5173" in settings.allowed_origins
    assert settings.allowed_origin_regex
