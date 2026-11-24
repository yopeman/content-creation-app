from datetime import datetime, timezone
from typing import Dict, List, Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, Field
from app.models.enums import ContentStatus, ContentType


class ContentDetail(BaseModel):
    type: ContentType
    script: Optional[str] = None
    path: Optional[str] = None
    text: Optional[str] = None
    order: int = 0
    # Media validation & metadata for audio/video/image
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[float] = None
    dimensions: Optional[Dict[str, int]] = None  # {"width": 1080, "height": 1920}


class Content(Document):
    user_id: Indexed(PydanticObjectId)
    title: str
    details: List[ContentDetail] = Field(default_factory=list)
    status: ContentStatus = ContentStatus.DRAFT
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "contents"
