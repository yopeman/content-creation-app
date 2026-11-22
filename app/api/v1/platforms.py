from datetime import datetime, timezone
from typing import List, Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.api.deps import get_current_user
from app.core.security import encrypt_secret
from app.models.enums import PlatformCode, PlatformStatus
from app.models.platform import Platform
from app.models.user import User
from app.schemas.platform import (
    PlatformResponse,
    PlatformUpdate,
    SupportedPlatform,
    TelegramPlatformCreate,
    TelegramPlatformUpdate,
)
from app.services.telegram import get_telegram_chat_info

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
    """List all third-party platforms currently supported for connection (currently only TG)."""
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


@router.post("/tg", response_model=PlatformResponse, status_code=status.HTTP_201_CREATED, summary="Connect Telegram Platform")
async def connect_telegram_platform(
    payload: TelegramPlatformCreate,
    current_user: User = Depends(get_current_user),
):
    """Connect a Telegram channel or group using bot token and chat ID.

    Automatically verifies credentials with Telegram API and resolves channel name.
    """
    existing = await Platform.find_one(
        Platform.user_id == current_user.id,
        Platform.code == PlatformCode.TG,
        Platform.platform_account_id == payload.chat_id,
        Platform.deleted_at == None,  # noqa: E711
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This Telegram channel/chat is already connected.",
        )

    # Validate bot credentials and resolve channel/chat name from Telegram API
    chat_info = await get_telegram_chat_info(payload.bot_token, payload.chat_id)

    details = {
        "encrypted_bot_token": encrypt_secret(payload.bot_token),
        "chat_id": payload.chat_id,
        "type": chat_info.get("type"),
        "username": chat_info.get("username"),
    }

    platform = Platform(
        user_id=current_user.id,
        code=PlatformCode.TG,
        account_name=chat_info["title"],
        platform_account_id=payload.chat_id,
        details=details,
        status=PlatformStatus.CONNECTED,
    )
    await platform.insert()
    return platform


@router.patch("/tg/{platform_id}", response_model=PlatformResponse, summary="Edit Telegram Connection Credentials")
@router.put("/tg/{platform_id}", response_model=PlatformResponse, summary="Edit Telegram Connection Credentials", include_in_schema=False)
async def edit_telegram_platform(
    platform_id: PydanticObjectId,
    payload: TelegramPlatformUpdate,
    current_user: User = Depends(get_current_user),
):
    """Edit Telegram credentials (bot token and/or chat ID) and re-verify with Telegram API."""
    platform = await Platform.find_one(
        Platform.id == platform_id,
        Platform.user_id == current_user.id,
        Platform.deleted_at == None,  # noqa: E711
    )
    if not platform:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")

    if platform.code != PlatformCode.TG:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This connection is not a Telegram platform.")

    if not payload.bot_token and not payload.chat_id:
        return platform

    active_bot_token = payload.bot_token or platform.get_decrypted_bot_token()
    active_chat_id = payload.chat_id or platform.details.get("chat_id") or platform.platform_account_id

    if not active_bot_token or not active_chat_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incomplete Telegram credentials.")

    # If chat_id is changing, ensure user doesn't already have another active connection for it
    if payload.chat_id and payload.chat_id != platform.platform_account_id:
        existing = await Platform.find_one(
            Platform.id != platform_id,
            Platform.user_id == current_user.id,
            Platform.code == PlatformCode.TG,
            Platform.platform_account_id == payload.chat_id,
            Platform.deleted_at == None,  # noqa: E711
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Another connection already exists for this Telegram chat/channel.",
            )

    # Validate credentials & re-resolve channel title from Telegram API
    chat_info = await get_telegram_chat_info(active_bot_token, active_chat_id)

    if payload.bot_token:
        platform.details["encrypted_bot_token"] = encrypt_secret(payload.bot_token)
    if payload.chat_id:
        platform.details["chat_id"] = payload.chat_id
        platform.platform_account_id = payload.chat_id

    platform.account_name = chat_info["title"]
    platform.details["type"] = chat_info.get("type")
    platform.details["username"] = chat_info.get("username")
    platform.updated_at = datetime.now(timezone.utc)
    await platform.save()
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
    """Edit general connection metadata (e.g. account name, status) for a connected platform."""
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


@router.post("/{platform_id}/sync", response_model=PlatformResponse, summary="Sync Platform Details with Remote")
async def sync_platform(platform_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """Re-sync channel or account details from the external platform (e.g. Telegram channel title)."""
    platform = await Platform.find_one(
        Platform.id == platform_id,
        Platform.user_id == current_user.id,
        Platform.deleted_at == None,  # noqa: E711
    )
    if not platform:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")

    if platform.code == PlatformCode.TG:
        bot_token = platform.get_decrypted_bot_token()
        chat_id = platform.details.get("chat_id") or platform.platform_account_id
        if not bot_token or not chat_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Telegram credentials to sync.")

        chat_info = await get_telegram_chat_info(bot_token, chat_id)
        platform.account_name = chat_info["title"]
        platform.details["type"] = chat_info.get("type")
        platform.details["username"] = chat_info.get("username")
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
