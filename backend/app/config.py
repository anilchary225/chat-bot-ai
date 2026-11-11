from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    mongodb_uri: str
    mongodb_database: str = "vac_ai_chat"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openrouter/free"
    openrouter_api_key: str | None = None
    frontend_origin: str = "http://localhost:5173"
    tavily_api_key: str | None = None
    web_search_max_results: int = 5
    doc_context_chars: int = 24000
    public_frontend_url: str = "https://zenoxi.vercel.app"
    graph_api_version: str = "v23.0"
    meta_verify_token: str | None = None
    meta_app_secret: str | None = None
    whatsapp_access_token: str | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_display_number: str | None = None
    instagram_access_token: str | None = None
    instagram_app_secret: str | None = None
    instagram_username: str | None = None
    auth_secret: str | None = None
    google_client_id: str | None = None
    brevo_api_key: str | None = None
    mail_from: str | None = None
    mail_from_name: str = "Zenoxi"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
