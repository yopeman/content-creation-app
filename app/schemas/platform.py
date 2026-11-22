from datetime import datetime
from typing import Any, Dict, List, Optional
from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import PlatformCode, PlatformStatus


class SupportedPlatform(BaseModel):
    code: PlatformCode
    name: str
    description: str
    is_supported: bool = True
    required_details: List[str] = Field(default_factory=list)


class PlatformBase(BaseModel):
    code: PlatformCode
    account_name: Optional[str] = None
    platform_account_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    expires_at: Optional[datetime] = None
    status: PlatformStatus = PlatformStatus.CONNECTED


class PlatformCreate(PlatformBase):
    pass


class PlatformUpdate(BaseModel):
    account_name: Optional[str] = None
    platform_account_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    status: Optional[PlatformStatus] = None
    expires_at: Optional[datetime] = None
    last_error: Optional[str] = None


class PlatformResponse(PlatformBase):
    id: PydanticObjectId = Field(alias="_id")
    user_id: PydanticObjectId
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
