from datetime import datetime, timezone
from typing import List
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.content import Content
from app.models.enums import ContentType, PlatformCode, PostStatus, PostTargetStatus
from app.models.plan_item import PlanItem
from app.models.platform import Platform
from app.models.post import Post
from app.models.post_target import PostTarget
from app.models.user import User
from app.schemas.post import PostCreate, PostResponse, PostTargetResponse
from app.services.telegram import send_telegram_post

router = APIRouter()


async def dispatch_post_target(
    target: PostTarget,
    post: Post,
    content: Content,
    user: User,
) -> PostTarget:
    """Dispatches a single post target to the destination platform (currently Telegram).

    Delegates scheduling to the target social media platform.
    """
    if target.platform_code != PlatformCode.TG:
        target.status = PostTargetStatus.FAILED
        target.error = f"Platform '{target.platform_code.value}' is not supported yet."
        target.updated_at = datetime.now(timezone.utc)
        await target.save()
        return target

    # 1. Fetch connected platform and credentials
    platform = await Platform.find_one(
        Platform.id == target.platform_id,
        Platform.user_id == user.id,
        Platform.deleted_at == None,  # noqa: E711
    )
    if not platform:
        target.status = PostTargetStatus.FAILED
        target.error = "Connected platform not found or unauthorized."
        target.updated_at = datetime.now(timezone.utc)
        await target.save()
        return target

    bot_token = platform.get_decrypted_bot_token()
    chat_id = platform.details.get("chat_id") or platform.platform_account_id
    if not bot_token or not chat_id:
        target.status = PostTargetStatus.FAILED
        target.error = "Incomplete Telegram credentials (missing bot_token or chat_id)."
        target.updated_at = datetime.now(timezone.utc)
        await target.save()
        return target

    # 2. Extract content text and media
    override = target.payload_override or {}
    text_content = override.get("text") or override.get("caption")

    if not text_content:
        text_details = [d for d in content.details if d.type == ContentType.TEXT and d.text]
        if text_details:
            text_content = "\n\n".join(d.text for d in text_details)
        else:
            text_content = content.title

    # Extract media: prioritize video, then image, then audio
    media_path = None
    media_type = None

    for candidate_type in [ContentType.VIDEO, ContentType.IMAGE, ContentType.AUDIO]:
        matching = [d for d in content.details if d.type == candidate_type and d.path]
        if matching:
            media_path = matching[0].path
            media_type = candidate_type
            break

    scheduled_at = target.scheduled_at or post.scheduled_at

    # 3. Call Telegram API
    target.status = PostTargetStatus.PUBLISHING
    target.attempts += 1
    target.updated_at = datetime.now(timezone.utc)
    await target.save()

    result = await send_telegram_post(
        bot_token=bot_token,
        chat_id=chat_id,
        text=text_content,
        media_path=media_path,
        media_type=media_type,
        scheduled_at=scheduled_at,
        payload_override=override,
    )

    if result.get("success"):
        target.status = PostTargetStatus.PUBLISHED
        target.external_post_id = result.get("message_id")
        target.external_url = result.get("external_url")
        target.published_at = datetime.now(timezone.utc)
        target.error = None
    else:
        target.status = PostTargetStatus.FAILED
        target.error = result.get("error", "Unknown dispatch failure")

    target.updated_at = datetime.now(timezone.utc)
    await target.save()
    return target


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED, summary="Create & Dispatch Post")
async def create_post(payload: PostCreate, current_user: User = Depends(get_current_user)):
    user_id = current_user.id

    # 1. Validate content exists and belongs to current user
    content = await Content.find_one(
        Content.id == payload.content_id,
        Content.user_id == user_id,
        Content.deleted_at == None,  # noqa: E711
    )
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    # 2. Validate plan or plan_item if provided
    target_plan_id = payload.plan_item_id or payload.plan_id
    if target_plan_id:
        plan_item = await PlanItem.find_one(
            PlanItem.id == target_plan_id,
            PlanItem.user_id == user_id,
            PlanItem.deleted_at == None,  # noqa: E711
        )
        if not plan_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan item not found")

    # Resolve initial post status
    target_statuses = [t.status.lower() for t in payload.targets if t.status]
    has_target_scheduled = any(t.scheduled_at for t in payload.targets)

    if payload.status is not None:
        initial_status = payload.status
        if initial_status == PostStatus.DRAFT and (payload.scheduled_at or has_target_scheduled):
            initial_status = PostStatus.SCHEDULED
    elif "published" in target_statuses:
        initial_status = PostStatus.PUBLISHED
    elif "scheduled" in target_statuses or payload.scheduled_at or has_target_scheduled:
        initial_status = PostStatus.SCHEDULED
    elif payload.targets:
        initial_status = PostStatus.PUBLISHED
    else:
        initial_status = PostStatus.DRAFT

    post = Post(
        user_id=user_id,
        content_id=payload.content_id,
        campaign_id=payload.campaign_id,
        plan_id=target_plan_id,
        plan_item_id=target_plan_id,
        scheduled_at=payload.scheduled_at,
        status=initial_status,
    )
    await post.insert()

    created_targets = []
    for target_data in payload.targets:
        target = PostTarget(
            post_id=post.id,
            user_id=user_id,
            platform_id=target_data.platform_id,
            platform_code=target_data.platform_code,
            scheduled_at=target_data.scheduled_at or payload.scheduled_at,
            payload_override=target_data.payload_override,
            status=PostTargetStatus.PENDING,
        )
        await target.insert()
        created_targets.append(target)

    # 3. If post status is not DRAFT, dispatch immediately to the target platform (TG)
    if initial_status != PostStatus.DRAFT and created_targets:
        dispatched_targets = []
        for t in created_targets:
            updated_t = await dispatch_post_target(
                target=t,
                post=post,
                content=content,
                user=current_user,
            )
            dispatched_targets.append(updated_t)
        created_targets = dispatched_targets

        # Update post aggregate status
        statuses = [t.status for t in created_targets]
        if all(s == PostTargetStatus.PUBLISHED for s in statuses):
            post.status = (
                PostStatus.SCHEDULED
                if (payload.scheduled_at or payload.status == PostStatus.SCHEDULED)
                else PostStatus.PUBLISHED
            )
        elif any(s == PostTargetStatus.PUBLISHED for s in statuses):
            post.status = PostStatus.PARTIAL
        else:
            post.status = PostStatus.FAILED

        post.updated_at = datetime.now(timezone.utc)
        await post.save()

    post_dict = post.model_dump(by_alias=True)
    post_dict["targets"] = [t.model_dump(by_alias=True) for t in created_targets]
    return PostResponse(**post_dict)


