from datetime import datetime, timezone
from typing import List, Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.campaign import Campaign
from app.models.content import Content
from app.models.enums import CampaignStatus, ContentType, PlanStatus
from app.models.plan import Plan
from app.models.prompt import Prompt
from app.models.user import User
from app.schemas.campaign import (
    CampaignGenerateRequest,
    CampaignResponse,
)
from app.schemas.content import (
    ContentGenerateRequest,
    ContentImproveRequest,
    ContentResponse,
)
from app.schemas.plan import (
    LegacyPlanResponse,
    PlanGenerateRequest,
    PlanResponse,
)
from app.schemas.prompt import PromptResponse
from app.services.content_agent import (
    run_campaign_generation_agent,
    run_content_generation_agent,
    run_content_improvement_agent,
    run_plan_generation_agent,
)

router = APIRouter()


# -------------------------------------------------------------------------
# 1. Content Generation & Improvement
# -------------------------------------------------------------------------

@router.post(
    "",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Content with Tools",
)
@router.post(
    "/generate",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Content with Tools",
    include_in_schema=False,
)
@router.post(
    "/content",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Content with Tools",
)
async def generate_content(
    payload: ContentGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generates multi-modal content (text, image via Pillow, audio via gTTS, and video via MoviePy/ffmpeg) using LangChain with Groq.

    Saves sub-prompts in ContentDetail.script, local paths in ContentDetail.path, and content text in ContentDetail.text.
    Logs execution in the Prompt collection.
    If content_id is provided, continues the prompt chain to improve existing content.
    """
    if payload.content_id:
        content, _ = await run_content_improvement_agent(
            user_id=current_user.id,
            content_id=payload.content_id,
            instruction=payload.prompt,
            target_formats=payload.formats,
            parent_prompt_id=payload.parent_prompt_id,
        )
        return content

    content, _ = await run_content_generation_agent(
        user_id=current_user.id,
        prompt=payload.prompt,
        title=payload.title,
        campaign_id=payload.campaign_id,
        plan_id=payload.plan_id,
        plan_item_id=payload.plan_item_id,
        target_formats=payload.formats,
        parent_prompt_id=payload.parent_prompt_id,
    )
    return content


@router.post(
    "/{content_id}/improve",
    response_model=ContentResponse,
    summary="Improve Content via Prompt Chain",
)
async def improve_content(
    content_id: PydanticObjectId,
    payload: ContentImproveRequest,
    current_user: User = Depends(get_current_user),
):
    """Iteratively improves existing content by continuing the LangChain prompt chain.

    Feeds conversational history from parent prompts into ChatGroq, refines post copy,
    and updates/regenerates requested media formats (image, audio, video).
    """
    content, _ = await run_content_improvement_agent(
        user_id=current_user.id,
        content_id=content_id,
        instruction=payload.instruction,
        target_formats=payload.formats,
        parent_prompt_id=payload.parent_prompt_id,
    )
    return content


@router.get(
    "/{content_id}/chain",
    response_model=List[PromptResponse],
    summary="Get Content Prompt Chain",
)
async def get_content_prompt_chain(
    content_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Retrieves all prompts executed in the chain for this content document in chronological order."""
    content = await Content.find_one(
        Content.id == content_id,
        Content.user_id == current_user.id,
        Content.deleted_at == None,  # noqa: E711
    )
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    return await Prompt.find(
        Prompt.content_id == content_id,
        Prompt.user_id == current_user.id,
        Prompt.deleted_at == None,  # noqa: E711
    ).sort("created_at").to_list()


# -------------------------------------------------------------------------
# 2. Campaign AI Generation & AI Generation Loop
# -------------------------------------------------------------------------

@router.post(
    "/campaign",
    response_model=CampaignResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Campaign with Plans",
)
async def generate_campaign(
    payload: CampaignGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generates an editorial campaign with plan breakdown.

    If `generate_contents=True`, it automatically executes the AI generation loop
    to generate content for every created plan.
    """
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

    if payload.generate_contents:
        # Run AI Generation Loop over each plan
        for plan in plans:
            content, _ = await run_content_generation_agent(
                user_id=current_user.id,
                prompt=plan.idea,
                title=plan.idea[:60],
                campaign_id=campaign.id,
                plan_id=campaign.id,
                plan_item_id=plan.id,
                target_formats=plan.formats or None,
            )
            plan.content_id = content.id
            plan.status = PlanStatus.READY
            plan.updated_at = datetime.now(timezone.utc)
            await plan.save()

        # Refresh plans from DB
        plans = await Plan.find(
            Plan.campaign_id == campaign.id,
            Plan.deleted_at == None,  # noqa: E711
        ).to_list()

    response_data = campaign.model_dump(by_alias=True)
    response_data["plans"] = [p.model_dump(by_alias=True) for p in plans]
    response_data["items"] = response_data["plans"]
    return CampaignResponse(**response_data)


@router.post(
    "/campaign/{campaign_id}/loop",
    response_model=CampaignResponse,
    status_code=status.HTTP_200_OK,
    summary="Run AI Generation Loop for Existing Campaign",
)
@router.post(
    "/campaigns/{campaign_id}/loop",
    response_model=CampaignResponse,
    status_code=status.HTTP_200_OK,
    summary="Run AI Generation Loop for Existing Campaign",
    include_in_schema=False,
)
async def run_campaign_generation_loop(
    campaign_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Executes the AI Generation Loop across all plans of an existing campaign.

    Generates multi-modal content for each plan that does not have content yet,
    links the generated content, and marks plans and campaign as READY.
    """
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

    for plan in plans:
        if not plan.content_id:
            content, _ = await run_content_generation_agent(
                user_id=current_user.id,
                prompt=plan.idea,
                title=plan.idea[:60],
                campaign_id=campaign.id,
                plan_id=campaign.id,
                plan_item_id=plan.id,
                target_formats=plan.formats or None,
            )
            plan.content_id = content.id
            plan.status = PlanStatus.READY
            plan.updated_at = datetime.now(timezone.utc)
            await plan.save()

    campaign.status = CampaignStatus.READY
    campaign.updated_at = datetime.now(timezone.utc)
    await campaign.save()

    refreshed_plans = await Plan.find(
        Plan.campaign_id == campaign.id,
        Plan.deleted_at == None,  # noqa: E711
    ).to_list()

    camp_dict = campaign.model_dump(by_alias=True)
    camp_dict["plans"] = [p.model_dump(by_alias=True) for p in refreshed_plans]
    camp_dict["items"] = camp_dict["plans"]
    return CampaignResponse(**camp_dict)


# -------------------------------------------------------------------------
# 3. Plan AI Generation & Single Plan Content Generation
# -------------------------------------------------------------------------

@router.post(
    "/plan",
    response_model=LegacyPlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Campaign Plan (Legacy Format)",
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
    "/plans/{plan_id}/content",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Content for a Specific Plan",
)
@router.post(
    "/plan/{plan_id}/content",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Content for a Specific Plan",
    include_in_schema=False,
)
@router.post(
    "/plans/{plan_id}/generate-content",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Content for a Specific Plan",
    include_in_schema=False,
)
@router.post(
    "/campaigns/{campaign_id}/plans/{plan_id}/generate-content",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AI Generate Content for a Plan under Campaign",
    include_in_schema=False,
)
async def generate_plan_content(
    plan_id: PydanticObjectId,
    campaign_id: Optional[PydanticObjectId] = None,
    current_user: User = Depends(get_current_user),
):
    """Generates multi-modal content specifically for a plan, logging a Prompt with type=PromptType.PLAN_ITEM."""
    plan = await Plan.find_one(
        Plan.id == plan_id,
        Plan.user_id == current_user.id,
        Plan.deleted_at == None,  # noqa: E711
    )
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    parent_id = campaign_id or plan.campaign_id or plan.plan_id
    content, _ = await run_content_generation_agent(
        user_id=current_user.id,
        prompt=plan.idea,
        title=plan.idea[:60],
        campaign_id=parent_id,
        plan_id=parent_id,
        plan_item_id=plan.id,
        target_formats=plan.formats or None,
    )
    return content
