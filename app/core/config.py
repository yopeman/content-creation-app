from pathlib import Path
from typing import List
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

    # AI / LLM (Groq & LangChain)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    @property
    def upload_path(self) -> Path:
        path = self.BASE_DIR / self.UPLOAD_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
