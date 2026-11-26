from datetime import datetime, timezone
import secrets
from typing import Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, status
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_claim_token,
    decode_claim_token,
    hash_password,
)
from app.models.content import Content, ContentDetail
from app.models.enums import PlatformStatus, UserStatus
from app.models.platform import Platform
from app.models.user import User
from app.schemas.integration import (
    ClaimTicketRequest,
    ClaimTicketResponse,
    IngestContentRequest,
    IngestContentResponse,
    OnboardingStatus,
)
from app.schemas.user import UserResponse

router = APIRouter()


async def verify_integration_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
) -> None:
    """Verifies that incoming server-to-server request provides the valid INTEGRATION_API_KEY."""
    candidate_key = x_api_key
    if not candidate_key and authorization and authorization.startswith("Bearer "):
        candidate_key = authorization.split("Bearer ", 1)[1].strip()

    configured_key = settings.INTEGRATION_API_KEY
    if not configured_key or not candidate_key or not secrets.compare_digest(candidate_key, configured_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing integration API key (X-API-Key header).",
        )


@router.post(
    "/contents",
    response_model=IngestContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest Content from External Project",
    dependencies=[Depends(verify_integration_api_key)],
)
@router.post(
    "/content",
    response_model=IngestContentResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
    dependencies=[Depends(verify_integration_api_key)],
)
@router.post(
    "/users",
    response_model=IngestContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision or Authenticate User from External Project",
    dependencies=[Depends(verify_integration_api_key)],
)
@router.post(
    "/user",
    response_model=IngestContentResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
    dependencies=[Depends(verify_integration_api_key)],
)
async def ingest_content(payload: IngestContentRequest):
    """Ingests content or user from external projects.

    Checks if user with email exists. If not, auto-provisions user with needs_password=True.
    If content is provided, creates content and returns a view link to /contents/{id}.
    If content is omitted, returns a view link directly to / (dashboard root).
    """
    clean_email = payload.email.strip().lower()
    user = await User.find_one(User.email == clean_email, User.deleted_at == None)  # noqa: E711

    is_new_user = False
    if not user:
        # Auto-create user with a secure random hash and flag for password creation
        random_pw = secrets.token_urlsafe(32)
        user_name = payload.name.strip() if payload.name and payload.name.strip() else clean_email.split("@")[0]
        user = User(
            name=user_name,
            email=clean_email,
            password_hash=hash_password(random_pw),
            needs_password=True,
            status=UserStatus.ACTIVE,
        )
        await user.insert()
        is_new_user = True

    content_id = None
    if payload.content:
        # Build Content details
        content_details = [
            ContentDetail(
                type=item.type,
                path=item.path,
                text=item.text,
                script=item.script,
                order=item.order or (idx + 1),
                mime_type=item.mime_type,
                file_size_bytes=item.file_size_bytes,
                duration_seconds=item.duration_seconds,
                dimensions=item.dimensions,
            )
            for idx, item in enumerate(payload.content.details)
        ]

        content = Content(
            user_id=user.id,
            title=payload.content.title,
            status=payload.content.status,
            details=content_details,
        )
        await content.insert()
        content_id = str(content.id)

    # Generate claim token
    claim_token = create_claim_token(user_id=str(user.id), content_id=content_id)

    frontend_base = settings.FRONTEND_URL.rstrip("/")
    if content_id:
        view_url = f"{frontend_base}/contents/{content_id}?claim_token={claim_token}"
    else:
        view_url = f"{frontend_base}/?claim_token={claim_token}"

    return IngestContentResponse(
        content_id=content_id,
        user_id=str(user.id),
        is_new_user=is_new_user,
        claim_token=claim_token,
        view_url=view_url,
    )


@router.post(
    "/claim-ticket",
    response_model=ClaimTicketResponse,
    summary="Claim Temporary Ingestion Ticket into User Session",
)
async def claim_ticket(payload: ClaimTicketRequest):
    """Exchanges a short-lived claim ticket into an authenticated user JWT session and returns onboarding state."""
    try:
        decoded = decode_claim_token(payload.claim_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired claim token.",
        )

    user_id_str = decoded.get("sub")
    content_id_str = decoded.get("content_id")
    if not user_id_str:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed claim token.")

    user = await User.find_one(
        User.id == PydanticObjectId(user_id_str),
        User.deleted_at == None,  # noqa: E711
    )
    if not user or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found or inactive.")

    # Check connected channels count
    active_platforms_count = await Platform.find(
        Platform.user_id == user.id,
        Platform.status == PlatformStatus.CONNECTED,
        Platform.deleted_at == None,  # noqa: E711
    ).count()

    access_token = create_access_token(user.id)

    onboarding = OnboardingStatus(
        needs_password=bool(user.needs_password),
        has_connected_channel=active_platforms_count > 0,
    )

    return ClaimTicketResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        content_id=content_id_str,
        onboarding=onboarding,
    )
        has_connected_channel=active_platforms_count > 0,
    )

    return ClaimTicketResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        content_id=content_id_str,
        onboarding=onboarding,
    )
