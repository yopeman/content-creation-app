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
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    timezone: Optional[str] = None
    status: Optional[UserStatus] = None


class UserProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    timezone: Optional[str] = Field(default=None, min_length=1, max_length=64)


class UserPasswordChange(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class UserResponse(UserBase):
    id: PydanticObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
