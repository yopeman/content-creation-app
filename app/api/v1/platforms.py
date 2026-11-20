from datetime import datetime, timezone
from typing import List
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.enums import PlatformStatus
from app.models.platform import Platform
from app.models.user import User
from app.schemas.platform import PlatformCreate, PlatformResponse, PlatformUpdate

router = APIRouter()


@router.post("", response_model=PlatformResponse, status_code=status.HTTP_201_CREATED)
async def connect_platform(payload: PlatformCreate, current_user: User = Depends(get_current_user)):
    user_id = payload.user_id or current_user.id

    platform = Platform(
        user_id=user_id,
        code=payload.code,
        account_name=payload.account_name,
        platform_account_id=payload.platform_account_id,
        details=payload.details,
        expires_at=payload.expires_at,
        status=payload.status,
    )
    await platform.insert()
    return platform


@router.get("", response_model=List[PlatformResponse])
async def list_platforms(current_user: User = Depends(get_current_user)):
    return await Platform.find(
        Platform.user_id == current_user.id,
        Platform.deleted_at == None,  # noqa: E711
    ).to_list()


@router.get("/{platform_id}", response_model=PlatformResponse)
async def get_platform(platform_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    platform = await Platform.get(platform_id)
    if not platform or platform.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")
    return platform


@router.delete("/{platform_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_platform(platform_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    platform = await Platform.get(platform_id)
    if not platform or platform.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")
    platform.status = PlatformStatus.REVOKED
    platform.deleted_at = datetime.now(timezone.utc)
    await platform.save()
