from typing import List
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.content import Content
from app.models.prompt import Prompt
from app.models.user import User
from app.schemas.content import (
    ContentGenerateRequest,
    ContentImproveRequest,
    ContentResponse,
)
from app.schemas.prompt import PromptResponse
from app.services.content_agent import (
    run_content_generation_agent,
    run_content_improvement_agent,
)

router = APIRouter()


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
