from datetime import datetime
from typing import List, Optional
from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import ContentType, PlanItemStatus, PlanStatus


class PlanItemBase(BaseModel):
    order: int = 0
    idea: str
    content_id: Optional[PydanticObjectId] = None
    platform_ids: List[PydanticObjectId] = Field(default_factory=list)
    scheduled_at: Optional[datetime] = None
    formats: List[ContentType] = Field(default_factory=list)


class PlanItemCreate(PlanItemBase):
    pass


class PlanItemResponse(PlanItemBase):
    id: PydanticObjectId = Field(alias="_id")
    plan_id: PydanticObjectId
    user_id: PydanticObjectId
    status: PlanItemStatus
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)


class PlanCreate(BaseModel):
    user_id: Optional[PydanticObjectId] = None
    idea: str
    context: Optional[str] = None
    number_of_content: int = 1
    permission: str = "review_required"
    items: List[PlanItemCreate] = Field(default_factory=list)


class PlanResponse(BaseModel):
    id: PydanticObjectId = Field(alias="_id")
    user_id: PydanticObjectId
    idea: str
    context: Optional[str] = None
    number_of_content: int
    permission: str
    status: PlanStatus
    items: List[PlanItemResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)

