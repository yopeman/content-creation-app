from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field, EmailStr
from app.models.enums import UserStatus


class User(Document):
    name: str
    email: Indexed(EmailStr, unique=True)
    password_hash: Optional[str] = None
    timezone: str = "UTC"
    status: UserStatus = UserStatus.ACTIVE
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "users"
