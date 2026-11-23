from datetime import datetime
from typing import Any, List, Optional
from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.enums import ContentType, PlanStatus


class PlanBase(BaseModel):
    order: int = 0
    idea: str
    content_id: Optional[PydanticObjectId] = None
    platform_ids: List[PydanticObjectId] = Field(default_factory=list)
    scheduled_at: Optional[datetime] = None
    formats: List[ContentType] = Field(default_factory=list)


class PlanCreate(PlanBase):
    campaign_id: Optional[PydanticObjectId] = None
    plan_id: Optional[PydanticObjectId] = None
    status: Optional[PlanStatus] = None

    @model_validator(mode="before")
    @classmethod
    def sync_parent_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            pid = data.get("campaign_id") or data.get("plan_id")
            if pid:
                data["campaign_id"] = pid
                data["plan_id"] = pid
        return data


class PlanUpdate(BaseModel):
    order: Optional[int] = None
    idea: Optional[str] = None
    content_id: Optional[PydanticObjectId] = None
    platform_ids: Optional[List[PydanticObjectId]] = None
    scheduled_at: Optional[datetime] = None
    formats: Optional[List[ContentType]] = None
    status: Optional[PlanStatus] = None
    error: Optional[str] = None


class PlanResponse(PlanBase):
    id: PydanticObjectId = Field(alias="_id")
    campaign_id: Optional[PydanticObjectId] = None
    plan_id: Optional[PydanticObjectId] = None
    user_id: PydanticObjectId
    status: PlanStatus
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def sync_parent_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            pid = data.get("campaign_id") or data.get("plan_id")
            if pid:
                data["campaign_id"] = pid
                data["plan_id"] = pid
        return data

    model_config = ConfigDict(populate_by_name=True)


# Backwards compatibility aliases for PlanItem
PlanItemBase = PlanBase
PlanItemCreate = PlanCreate
PlanItemResponse = PlanResponse


# Backwards-compatible legacy Plan campaign schemas:
class LegacyPlanCreate(BaseModel):
    idea: str
    title: Optional[str] = None
    goal: Optional[str] = None
    context: Optional[str] = None
    number_of_content: int = 1
    color_hash_code: Optional[str] = None
    color_has_code: Optional[str] = None
    color_hex_code: Optional[str] = None
    permission: str = "review_required"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    items: List[PlanCreate] = Field(default_factory=list)
    plans: List[PlanCreate] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def sync_items(cls, data: Any) -> Any:
        if isinstance(data, dict):
            items = data.get("items") or data.get("plans") or []
            data["items"] = items
            data["plans"] = items
            color = (
                data.get("color_hash_code")
                or data.get("color_has_code")
                or data.get("color_hex_code")
                or data.get("color_code")
            )
            if color:
                data["color_hash_code"] = color
                data["color_has_code"] = color
                data["color_hex_code"] = color
        return data


class PlanGenerateRequest(BaseModel):
    idea: str = Field(..., description="Overarching campaign or content plan concept", min_length=3)
    title: Optional[str] = Field(None, description="Campaign title")
    goal: Optional[str] = Field(None, description="Campaign goal")
    context: Optional[str] = Field(None, description="Campaign context, target audience, or channel focus")
    number_of_content: int = Field(3, description="Number of content items to schedule in this plan", ge=1, le=20)
    color_hash_code: Optional[str] = Field(None, description="Color code / hex code")
    color_has_code: Optional[str] = Field(None, description="Alias for color_hash_code")
    color_hex_code: Optional[str] = Field(None, description="Alias for color_hash_code")
    permission: str = "review_required"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def sync_color(cls, data: Any) -> Any:
        if isinstance(data, dict):
            color = (
                data.get("color_hash_code")
                or data.get("color_has_code")
                or data.get("color_hex_code")
                or data.get("color_code")
            )
            if color:
                data["color_hash_code"] = color
                data["color_has_code"] = color
                data["color_hex_code"] = color
        return data


class LegacyPlanResponse(BaseModel):
    id: PydanticObjectId = Field(alias="_id")
    user_id: PydanticObjectId
    title: Optional[str] = None
    idea: str
    goal: Optional[str] = None
    context: Optional[str] = None
    number_of_content: int
    color_hash_code: Optional[str] = None
    color_has_code: Optional[str] = None
    color_hex_code: Optional[str] = None
    permission: str
    status: Any
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    items: List[PlanResponse] = Field(default_factory=list)
    plans: List[PlanResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def sync_items(cls, data: Any) -> Any:
        if isinstance(data, dict):
            items = data.get("items") or data.get("plans") or []
            data["items"] = items
            data["plans"] = items
            color = (
                data.get("color_hash_code")
                or data.get("color_has_code")
                or data.get("color_hex_code")
                or data.get("color_code")
            )
            if color:
                data["color_hash_code"] = color
                data["color_has_code"] = color
                data["color_hex_code"] = color
        return data

    model_config = ConfigDict(populate_by_name=True)
