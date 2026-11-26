from datetime import datetime, timezone
from typing import Any, Dict, Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from app.models.enums import PlatformCode, PlatformStatus


class Platform(Document):
    user_id: Indexed(PydanticObjectId)
    code: PlatformCode
    account_name: Optional[str] = None          # e.g., "My Telegram Channel", "Business FB Page"
    platform_account_id: Optional[str] = None   # External Account / Channel / Page ID
    details: Dict[str, Any] = Field(default_factory=dict)  # Stored encrypted tokens, chat IDs, settings
    expires_at: Optional[datetime] = None
    status: PlatformStatus = PlatformStatus.CONNECTED
    last_error: Optional[str] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def get_decrypted_bot_token(self) -> Optional[str]:
        """Decrypts and returns the stored Telegram bot token for backend operations."""
        from app.core.config import settings
        from app.core.security import decrypt_secret

        if self.details.get("is_default_bot_token") and settings.default_tg_bot_token:
            return settings.default_tg_bot_token

        enc_token = self.details.get("encrypted_bot_token") or self.details.get("bot_token")
        if not enc_token:
            return settings.default_tg_bot_token
        try:
            return decrypt_secret(enc_token)
        except Exception:
            # Fallback to token as-is if already unencrypted/mock
            return enc_token or settings.default_tg_bot_token

    class Settings:
        name = "platforms"
