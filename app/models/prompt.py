from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from app.models.enums import PromptStatus, PromptType


class Prompt(Document):
    parent_prompt_id: Optional[PydanticObjectId] = None
    user_id: Indexed(PydanticObjectId)
    content_id: Optional[PydanticObjectId] = None
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

    class Settings:
        name = "prompts"
