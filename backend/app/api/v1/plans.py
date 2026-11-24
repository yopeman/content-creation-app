from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.api.deps import get_current_user
from app.models.campaign import Campaign
from app.models.content import Content
from app.models.enums import CampaignStatus, PlanStatus
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
    PlanWithDetailsResponse,
)

router = APIRouter()


async def enrich_plan_with_details(plan: Plan) -> PlanWithDetailsResponse:
    camp_title = None
    camp_color = None
    cont_title = None
    cont_status = None

    parent_id = plan.campaign_id or plan.plan_id
    if parent_id:
        camp = await Campaign.find_one(
            Campaign.id == parent_id,
            Campaign.deleted_at == None,  # noqa: E711
        )
        if camp:
            camp_title = camp.title or camp.idea
            camp_color = camp.color_hash_code or "#6366f1"

    if plan.content_id:
        cont = await Content.find_one(
            Content.id == plan.content_id,
            Content.deleted_at == None,  # noqa: E711
        )
        if cont:
            cont_title = cont.title
            cont_status = cont.status.value if hasattr(cont.status, "value") else str(cont.status)

    data = plan.model_dump(by_alias=True)
    data["campaign_title"] = camp_title
    data["campaign_color"] = camp_color
    data["content_title"] = cont_title
    data["content_status"] = cont_status
    return PlanWithDetailsResponse(**data)


async def enrich_plans_with_details(plans: List[Plan]) -> List[PlanWithDetailsResponse]:
    if not plans:
        return []

    camp_ids = list({p.campaign_id or p.plan_id for p in plans if (p.campaign_id or p.plan_id)})
    cont_ids = list({p.content_id for p in plans if p.content_id})

    camps = (
        await Campaign.find(
            {"_id": {"$in": camp_ids}, "deleted_at": None}
        ).to_list()
        if camp_ids
        else []
    )
    conts = (
        await Content.find(
            {"_id": {"$in": cont_ids}, "deleted_at": None}
        ).to_list()
        if cont_ids
        else []
    )

    camp_map = {c.id: c for c in camps}
    cont_map = {c.id: c for c in conts}

    enriched = []
    for plan in plans:
        parent_id = plan.campaign_id or plan.plan_id
        camp = camp_map.get(parent_id) if parent_id else None
        cont = cont_map.get(plan.content_id) if plan.content_id else None

        data = plan.model_dump(by_alias=True)
        data["campaign_title"] = (camp.title or camp.idea) if camp else None
        data["campaign_color"] = (camp.color_hash_code or "#6366f1") if camp else None
        data["content_title"] = cont.title if cont else None
        data["content_status"] = (
            cont.status.value if hasattr(cont.status, "value") else str(cont.status)
        ) if cont else None
        enriched.append(PlanWithDetailsResponse(**data))
    return enriched


# -------------------------------------------------------------------------
# Individual Plan Item Endpoints (Standalone or Associated with Campaign)
# -------------------------------------------------------------------------

@router.get(
    "/items",
    response_model=List[PlanWithDetailsResponse],
    summary="List All Plan Items (Standalone & In-Campaign)",
)
async def list_plan_items(
    campaign_id: Optional[PydanticObjectId] = Query(None, description="Filter by specific campaign ID"),
    standalone: Optional[bool] = Query(None, description="If true, return plans with no campaign; if false, return plans with a campaign"),
    status: Optional[PlanStatus] = Query(None, description="Filter by plan status"),
    current_user: User = Depends(get_current_user),
):
    """Retrieves individual plans for the current user, optionally filtered by campaign or standalone."""
    query: Dict[str, Any] = {"user_id": current_user.id, "deleted_at": None}

    if campaign_id:
        query["$or"] = [{"campaign_id": campaign_id}, {"plan_id": campaign_id}]
    elif standalone is True:
        query["campaign_id"] = None
        query["plan_id"] = None
    elif standalone is False:
        query["$or"] = [{"campaign_id": {"$ne": None}}, {"plan_id": {"$ne": None}}]

    if status:
        query["status"] = status

    plans = await Plan.find(query).sort("-created_at").to_list()
    return await enrich_plans_with_details(plans)


@router.post(
    "/items",
    response_model=PlanWithDetailsResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Plan Item (Standalone or Associated with Campaign)",
)
async def create_single_plan_item(
    payload: PlanCreate,
    current_user: User = Depends(get_current_user),
):
    """Creates a new plan item for the user. If campaign_id is supplied, associates it with that campaign."""
    user_id = current_user.id
    camp_id = payload.campaign_id or payload.plan_id

    if camp_id:
        campaign = await Campaign.find_one(
            Campaign.id == camp_id,
            Campaign.user_id == user_id,
            Campaign.deleted_at == None,  # noqa: E711
        )
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated campaign not found",
            )

    plan = Plan(
        campaign_id=camp_id,
        plan_id=camp_id,
        user_id=user_id,
        order=payload.order,
        idea=payload.idea,
        content_id=payload.content_id,
        platform_ids=payload.platform_ids,
        scheduled_at=payload.scheduled_at,
        formats=payload.formats,
        status=payload.status or PlanStatus.PENDING,
    )
    await plan.insert()
    return await enrich_plan_with_details(plan)


@router.get(
    "/items/{plan_id}",
    response_model=PlanWithDetailsResponse,
    summary="Get Single Plan Item with Details",
)
async def get_single_plan_item(
    plan_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Retrieves a single plan item with enriched campaign and content details."""
    plan = await Plan.find_one(
        Plan.id == plan_id,
        Plan.user_id == current_user.id,
        Plan.deleted_at == None,  # noqa: E711
    )
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan item not found")
    return await enrich_plan_with_details(plan)


# -------------------------------------------------------------------------
# Legacy Campaign-Oriented Plan Endpoints (Backward Compatible)
# -------------------------------------------------------------------------

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


@router.patch("/{plan_id}", response_model=PlanWithDetailsResponse, summary="Update Single Plan Item Manually")
async def update_single_plan(
    plan_id: PydanticObjectId,
    payload: PlanUpdate,
    current_user: User = Depends(get_current_user),
):
    """Manually updates an individual plan item, including associating or dissociating campaigns."""
    plan = await Plan.find_one(
        Plan.id == plan_id,
        Plan.user_id == current_user.id,
        Plan.deleted_at == None,  # noqa: E711
    )
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan item not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Check if campaign_id / plan_id is being modified
    if "campaign_id" in update_data or "plan_id" in update_data:
        target_camp_id = update_data.get("campaign_id") or update_data.get("plan_id")
        if target_camp_id:
            camp = await Campaign.find_one(
                Campaign.id == target_camp_id,
                Campaign.user_id == current_user.id,
                Campaign.deleted_at == None,  # noqa: E711
            )
            if not camp:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target campaign not found")
            plan.campaign_id = camp.id
            plan.plan_id = camp.id
        else:
            # Explicit dissociation from campaign -> standalone
            plan.campaign_id = None
            plan.plan_id = None
        update_data.pop("campaign_id", None)
        update_data.pop("plan_id", None)

    for field, val in update_data.items():
        setattr(plan, field, val)

    plan.updated_at = datetime.now(timezone.utc)
    await plan.save()
    return await enrich_plan_with_details(plan)


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
