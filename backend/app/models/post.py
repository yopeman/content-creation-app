from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from app.models.enums import PostStatus


class Post(Document):
    user_id: Indexed(PydanticObjectId)
    content_id: Indexed(PydanticObjectId)
    scheduled_at: Optional[datetime] = None
    status: PostStatus = PostStatus.DRAFT
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "posts"
