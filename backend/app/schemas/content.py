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
    title: str
    details: List[ContentDetailSchema] = Field(default_factory=list)
    status: ContentStatus = ContentStatus.DRAFT


class ContentGenerateRequest(BaseModel):
    """Payload to trigger the LangChain + Groq content generation agent."""
    prompt: str = Field(..., description="High-level topic or prompt for AI content generation", min_length=3)
    title: Optional[str] = Field(None, description="Optional title (auto-generated from topic if omitted)")
    formats: Optional[List[ContentType]] = Field(
        None,
        description="Optional list of formats to produce (defaults to all supported: text, image, audio, video)",
    )
    parent_prompt_id: Optional[PydanticObjectId] = Field(
        None,
        description="Optional parent prompt ID in the prompt chain",
    )
    content_id: Optional[PydanticObjectId] = Field(
        None,
        description="Optional existing content ID if improving/updating existing content",
    )


class ContentImproveRequest(BaseModel):
    """Payload to iteratively improve existing content using the LangChain prompt chain."""
    instruction: str = Field(
        ...,
        description="Feedback or instruction on how to refine/improve the content (e.g. 'Make it punchier with bullet points, regenerate audio and video')",
        min_length=2,
    )
    formats: Optional[List[ContentType]] = Field(
        None,
        description="List of formats to regenerate/update. If omitted, all existing formats on this content are updated.",
    )
    parent_prompt_id: Optional[PydanticObjectId] = Field(
        None,
        description="Explicit parent prompt ID to branch from. If omitted, chains from the latest prompt for this content.",
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
