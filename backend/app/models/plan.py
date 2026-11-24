from datetime import datetime, timezone
from typing import Any, List, Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field, model_validator
from app.models.enums import ContentType, PlanStatus


class Plan(Document):
    plan_id: Optional[Indexed(PydanticObjectId)] = None
    campaign_id: Optional[Indexed(PydanticObjectId)] = None
    user_id: Indexed(PydanticObjectId)
    order: int = 0
    idea: str
    content_id: Optional[PydanticObjectId] = None
    platform_ids: List[PydanticObjectId] = Field(default_factory=list)
    scheduled_at: Optional[datetime] = None
    status: PlanStatus = PlanStatus.PENDING
    formats: List[ContentType] = Field(default_factory=list)
    error: Optional[str] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="before")
    @classmethod
    def sync_parent_ids(cls, data: Any) -> Any:
        if isinstance(data, dict):
            parent_id = data.get("campaign_id") or data.get("plan_id")
            if parent_id:
                if not data.get("campaign_id"):
                    data["campaign_id"] = parent_id
                if not data.get("plan_id"):
                    data["plan_id"] = parent_id
        return data

    class Settings:
        name = "plans"
