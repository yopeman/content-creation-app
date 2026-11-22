from datetime import datetime
from typing import Optional
from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import PromptStatus, PromptType


class PromptResponse(BaseModel):
    id: PydanticObjectId = Field(alias="_id")
    parent_prompt_id: Optional[PydanticObjectId] = None
    user_id: PydanticObjectId
    content_id: Optional[PydanticObjectId] = None
    plan_id: Optional[PydanticObjectId] = None
    plan_item_id: Optional[PydanticObjectId] = None
    type: PromptType
    prompt: str
    response: Optional[str] = None
    model: str
    tokens_in: int = 0
    tokens_out: int = 0
    status: PromptStatus
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
