from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.enums import ContentStatus, ContentType
from app.schemas.user import UserResponse


class IntegrationContentDetail(BaseModel):
    type: ContentType
    path: Optional[str] = None
    text: Optional[str] = None
    script: Optional[str] = None
    order: int = 1
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[float] = None
    dimensions: Optional[dict] = None


class IntegrationContentData(BaseModel):
    title: str = Field(..., min_length=1)
    details: List[IntegrationContentDetail] = Field(default_factory=list)
    status: ContentStatus = ContentStatus.DRAFT


class IngestContentRequest(BaseModel):
    name: Optional[str] = None
    email: EmailStr
    content: IntegrationContentData


class IngestContentResponse(BaseModel):
    content_id: str
    user_id: str
    is_new_user: bool
    claim_token: str
    view_url: str


class ClaimTicketRequest(BaseModel):
    claim_token: str


class OnboardingStatus(BaseModel):
    needs_password: bool
    has_connected_channel: bool


class ClaimTicketResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    content_id: str
    onboarding: OnboardingStatus
