from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from app.models.enums import PlanStatus


class Plan(Document):
    user_id: Indexed(PydanticObjectId)
    idea: str
    context: Optional[str] = None
    number_of_content: int = 1
    permission: str = "review_required"  # "review_required", "auto_publish"
    status: PlanStatus = PlanStatus.DRAFT
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "plans"
