from datetime import datetime
from typing import Dict, List, Optional
from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import ContentStatus, ContentType


class ContentDetailSchema(BaseModel):
    type: ContentType
    script: Optional[str] = None
    path: Optional[str] = None
    text: Optional[str] = None
    order: int = 0
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[float] = None
    dimensions: Optional[Dict[str, int]] = None


class ContentCreate(BaseModel):
    user_id: Optional[PydanticObjectId] = None
    title: str
    details: List[ContentDetailSchema] = Field(default_factory=list)
    status: ContentStatus = ContentStatus.DRAFT


class ContentGenerateRequest(BaseModel):
    """Payload to trigger the LangChain + Groq content generation agent."""
    prompt: str = Field(..., description="High-level topic or prompt for AI content generation", min_length=3)
    title: Optional[str] = Field(None, description="Optional title (auto-generated from topic if omitted)")
    plan_id: Optional[PydanticObjectId] = Field(None, description="Optional linked plan ID")
    plan_item_id: Optional[PydanticObjectId] = Field(None, description="Optional linked plan item ID")
    formats: Optional[List[ContentType]] = Field(
        None,
        description="Optional list of formats to produce (defaults to all supported: text, image, audio, video)",
    )


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    details: Optional[List[ContentDetailSchema]] = None
    status: Optional[ContentStatus] = None


class ContentResponse(BaseModel):
    id: PydanticObjectId = Field(alias="_id")
    user_id: PydanticObjectId
    title: str
    details: List[ContentDetailSchema]
    status: ContentStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
