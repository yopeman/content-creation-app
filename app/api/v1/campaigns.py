from datetime import datetime, timezone
from typing import List, Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.campaign import Campaign
from app.models.enums import CampaignStatus, PlanStatus
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
from app.services.content_agent import (
    run_campaign_generation_agent,
    run_content_generation_agent,
)

router = APIRouter()


@router.post(
    "/generate",
    response_model=CampaignResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Campaign with Plans",
)
async def generate_campaign(
    payload: CampaignGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generates an editorial campaign with plan breakdown, logging a Prompt with type=PromptType.CAMPAIGN."""
    campaign, plans, _ = await run_campaign_generation_agent(
        user_id=current_user.id,
        idea=payload.idea,
        title=payload.title,
        goal=payload.goal,
        context=payload.context,
        number_of_content=payload.number_of_content,
        color_has_code=payload.color_has_code,
        permission=payload.permission,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    response_data = campaign.model_dump(by_alias=True)
    response_data["plans"] = [p.model_dump(by_alias=True) for p in plans]
    response_data["items"] = response_data["plans"]
    return CampaignResponse(**response_data)


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id

    campaign = Campaign(
        user_id=user_id,
        title=payload.title,
        idea=payload.idea,
        goal=payload.goal,
        context=payload.context,
        number_of_content=payload.number_of_content,
        color_has_code=payload.color_has_code,
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


@router.get("", response_model=List[CampaignResponse])
async def list_campaigns(current_user: User = Depends(get_current_user)):
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


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
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


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: PydanticObjectId,
    payload: CampaignUpdate,
    current_user: User = Depends(get_current_user),
):
    campaign = await Campaign.find_one(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id,
        Campaign.deleted_at == None,  # noqa: E711
    )
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "color_hex_code" in update_data and "color_has_code" not in update_data:
        update_data["color_has_code"] = update_data.pop("color_hex_code")

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


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
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

    # Soft delete related plans
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
    summary="Add a Plan to Campaign",
)
async def create_campaign_plan(
    campaign_id: PydanticObjectId,
    payload: PlanCreate,
    current_user: User = Depends(get_current_user),
):
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


@router.post(
    "/{campaign_id}/plans/{plan_id}/generate-content",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Content for a Plan under Campaign",
)
async def generate_campaign_plan_content(
    campaign_id: PydanticObjectId,
    plan_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    plan = await Plan.find_one(
        Plan.id == plan_id,
        Plan.campaign_id == campaign_id,
        Plan.user_id == current_user.id,
        Plan.deleted_at == None,  # noqa: E711
    )
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    content, _ = await run_content_generation_agent(
        user_id=current_user.id,
        prompt=plan.idea,
        title=plan.idea[:60],
        campaign_id=campaign_id,
        plan_id=plan.id,
        plan_item_id=plan.id,
        target_formats=plan.formats or None,
    )
    return content
