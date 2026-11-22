from typing import List, Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.api.deps import get_current_user
from app.models.enums import PromptStatus, PromptType
from app.models.prompt import Prompt
from app.models.user import User
from app.schemas.prompt import PromptResponse

router = APIRouter()


@router.get("", response_model=List[PromptResponse], summary="List User Prompts")
async def list_prompts(
    prompt_type: Optional[PromptType] = Query(None, alias="type"),
    prompt_status: Optional[PromptStatus] = Query(None, alias="status"),
    content_id: Optional[PydanticObjectId] = Query(None),
    plan_id: Optional[PydanticObjectId] = Query(None),
    plan_item_id: Optional[PydanticObjectId] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Lists prompts executed by the user with optional filters."""
    query = [Prompt.user_id == current_user.id, Prompt.deleted_at == None]  # noqa: E711
    if prompt_type:
        query.append(Prompt.type == prompt_type)
    if prompt_status:
        query.append(Prompt.status == prompt_status)
    if content_id:
        query.append(Prompt.content_id == content_id)
    if plan_id:
        query.append(Prompt.plan_id == plan_id)
    if plan_item_id:
        query.append(Prompt.plan_item_id == plan_item_id)

    return await Prompt.find(*query).sort("-created_at").to_list()


@router.get("/{prompt_id}", response_model=PromptResponse, summary="Get Prompt Details")
async def get_prompt(prompt_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """Retrieves execution details, model, token count, and response for a specific prompt."""
    prompt_record = await Prompt.find_one(
        Prompt.id == prompt_id,
        Prompt.user_id == current_user.id,
        Prompt.deleted_at == None,  # noqa: E711
    )
    if not prompt_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt record not found")
    return prompt_record
