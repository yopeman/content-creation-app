from datetime import datetime, timezone
from typing import List
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from app.api.deps import get_current_user
from app.models.content import Content, ContentDetail
from app.models.enums import ContentType
from app.models.prompt import Prompt
from app.models.user import User
from app.schemas.content import (
    ContentCreate,
    ContentGenerateRequest,
    ContentImproveRequest,
    ContentResponse,
    ContentUpdate,
)
from app.schemas.prompt import PromptResponse
from app.services.content_agent import (
    run_content_generation_agent,
    run_content_improvement_agent,
)
from app.services.storage import storage_service

router = APIRouter()


@router.post("/upload-media", summary="Upload media file to local storage")
async def upload_media(
    file: UploadFile = File(...),
    media_type: ContentType = Form(...),
    current_user: User = Depends(get_current_user),
):
    """Uploads a local media file (image, audio, video) and returns its storage path and web URL."""
    result = await storage_service.save_file(file, subfolder=media_type.value)
    return {
        "status": "success",
        "detail": {
            "type": media_type,
            "path": result["path"],
            "url": result["url"],
            "mime_type": result["mime_type"],
            "file_size_bytes": result["file_size_bytes"],
            "original_filename": result["original_filename"],
        },
    }


@router.post("/generate", response_model=ContentResponse, status_code=status.HTTP_201_CREATED, summary="AI Generate Content with Tools")
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


@router.post("/{content_id}/improve", response_model=ContentResponse, summary="Improve Content via Prompt Chain")
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


@router.get("/{content_id}/chain", response_model=List[PromptResponse], summary="Get Content Prompt Chain")
async def get_content_prompt_chain(
    content_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Retrieves all prompts executed in the chain for this content document in chronological order."""
    content = await Content.get(content_id)
    if not content or content.deleted_at is not None or content.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    return await Prompt.find(
        Prompt.content_id == content_id,
        Prompt.user_id == current_user.id,
        Prompt.deleted_at == None,
    ).sort("created_at").to_list()


@router.post("", response_model=ContentResponse, status_code=status.HTTP_201_CREATED)
async def create_content(payload: ContentCreate, current_user: User = Depends(get_current_user)):
    user_id = payload.user_id or current_user.id
    details = [ContentDetail(**d.model_dump()) for d in payload.details]

    content = Content(
        user_id=user_id,
        title=payload.title,
        details=details,
        status=payload.status,
    )
    await content.insert()
    return content


@router.get("", response_model=List[ContentResponse])
async def list_contents(current_user: User = Depends(get_current_user)):
    return await Content.find(
        Content.user_id == current_user.id,
        Content.deleted_at == None,  # noqa: E711
    ).to_list()


@router.get("/{content_id}", response_model=ContentResponse)
async def get_content(content_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    content = await Content.get(content_id)
    if not content or content.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    return content


@router.put("/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: PydanticObjectId,
    payload: ContentUpdate,
    current_user: User = Depends(get_current_user),
):
    content = await Content.get(content_id)
    if not content or content.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    if payload.title is not None:
        content.title = payload.title
    if payload.status is not None:
        content.status = payload.status
    if payload.details is not None:
        content.details = [ContentDetail(**d.model_dump()) for d in payload.details]

    content.updated_at = datetime.now(timezone.utc)
    await content.save()
    return content


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content(content_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    content = await Content.get(content_id)
    if not content or content.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    content.deleted_at = datetime.now(timezone.utc)
    await content.save()
