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
    details: Dict[str, Any] = Field(default_factory=dict)  # OAuth tokens, scopes, secrets
    expires_at: Optional[datetime] = None
    status: PlatformStatus = PlatformStatus.CONNECTED
    last_error: Optional[str] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "platforms"
