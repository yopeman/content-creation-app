from typing import List
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.enums import PostStatus
from app.models.post import Post
from app.models.post_target import PostTarget
from app.models.user import User
from app.schemas.post import PostCreate, PostResponse, PostTargetResponse

router = APIRouter()


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(payload: PostCreate, current_user: User = Depends(get_current_user)):
    user_id = current_user.id

    post = Post(
        user_id=user_id,
        content_id=payload.content_id,
        plan_item_id=payload.plan_item_id,
        scheduled_at=payload.scheduled_at,
        status=payload.status,
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
        )
        await target.insert()
        created_targets.append(target)

    post_dict = post.model_dump(by_alias=True)
    post_dict["targets"] = [t.model_dump(by_alias=True) for t in created_targets]
    return PostResponse(**post_dict)


@router.get("", response_model=List[PostResponse])
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


@router.get("/{post_id}", response_model=PostResponse)
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
