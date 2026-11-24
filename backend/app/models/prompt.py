from datetime import datetime, timezone
from typing import Any, Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field, model_validator
from app.models.enums import PromptStatus, PromptType


class Prompt(Document):
    parent_prompt_id: Optional[PydanticObjectId] = None
    user_id: Indexed(PydanticObjectId)
    content_id: Optional[PydanticObjectId] = None
    campaign_id: Optional[PydanticObjectId] = None
    plan_id: Optional[PydanticObjectId] = None
    plan_item_id: Optional[PydanticObjectId] = None
    type: PromptType
    prompt: str
    response: Optional[str] = None
    model: str
    tokens_in: int = 0
    tokens_out: int = 0
    status: PromptStatus = PromptStatus.PENDING
    error: Optional[str] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="before")
    @classmethod
    def sync_campaign_and_plan(cls, data: Any) -> Any:
        if isinstance(data, dict):
            cid = data.get("campaign_id") or data.get("plan_id")
            if cid:
                if not data.get("campaign_id"):
                    data["campaign_id"] = cid
                if not data.get("plan_id"):
                    data["plan_id"] = cid
        return data

    class Settings:
        name = "prompts"
