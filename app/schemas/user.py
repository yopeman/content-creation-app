from datetime import datetime
from typing import Optional
from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models.enums import UserStatus


class UserBase(BaseModel):
    name: str
    email: EmailStr
    timezone: str = "UTC"
    status: UserStatus = UserStatus.ACTIVE


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    timezone: Optional[str] = None
    status: Optional[UserStatus] = None


class UserResponse(UserBase):
    id: PydanticObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)