@router.post("/{post_id}/publish", response_model=PostResponse, summary="Publish Post to Connected Platforms")
async def publish_post(post_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """Dispatches all pending or draft targets of a post to the connected social platforms."""
    post = await Post.find_one(
        Post.id == post_id,
        Post.user_id == current_user.id,
        Post.deleted_at == None,  # noqa: E711
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    content = await Content.find_one(
        Content.id == post.content_id,
        Content.user_id == current_user.id,
        Content.deleted_at == None,  # noqa: E711
    )
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked content not found")

    targets = await PostTarget.find(
        PostTarget.post_id == post.id,
        PostTarget.user_id == current_user.id,
        PostTarget.deleted_at == None,  # noqa: E711
    ).to_list()

    dispatched = []
    for t in targets:
        if t.status in [PostTargetStatus.PENDING, PostTargetStatus.FAILED]:
            updated_t = await dispatch_post_target(
                target=t,
                post=post,
                content=content,
                user=current_user,
            )
            dispatched.append(updated_t)
        else:
            dispatched.append(t)

    statuses = [t.status for t in dispatched]
    if all(s == PostTargetStatus.PUBLISHED for s in statuses):
        post.status = PostStatus.SCHEDULED if post.scheduled_at else PostStatus.PUBLISHED
    elif any(s == PostTargetStatus.PUBLISHED for s in statuses):
        post.status = PostStatus.PARTIAL
    else:
        post.status = PostStatus.FAILED

    post.updated_at = datetime.now(timezone.utc)
    await post.save()

    post_dict = post.model_dump(by_alias=True)
    post_dict["targets"] = [t.model_dump(by_alias=True) for t in dispatched]
    return PostResponse(**post_dict)


@router.get("", response_model=List[PostResponse], summary="List User Posts")
async def list_posts(current_user: User = Depends(get_current_user)):
    posts = await Post.find(
        Post.user_id == current_user.id,
        Post.deleted_at == None,  # noqa: E711
    ).to_list()

    result = []
    for post in posts:
        targets = await PostTarget.find(
            PostTarget.post_id == post.id,
            PostTarget.deleted_at == None,  # noqa: E711
        ).to_list()
        post_dict = post.model_dump(by_alias=True)
        post_dict["targets"] = [t.model_dump(by_alias=True) for t in targets]
        result.append(PostResponse(**post_dict))
    return result


@router.get("/{post_id}", response_model=PostResponse, summary="Get Post Details")
async def get_post(post_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    post = await Post.find_one(
        Post.id == post_id,
        Post.user_id == current_user.id,
        Post.deleted_at == None,  # noqa: E711
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    targets = await PostTarget.find(
        PostTarget.post_id == post.id,
        PostTarget.deleted_at == None,  # noqa: E711
    ).to_list()

    post_dict = post.model_dump(by_alias=True)
    post_dict["targets"] = [t.model_dump(by_alias=True) for t in targets]
    return PostResponse(**post_dict)
