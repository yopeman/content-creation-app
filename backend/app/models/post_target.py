from datetime import datetime, timezone
from typing import Any, Dict, Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from app.models.enums import PlatformCode, PostTargetStatus


class PostTarget(Document):
    post_id: Indexed(PydanticObjectId)
    user_id: Indexed(PydanticObjectId)
    platform_id: Indexed(PydanticObjectId)
    platform_code: PlatformCode
    scheduled_at: Optional[datetime] = None
    status: PostTargetStatus = PostTargetStatus.PENDING
    attempts: int = 0
    next_attempt_at: Optional[datetime] = None
    error: Optional[str] = None
    external_post_id: Optional[str] = None
    external_url: Optional[str] = None
    payload_override: Dict[str, Any] = Field(default_factory=dict)
    published_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "post_targets"
