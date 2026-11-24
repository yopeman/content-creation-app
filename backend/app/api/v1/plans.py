from datetime import datetime, timezone
from typing import List, Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.campaign import Campaign
from app.models.enums import CampaignStatus
from app.models.plan import Plan
from app.models.user import User
from app.schemas.content import ContentResponse
from app.schemas.plan import (
    LegacyPlanCreate,
    LegacyPlanResponse,
    PlanCreate,
    PlanGenerateRequest,
    PlanResponse,
    PlanUpdate,
)

router = APIRouter()


@router.post("", response_model=LegacyPlanResponse, status_code=status.HTTP_201_CREATED, summary="Create Manual Plan / Campaign")
async def create_plan(payload: LegacyPlanCreate, current_user: User = Depends(get_current_user)):
    """Manually creates a campaign with plans."""
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


@router.get("", response_model=List[LegacyPlanResponse], summary="List Manual Plans / Campaigns")
async def list_plans(current_user: User = Depends(get_current_user)):
    """Retrieves all non-deleted campaigns and their plans."""
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


@router.get("/{plan_id}", response_model=LegacyPlanResponse, summary="Get Manual Plan / Campaign")
async def get_plan(plan_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """Retrieves a single campaign and its plans."""
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


@router.patch("/{plan_id}", response_model=PlanResponse, summary="Update Single Plan Item Manually")
async def update_single_plan(
    plan_id: PydanticObjectId,
    payload: PlanUpdate,
    current_user: User = Depends(get_current_user),
):
    """Manually updates an individual plan item."""
    plan = await Plan.find_one(
        Plan.id == plan_id,
        Plan.user_id == current_user.id,
        Plan.deleted_at == None,  # noqa: E711
    )
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan item not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(plan, field, val)

    plan.updated_at = datetime.now(timezone.utc)
    await plan.save()
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Single Plan Item")
async def delete_single_plan(
    plan_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Soft-deletes a single plan item."""
    plan = await Plan.find_one(
        Plan.id == plan_id,
        Plan.user_id == current_user.id,
        Plan.deleted_at == None,  # noqa: E711
    )
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan item not found")

    plan.deleted_at = datetime.now(timezone.utc)
    await plan.save()


# -------------------------------------------------------------------------
# Delegated AI Generation Routes (forward to generations for backward compatibility)
# -------------------------------------------------------------------------

@router.post(
    "/generate",
    response_model=LegacyPlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Campaign Plan (Deprecated: use /api/v1/generations/plan)",
    include_in_schema=False,
)
async def generate_plan_legacy(
    payload: PlanGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    from app.api.v1.generations import generate_plan
    return await generate_plan(payload=payload, current_user=current_user)


@router.post(
    "/{plan_id}/items/{plan_item_id}/generate-content",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Content for Plan Item (Deprecated: use /api/v1/generations/plans/{plan_id}/content)",
    include_in_schema=False,
)
async def generate_plan_item_content_legacy(
    plan_id: PydanticObjectId,
    plan_item_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    from app.api.v1.generations import generate_plan_content
    return await generate_plan_content(
        plan_id=plan_item_id,
        campaign_id=plan_id,
        current_user=current_user,
    )


@router.post(
    "/{plan_id}/generate-content",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Content for Plan (Deprecated: use /api/v1/generations/plans/{plan_id}/content)",
    include_in_schema=False,
)
async def generate_single_plan_content_legacy(
    plan_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    from app.api.v1.generations import generate_plan_content
    return await generate_plan_content(
        plan_id=plan_id,
        current_user=current_user,
    )
