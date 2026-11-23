from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field, model_validator
from app.models.enums import CampaignStatus


class Campaign(Document):
    user_id: Indexed(PydanticObjectId)
    title: Optional[str] = None
    idea: str
    goal: Optional[str] = None
    context: Optional[str] = None
    number_of_content: int = 1
    color_hash_code: Optional[str] = None
    permission: str = "review_required"  # "review_required", "auto_publish"
    status: CampaignStatus = CampaignStatus.DRAFT
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="before")
    @classmethod
    def sync_color_code(cls, data):
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
        return data

    @property
    def color_has_code(self) -> Optional[str]:
        return self.color_hash_code

    @color_has_code.setter
    def color_has_code(self, val: Optional[str]):
        self.color_hash_code = val

    @property
    def color_hex_code(self) -> Optional[str]:
        return self.color_hash_code

    @color_hex_code.setter
    def color_hex_code(self, val: Optional[str]):
        self.color_hash_code = val

    @property
    def color_code(self) -> Optional[str]:
        return self.color_hash_code

    @color_code.setter
    def color_code(self, val: Optional[str]):
        self.color_hash_code = val

    class Settings:
        name = "campaigns"
