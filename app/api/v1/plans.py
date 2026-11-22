from typing import List
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.enums import PlanStatus
from app.models.plan import Plan
from app.models.plan_item import PlanItem
from app.models.user import User
from app.schemas.content import ContentResponse
from app.schemas.plan import PlanCreate, PlanGenerateRequest, PlanItemResponse, PlanResponse
from app.services.content_agent import run_content_generation_agent, run_plan_generation_agent

router = APIRouter()


@router.post("/generate", response_model=PlanResponse, status_code=status.HTTP_201_CREATED, summary="AI Generate Campaign Plan")
async def generate_plan(
    payload: PlanGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generates an editorial campaign plan with item breakdown, logging a Prompt with type=PromptType.PLAN."""
    plan, items, _ = await run_plan_generation_agent(
        user_id=current_user.id,
        idea=payload.idea,
        context=payload.context,
        number_of_content=payload.number_of_content,
        permission=payload.permission,
    )
    response_data = plan.model_dump(by_alias=True)
    response_data["items"] = [item.model_dump(by_alias=True) for item in items]
    return PlanResponse(**response_data)


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
    plan_item = await PlanItem.find_one(
        PlanItem.id == plan_item_id,
        PlanItem.plan_id == plan_id,
        PlanItem.user_id == current_user.id,
        PlanItem.deleted_at == None,  # noqa: E711
    )
    if not plan_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan item not found")

    content, _ = await run_content_generation_agent(
        user_id=current_user.id,
        prompt=plan_item.idea,
        title=plan_item.idea[:60],
        plan_id=plan_id,
        plan_item_id=plan_item_id,
        target_formats=plan_item.formats or None,
    )
    return content


@router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(payload: PlanCreate, current_user: User = Depends(get_current_user)):
    user_id = current_user.id

    plan = Plan(
        user_id=user_id,
        idea=payload.idea,
        context=payload.context,
        number_of_content=payload.number_of_content,
        permission=payload.permission,
        status=PlanStatus.DRAFT,
    )
    await plan.insert()

    created_items = []
    for item_data in payload.items:
        item = PlanItem(
            plan_id=plan.id,
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

    response_data = plan.model_dump(by_alias=True)
    response_data["items"] = [item.model_dump(by_alias=True) for item in created_items]
    return PlanResponse(**response_data)


@router.get("", response_model=List[PlanResponse])
async def list_plans(current_user: User = Depends(get_current_user)):
    plans = await Plan.find(
        Plan.user_id == current_user.id,
        Plan.deleted_at == None,  # noqa: E711
    ).to_list()

    result = []
    for plan in plans:
        items = await PlanItem.find(
            PlanItem.plan_id == plan.id,
            PlanItem.deleted_at == None,  # noqa: E711
        ).to_list()
        plan_dict = plan.model_dump(by_alias=True)
        plan_dict["items"] = [i.model_dump(by_alias=True) for i in items]
        result.append(PlanResponse(**plan_dict))
    return result


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(plan_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    plan = await Plan.find_one(
        Plan.id == plan_id,
        Plan.user_id == current_user.id,
        Plan.deleted_at == None,  # noqa: E711
    )
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    items = await PlanItem.find(
        PlanItem.plan_id == plan.id,
        PlanItem.deleted_at == None,  # noqa: E711
    ).to_list()

    plan_dict = plan.model_dump(by_alias=True)
    plan_dict["items"] = [i.model_dump(by_alias=True) for i in items]
    return PlanResponse(**plan_dict)
