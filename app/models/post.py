from datetime import datetime, timezone
from typing import Any, Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field, model_validator
from app.models.enums import PostStatus


class Post(Document):
    user_id: Indexed(PydanticObjectId)
    content_id: Indexed(PydanticObjectId)
    campaign_id: Optional[PydanticObjectId] = None
    plan_id: Optional[PydanticObjectId] = None
    plan_item_id: Optional[PydanticObjectId] = None
    scheduled_at: Optional[datetime] = None
    status: PostStatus = PostStatus.DRAFT
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="before")
    @classmethod
    def sync_plan_ids(cls, data: Any) -> Any:
        if isinstance(data, dict):
            pid = data.get("plan_id") or data.get("plan_item_id")
            if pid:
                if not data.get("plan_id"):
                    data["plan_id"] = pid
                if not data.get("plan_item_id"):
                    data["plan_item_id"] = pid
        return data

    class Settings:
        name = "posts"
