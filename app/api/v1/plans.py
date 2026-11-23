from datetime import datetime, timezone
from typing import List, Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.campaign import Campaign
from app.models.enums import CampaignStatus, PlanStatus
from app.models.plan import Plan
from app.models.user import User
from app.schemas.content import ContentResponse
from app.schemas.plan import (
    LegacyPlanCreate,
    LegacyPlanResponse,
    PlanCreate,
    PlanGenerateRequest,
    PlanItemResponse,
    PlanResponse,
)
from app.services.content_agent import (
    run_campaign_generation_agent,
    run_content_generation_agent,
    run_plan_generation_agent,
)

router = APIRouter()


@router.post(
    "/generate",
    response_model=LegacyPlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Campaign Plan",
)
async def generate_plan(
    payload: PlanGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generates an editorial campaign plan with item breakdown, logging a Prompt with type=PromptType.PLAN."""
    campaign, items, _ = await run_plan_generation_agent(
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
    response_data["items"] = [item.model_dump(by_alias=True) for item in items]
    response_data["plans"] = response_data["items"]
    return LegacyPlanResponse(**response_data)


@router.post(
    "/{plan_id}/items/{plan_item_id}/generate-content",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Content for Plan Item",
)
async def generate_plan_item_content(
    plan_id: PydanticObjectId,
    plan_item_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Generates content specifically for a plan item, logging a Prompt with type=PromptType.PLAN_ITEM."""
    plan_item = await Plan.find_one(
        Plan.id == plan_item_id,
        Plan.user_id == current_user.id,
        Plan.deleted_at == None,  # noqa: E711
    )
    if not plan_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan item not found")

    content, _ = await run_content_generation_agent(
        user_id=current_user.id,
        prompt=plan_item.idea,
        title=plan_item.idea[:60],
        campaign_id=plan_id,
        plan_id=plan_id,
        plan_item_id=plan_item_id,
        target_formats=plan_item.formats or None,
    )
    return content


@router.post(
    "/{plan_id}/generate-content",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Content for Plan",
)
async def generate_single_plan_content(
    plan_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Generates content specifically for a plan item, logging a Prompt with type=PromptType.PLAN_ITEM."""
    plan = await Plan.find_one(
        Plan.id == plan_id,
        Plan.user_id == current_user.id,
        Plan.deleted_at == None,  # noqa: E711
    )
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    content, _ = await run_content_generation_agent(
        user_id=current_user.id,
        prompt=plan.idea,
        title=plan.idea[:60],
        campaign_id=plan.campaign_id or plan.plan_id,
        plan_id=plan.id,
        plan_item_id=plan.id,
        target_formats=plan.formats or None,
    )
    return content


@router.post("", response_model=LegacyPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(payload: LegacyPlanCreate, current_user: User = Depends(get_current_user)):
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
        status=CampaignStatus.DRAFT,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    await campaign.insert()

    created_items = []
    items_to_create = payload.items or payload.plans
    for item_data in items_to_create:
        item = Plan(
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
        await item.insert()
        created_items.append(item)

    response_data = campaign.model_dump(by_alias=True)
    response_data["items"] = [item.model_dump(by_alias=True) for item in created_items]
    response_data["plans"] = response_data["items"]
    return LegacyPlanResponse(**response_data)


@router.get("", response_model=List[LegacyPlanResponse])
async def list_plans(current_user: User = Depends(get_current_user)):
    campaigns = await Campaign.find(
        Campaign.user_id == current_user.id,
        Campaign.deleted_at == None,  # noqa: E711
    ).sort("-created_at").to_list()

    result = []
    for camp in campaigns:
        items = await Plan.find(
            Plan.campaign_id == camp.id,
            Plan.deleted_at == None,  # noqa: E711
        ).to_list()
        camp_dict = camp.model_dump(by_alias=True)
        camp_dict["items"] = [i.model_dump(by_alias=True) for i in items]
        camp_dict["plans"] = camp_dict["items"]
        result.append(LegacyPlanResponse(**camp_dict))
    return result


@router.get("/{plan_id}", response_model=LegacyPlanResponse)
async def get_plan(plan_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    campaign = await Campaign.find_one(
        Campaign.id == plan_id,
        Campaign.user_id == current_user.id,
        Campaign.deleted_at == None,  # noqa: E711
    )
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    items = await Plan.find(
        Plan.campaign_id == campaign.id,
        Plan.deleted_at == None,  # noqa: E711
    ).to_list()

    camp_dict = campaign.model_dump(by_alias=True)
    camp_dict["items"] = [i.model_dump(by_alias=True) for i in items]
    camp_dict["plans"] = camp_dict["items"]
    return LegacyPlanResponse(**camp_dict)
