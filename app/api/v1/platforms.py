from datetime import datetime, timezone
from typing import List, Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.api.deps import get_current_user
from app.models.enums import PlatformCode, PlatformStatus
from app.models.platform import Platform
from app.models.user import User
from app.schemas.platform import (
    PlatformCreate,
    PlatformResponse,
    PlatformUpdate,
    SupportedPlatform,
)

router = APIRouter()

# Registry of currently supported platforms (currently only Telegram is active)
SUPPORTED_PLATFORMS: List[SupportedPlatform] = [
    SupportedPlatform(
        code=PlatformCode.TG,
        name="Telegram",
        description="Publish messages, photos, and videos to Telegram channels and groups via Bot API.",
        is_supported=True,
        required_details=["bot_token", "chat_id"],
    )
]


@router.get("/supported", response_model=List[SupportedPlatform], summary="List Supported Platforms")
async def list_supported_platforms():
    """List all third-party platforms currently supported for connection."""
    return SUPPORTED_PLATFORMS


@router.get("", response_model=List[PlatformResponse], summary="List Connected Platforms")
async def list_connected_platforms(
    platform_status: Optional[PlatformStatus] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
):
    """List all connected platform accounts for the authenticated user."""
    query = [Platform.user_id == current_user.id, Platform.deleted_at == None]  # noqa: E711
    if platform_status is not None:
        query.append(Platform.status == platform_status)

    return await Platform.find(*query).to_list()


@router.post("", response_model=PlatformResponse, status_code=status.HTTP_201_CREATED, summary="Connect Platform")
async def connect_platform(payload: PlatformCreate, current_user: User = Depends(get_current_user)):
    """Connect a new platform account. Currently only TG (Telegram) is supported."""
    supported_codes = {sp.code for sp in SUPPORTED_PLATFORMS if sp.is_supported}
    if payload.code not in supported_codes:
        supported_str = ", ".join(code.value for code in supported_codes)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Platform '{payload.code.value}' is not supported yet. Supported platforms: {supported_str}",
        )

    platform = Platform(
        user_id=current_user.id,
        code=payload.code,
        account_name=payload.account_name,
        platform_account_id=payload.platform_account_id,
        details=payload.details,
        expires_at=payload.expires_at,
        status=payload.status,
    )
    await platform.insert()
    return platform


@router.get("/{platform_id}", response_model=PlatformResponse, summary="Get Detail Connected Platform")
async def get_platform_detail(platform_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """Get connection details for a specific connected platform."""
    platform = await Platform.find_one(
        Platform.id == platform_id,
        Platform.user_id == current_user.id,
        Platform.deleted_at == None,  # noqa: E711
    )
    if not platform:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")
    return platform


@router.patch("/{platform_id}", response_model=PlatformResponse, summary="Edit Platform Connection")
@router.put("/{platform_id}", response_model=PlatformResponse, summary="Edit Platform Connection", include_in_schema=False)
async def edit_platform_connection(
    platform_id: PydanticObjectId,
    payload: PlatformUpdate,
    current_user: User = Depends(get_current_user),
):
    """Edit connection settings, credentials, or metadata for a connected platform."""
    platform = await Platform.find_one(
        Platform.id == platform_id,
        Platform.user_id == current_user.id,
        Platform.deleted_at == None,  # noqa: E711
    )
    if not platform:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(platform, field, value)

    platform.updated_at = datetime.now(timezone.utc)
    await platform.save()
    return platform


@router.delete("/{platform_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Disconnect Platform")
async def disconnect_platform(platform_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """Disconnect and revoke access for a connected platform account."""
    platform = await Platform.find_one(
        Platform.id == platform_id,
        Platform.user_id == current_user.id,
        Platform.deleted_at == None,  # noqa: E711
    )
    if not platform:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")

    platform.status = PlatformStatus.REVOKED
    platform.deleted_at = datetime.now(timezone.utc)
    platform.updated_at = datetime.now(timezone.utc)
    await platform.save()


@router.post("/{platform_id}/disconnect", response_model=PlatformResponse, summary="Disconnect Platform (RPC)")
async def disconnect_platform_rpc(platform_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """Disconnect and revoke access for a connected platform account (returning updated record)."""
    platform = await Platform.find_one(
        Platform.id == platform_id,
        Platform.user_id == current_user.id,
        Platform.deleted_at == None,  # noqa: E711
    )
    if not platform:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")

    platform.status = PlatformStatus.REVOKED
    platform.deleted_at = datetime.now(timezone.utc)
    platform.updated_at = datetime.now(timezone.utc)
    await platform.save()
    return platform
