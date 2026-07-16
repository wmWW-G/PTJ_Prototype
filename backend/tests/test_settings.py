"""环境变量配置测试。"""

from backend.settings import Settings


def test_missing_credentials_are_reported_without_secret_values(monkeypatch) -> None:
    """健康状态应报告缺项，但绝不能回显密钥值。"""

    names = [
        "GOOGLE_CLOUD_PROJECT",
        "GOOGLE_SERVICE_ACCOUNT_JSON",
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_API_KEY",
        "AZURE_GPT_IMAGE_2_DEPLOYMENT",
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
    """没有覆盖时使用已经确认的 Google 模型和 global 区域。"""

    monkeypatch.delenv("GOOGLE_CLOUD_LOCATION", raising=False)
    monkeypatch.delenv("GOOGLE_PROMPT_PLANNER_MODEL", raising=False)

    settings = Settings.from_env()

    assert settings.google_cloud_location == "global"
    assert settings.google_prompt_planner_model == "gemini-3.5-flash"

