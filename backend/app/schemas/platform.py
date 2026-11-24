from datetime import datetime
from typing import Any, Dict, List, Optional
from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.enums import PlatformCode, PlatformStatus


class SupportedPlatform(BaseModel):
    code: PlatformCode
    name: str
    description: str
    is_supported: bool = True
    required_details: List[str] = Field(default_factory=list)


class TelegramPlatformCreate(BaseModel):
    bot_token: str = Field(..., description="Telegram Bot API token from @BotFather", min_length=10)
    chat_id: str = Field(..., description="Target Channel username (e.g. @mychannel) or numeric chat ID")


class TelegramPlatformUpdate(BaseModel):
    bot_token: Optional[str] = Field(None, description="Updated Telegram Bot API token", min_length=10)
    chat_id: Optional[str] = Field(None, description="Updated Target Channel username or numeric chat ID")


class PlatformBase(BaseModel):
    code: PlatformCode
    account_name: Optional[str] = None
    platform_account_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    expires_at: Optional[datetime] = None
    status: PlatformStatus = PlatformStatus.CONNECTED


class PlatformCreate(PlatformBase):
    pass


class PlatformUpdate(BaseModel):
    """General platform update schema (for general metadata, status, etc.)."""
    account_name: Optional[str] = None
    status: Optional[PlatformStatus] = None
    expires_at: Optional[datetime] = None


class PlatformResponse(PlatformBase):
    id: PydanticObjectId = Field(alias="_id")
    user_id: PydanticObjectId
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def sanitize_sensitive_details(cls, data: Any) -> Any:
        """Ensures secrets such as bot_token or encrypted_bot_token are NEVER returned in API responses."""
        sensitive_keys = {"bot_token", "encrypted_bot_token", "token", "secret", "password"}

        if isinstance(data, dict):
            clean = data.copy()
            if "details" in clean and isinstance(clean["details"], dict):
                clean["details"] = {k: v for k, v in clean["details"].items() if k not in sensitive_keys}
            return clean

        # Handle Beanie / ORM document instances
        if hasattr(data, "details") and isinstance(data.details, dict):
            clean_details = {k: v for k, v in data.details.items() if k not in sensitive_keys}
            return {
                "_id": getattr(data, "id", None),
                "user_id": getattr(data, "user_id", None),
                "code": getattr(data, "code", None),
                "account_name": getattr(data, "account_name", None),
                "platform_account_id": getattr(data, "platform_account_id", None),
                "details": clean_details,
                "status": getattr(data, "status", None),
                "last_error": getattr(data, "last_error", None),
                "expires_at": getattr(data, "expires_at", None),
                "created_at": getattr(data, "created_at", None),
                "updated_at": getattr(data, "updated_at", None),
            }

        return data
