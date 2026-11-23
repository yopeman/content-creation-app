from datetime import datetime
from typing import Any, List, Optional
from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.enums import CampaignStatus
from app.schemas.plan import PlanCreate, PlanResponse


class CampaignBase(BaseModel):
    title: Optional[str] = None
    idea: str
    goal: Optional[str] = None
    context: Optional[str] = None
    number_of_content: int = 1
    color_hash_code: Optional[str] = None
    color_has_code: Optional[str] = None
    color_hex_code: Optional[str] = None
    permission: str = "review_required"
    status: Optional[CampaignStatus] = None
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


class CampaignCreate(CampaignBase):
    plans: List[PlanCreate] = Field(default_factory=list)
    items: List[PlanCreate] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def sync_items(cls, data: Any) -> Any:
        if isinstance(data, dict):
            items = data.get("plans") or data.get("items") or []
            data["plans"] = items
            data["items"] = items
        return data


class CampaignUpdate(BaseModel):
    title: Optional[str] = None
    idea: Optional[str] = None
    goal: Optional[str] = None
    context: Optional[str] = None
    number_of_content: Optional[int] = None
    color_hash_code: Optional[str] = None
    color_has_code: Optional[str] = None
    color_hex_code: Optional[str] = None
    permission: Optional[str] = None
    status: Optional[CampaignStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class CampaignGenerateRequest(BaseModel):
    idea: str = Field(..., description="Overarching campaign concept", min_length=3)
    title: Optional[str] = Field(None, description="Campaign title")
    goal: Optional[str] = Field(None, description="Campaign goal/objective")
    context: Optional[str] = Field(None, description="Campaign context, target audience, or channel focus")
    number_of_content: int = Field(3, description="Number of content items to schedule in this campaign", ge=1, le=20)
    color_hash_code: Optional[str] = Field(None, description="Color code / hex code for branding")
    color_has_code: Optional[str] = Field(None, description="Alias for color_hash_code")
    color_hex_code: Optional[str] = Field(None, description="Alias for color_hash_code")
    permission: str = "review_required"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    generate_contents: bool = Field(False, description="Whether to run the AI generation loop for all plans")

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


class CampaignResponse(CampaignBase):
    id: PydanticObjectId = Field(alias="_id")
    user_id: PydanticObjectId
    status: CampaignStatus
    plans: List[PlanResponse] = Field(default_factory=list)
    items: List[PlanResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def sync_response_items(cls, data: Any) -> Any:
        if isinstance(data, dict):
            items = data.get("plans") or data.get("items") or []
            data["plans"] = items
            data["items"] = items
        return data

    model_config = ConfigDict(populate_by_name=True)
