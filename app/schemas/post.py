from datetime import datetime
from typing import Any, Dict, List, Optional
from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.enums import PlatformCode, PostStatus, PostTargetStatus


class PostTargetBase(BaseModel):
    platform_id: PydanticObjectId
    platform_code: PlatformCode
    scheduled_at: Optional[datetime] = None
    payload_override: Dict[str, Any] = Field(default_factory=dict)


class PostTargetCreate(PostTargetBase):
    status: Optional[str] = None


class PostTargetResponse(PostTargetBase):
    id: PydanticObjectId = Field(alias="_id")
    post_id: PydanticObjectId
    user_id: PydanticObjectId
    status: PostTargetStatus
    attempts: int
    next_attempt_at: Optional[datetime] = None
    error: Optional[str] = None
    external_post_id: Optional[str] = None
    external_url: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)


class PostCreate(BaseModel):
    content_id: PydanticObjectId
    campaign_id: Optional[PydanticObjectId] = None
    plan_id: Optional[PydanticObjectId] = None
    plan_item_id: Optional[PydanticObjectId] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[PostStatus] = None
    targets: List[PostTargetCreate] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def sync_plan_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            pid = data.get("plan_id") or data.get("plan_item_id")
            if pid:
                data["plan_id"] = pid
                data["plan_item_id"] = pid
        return data


class PostResponse(BaseModel):
    id: PydanticObjectId = Field(alias="_id")
    user_id: PydanticObjectId
    content_id: PydanticObjectId
    campaign_id: Optional[PydanticObjectId] = None
    plan_id: Optional[PydanticObjectId] = None
    plan_item_id: Optional[PydanticObjectId] = None
    scheduled_at: Optional[datetime] = None
    status: PostStatus
    targets: List[PostTargetResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def sync_plan_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            pid = data.get("plan_id") or data.get("plan_item_id")
            if pid:
                data["plan_id"] = pid
                data["plan_item_id"] = pid
        return data

    model_config = ConfigDict(populate_by_name=True)
