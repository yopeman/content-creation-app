from datetime import datetime
from typing import Any, Dict, List, Optional
from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field
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
    scheduled_at: Optional[datetime] = None
    status: Optional[PostStatus] = None
    targets: List[PostTargetCreate] = Field(default_factory=list)


class PostReschedule(BaseModel):
    scheduled_at: datetime


class PostResponse(BaseModel):
    id: PydanticObjectId = Field(alias="_id")
    user_id: PydanticObjectId
    content_id: PydanticObjectId
    scheduled_at: Optional[datetime] = None
    status: PostStatus
    targets: List[PostTargetResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
