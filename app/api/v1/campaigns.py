from datetime import datetime, timezone
from typing import List
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.campaign import Campaign
from app.models.enums import CampaignStatus
from app.models.plan import Plan
from app.models.user import User
from app.schemas.campaign import (
    CampaignCreate,
    CampaignGenerateRequest,
    CampaignResponse,
    CampaignUpdate,
)
from app.schemas.content import ContentResponse
from app.schemas.plan import PlanCreate, PlanResponse

router = APIRouter()


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED, summary="Create Manual Campaign")
async def create_campaign(
    payload: CampaignCreate,
    current_user: User = Depends(get_current_user),
):
    """Manually creates a new campaign along with its plans for the authenticated user."""
    user_id = current_user.id

    color = payload.color_hash_code or payload.color_has_code or payload.color_hex_code
    campaign = Campaign(
        user_id=user_id,
        title=payload.title,
        idea=payload.idea,
        goal=payload.goal,
        context=payload.context,
        number_of_content=payload.number_of_content,
        color_hash_code=color,
        permission=payload.permission,
        status=payload.status or CampaignStatus.DRAFT,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    await campaign.insert()

    created_plans = []
    items_to_create = payload.plans or payload.items
    for item_data in items_to_create:
        plan = Plan(
            campaign_id=campaign.id,
            plan_id=campaign.id,
            user_id=user_id,
            order=item_data.order,
            idea=item_data.idea,
            content_id=item_data.content_id,
            platform_ids=item_data.platform_ids,
            scheduled_at=item_data.scheduled_at,
            formats=item_data.formats,
        )
        await plan.insert()
        created_plans.append(plan)

    response_data = campaign.model_dump(by_alias=True)
    response_data["plans"] = [p.model_dump(by_alias=True) for p in created_plans]
    response_data["items"] = response_data["plans"]
    return CampaignResponse(**response_data)


@router.get("", response_model=List[CampaignResponse], summary="List User Campaigns")
async def list_campaigns(current_user: User = Depends(get_current_user)):
    """Retrieves all non-deleted campaigns owned by the current user."""
    campaigns = await Campaign.find(
        Campaign.user_id == current_user.id,
        Campaign.deleted_at == None,  # noqa: E711
    ).sort("-created_at").to_list()

    result = []
    for camp in campaigns:
        plans = await Plan.find(
            Plan.campaign_id == camp.id,
            Plan.deleted_at == None,  # noqa: E711
        ).to_list()
        camp_dict = camp.model_dump(by_alias=True)
        camp_dict["plans"] = [p.model_dump(by_alias=True) for p in plans]
        camp_dict["items"] = camp_dict["plans"]
        result.append(CampaignResponse(**camp_dict))
    return result


@router.get("/{campaign_id}", response_model=CampaignResponse, summary="Get Campaign by ID")
async def get_campaign(
    campaign_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Retrieves a single campaign with its plans."""
    campaign = await Campaign.find_one(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id,
        Campaign.deleted_at == None,  # noqa: E711
    )
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    plans = await Plan.find(
        Plan.campaign_id == campaign.id,
        Plan.deleted_at == None,  # noqa: E711
    ).to_list()

    camp_dict = campaign.model_dump(by_alias=True)
    camp_dict["plans"] = [p.model_dump(by_alias=True) for p in plans]
    camp_dict["items"] = camp_dict["plans"]
    return CampaignResponse(**camp_dict)


@router.patch("/{campaign_id}", response_model=CampaignResponse, summary="Update Campaign")
async def update_campaign(
    campaign_id: PydanticObjectId,
    payload: CampaignUpdate,
    current_user: User = Depends(get_current_user),
):
    """Manually updates campaign metadata, goals, colors, or status."""
    campaign = await Campaign.find_one(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id,
        Campaign.deleted_at == None,  # noqa: E711
    )
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    update_data = payload.model_dump(exclude_unset=True)
    color = update_data.pop("color_hex_code", None) or update_data.pop("color_has_code", None)
    if color and "color_hash_code" not in update_data:
        update_data["color_hash_code"] = color

    for field, val in update_data.items():
        setattr(campaign, field, val)

    campaign.updated_at = datetime.now(timezone.utc)
    await campaign.save()

    plans = await Plan.find(
        Plan.campaign_id == campaign.id,
        Plan.deleted_at == None,  # noqa: E711
    ).to_list()

    camp_dict = campaign.model_dump(by_alias=True)
    camp_dict["plans"] = [p.model_dump(by_alias=True) for p in plans]
    camp_dict["items"] = camp_dict["plans"]
    return CampaignResponse(**camp_dict)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Campaign")
async def delete_campaign(
    campaign_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Soft deletes a campaign and its associated plans."""
    campaign = await Campaign.find_one(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id,
        Campaign.deleted_at == None,  # noqa: E711
    )
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    now = datetime.now(timezone.utc)
    campaign.deleted_at = now
    await campaign.save()

    plans = await Plan.find(
        Plan.campaign_id == campaign.id,
        Plan.deleted_at == None,  # noqa: E711
    ).to_list()
    for p in plans:
        p.deleted_at = now
        await p.save()


@router.post(
    "/{campaign_id}/plans",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a Plan Manually to Campaign",
)
async def create_campaign_plan(
    campaign_id: PydanticObjectId,
    payload: PlanCreate,
    current_user: User = Depends(get_current_user),
):
    """Manually adds a plan to a campaign."""
    campaign = await Campaign.find_one(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id,
        Campaign.deleted_at == None,  # noqa: E711
    )
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    plan = Plan(
        campaign_id=campaign.id,
        plan_id=campaign.id,
        user_id=current_user.id,
        order=payload.order,
        idea=payload.idea,
        content_id=payload.content_id,
        platform_ids=payload.platform_ids,
        scheduled_at=payload.scheduled_at,
        formats=payload.formats,
    )
    await plan.insert()
    return plan


@router.get(
    "/{campaign_id}/plans",
    response_model=List[PlanResponse],
    summary="List Plans of a Campaign",
)
async def list_campaign_plans(
    campaign_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Lists plans belonging to a specific campaign."""
    campaign = await Campaign.find_one(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id,
        Campaign.deleted_at == None,  # noqa: E711
    )
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    return await Plan.find(
        Plan.campaign_id == campaign.id,
        Plan.deleted_at == None,  # noqa: E711
    ).to_list()


# -------------------------------------------------------------------------
# Delegated AI Generation Routes (forward to generations for backward compatibility)
# -------------------------------------------------------------------------

@router.post(
    "/generate",
    response_model=CampaignResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Campaign (Deprecated: use /api/v1/generations/campaign)",
    include_in_schema=False,
)
async def generate_campaign_legacy(
    payload: CampaignGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    from app.api.v1.generations import generate_campaign
    return await generate_campaign(payload=payload, current_user=current_user)


@router.post(
    "/{campaign_id}/plans/{plan_id}/generate-content",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Content for Plan (Deprecated: use /api/v1/generations/plans/{plan_id}/content)",
    include_in_schema=False,
)
async def generate_campaign_plan_content_legacy(
    campaign_id: PydanticObjectId,
    plan_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    from app.api.v1.generations import generate_plan_content
    return await generate_plan_content(
        plan_id=plan_id,
        campaign_id=campaign_id,
        current_user=current_user,
    )
