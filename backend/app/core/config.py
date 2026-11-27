import os
from pathlib import Path
from typing import Any, List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "Yope Content Creation API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Database
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "content_creation_db"

    # Local Storage for media files (images, audio, video)
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    UPLOAD_DIR: str = "uploads"

    # Security
    SECRET_KEY: str = "supersecretkeyforlocaldevelopmentonly"
    ENCRYPTION_KEY: Optional[str] = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ALGORITHM: str = "HS256"

    # Telegram
    DEFAULT_TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_BOT_TOKEN: Optional[str] = None

    # Integrations (for external project requests)
    INTEGRATION_API_KEY: str = "supersecretintegrationkeyforotherprojects"
    FRONTEND_URL: str = "http://localhost:3000"

    # AI / LLM (Groq & LangChain)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    # Vercel Cron Security
    CRON_SECRET: Optional[str] = None

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            clean = v.strip()
            if clean.startswith("[") and clean.endswith("]"):
                import json
                try:
                    return json.loads(clean)
                except Exception:
                    pass
            return [item.strip() for item in clean.split(",") if item.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    @property
    def default_tg_bot_token(self) -> Optional[str]:
        return self.DEFAULT_TELEGRAM_BOT_TOKEN or self.TELEGRAM_BOT_TOKEN

    @property
    def upload_path(self) -> Path:
        if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
            path = Path("/tmp") / self.UPLOAD_DIR
        else:
            path = self.BASE_DIR / self.UPLOAD_DIR
        try:
            path.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
        return path


settings = Settings()
