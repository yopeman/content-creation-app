from datetime import datetime, timezone
from typing import List, Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from app.models.enums import ContentType, PlanItemStatus


class PlanItem(Document):
    plan_id: Indexed(PydanticObjectId)
    user_id: Indexed(PydanticObjectId)
    order: int = 0
    idea: str
    content_id: Optional[PydanticObjectId] = None
    platform_ids: List[PydanticObjectId] = Field(default_factory=list)
    scheduled_at: Optional[datetime] = None
    status: PlanItemStatus = PlanItemStatus.PENDING
    formats: List[ContentType] = Field(default_factory=list)
    error: Optional[str] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "plan_items"
