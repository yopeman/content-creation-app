from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.enums import PlatformCode, PostStatus, PostTargetStatus


def ensure_utc_datetime(v: Optional[datetime]) -> Optional[datetime]:
    """Ensures datetime is timezone-aware and normalized to UTC."""
    if v is None:
        return None
    if v.tzinfo is None:
        return v.replace(tzinfo=timezone.utc)
    return v.astimezone(timezone.utc)


class PostTargetBase(BaseModel):
    platform_id: PydanticObjectId
    platform_code: PlatformCode
    scheduled_at: Optional[datetime] = None
    payload_override: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("scheduled_at", mode="after")
    @classmethod
    def validate_scheduled_at(cls, v: Optional[datetime]) -> Optional[datetime]:
        return ensure_utc_datetime(v)


class PostTargetCreate(PostTargetBase):
    status: Optional[str] = None


class PostTargetResponse(PostTargetBase):
    id: PydanticObjectId = Field(alias="_id")
    post_id: PydanticObjectId
    user_id: PydanticObjectId
    status: PostTargetStatus
    attempts: int
    next_attempt_at: Optional[datetime] = None
    error: Optional[str] = None
    external_post_id: Optional[str] = None
    external_url: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("scheduled_at", "next_attempt_at", "published_at", "created_at", "updated_at", mode="after")
    @classmethod
    def validate_datetimes(cls, v: Optional[datetime]) -> Optional[datetime]:
        return ensure_utc_datetime(v)


class PostCreate(BaseModel):
    content_id: PydanticObjectId
    scheduled_at: Optional[datetime] = None
    status: Optional[PostStatus] = None
    targets: List[PostTargetCreate] = Field(default_factory=list)

    @field_validator("scheduled_at", mode="after")
    @classmethod
    def validate_scheduled_at(cls, v: Optional[datetime]) -> Optional[datetime]:
        return ensure_utc_datetime(v)


class PostReschedule(BaseModel):
    scheduled_at: datetime

    @field_validator("scheduled_at", mode="after")
    @classmethod
    def validate_scheduled_at(cls, v: Optional[datetime]) -> Optional[datetime]:
        return ensure_utc_datetime(v)


class PostResponse(BaseModel):
    id: PydanticObjectId = Field(alias="_id")
    user_id: PydanticObjectId
    content_id: PydanticObjectId
    scheduled_at: Optional[datetime] = None
    status: PostStatus
    targets: List[PostTargetResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("scheduled_at", "created_at", "updated_at", mode="after")
    @classmethod
    def validate_datetimes(cls, v: Optional[datetime]) -> Optional[datetime]:
        return ensure_utc_datetime(v)
