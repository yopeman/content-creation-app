from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserStatus
from app.models.user import User
from app.schemas.user import (
    TokenResponse,
    UserCreate,
    UserLogin,
    UserPasswordChange,
    UserProfileUpdate,
    UserResponse,
    UserSetInitialPassword,
    UserUpdate,
)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def register(payload: UserCreate):
    existing = await User.find_one(User.email == payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        timezone=payload.timezone,
        status=payload.status,
    )
    await user.insert()
    return user


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    user = await User.find_one(User.email == payload.email, User.deleted_at == None)  # noqa: E711
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or suspended",
        )

    access_token = create_access_token(subject=str(user.id))
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user, from_attributes=True),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse, summary="Update Current User Profile")
@router.put("/me", response_model=UserResponse, summary="Update Current User Profile", include_in_schema=False)
async def update_me(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
):
    if payload.name is not None:
        cleaned_name = payload.name.strip()
        if not cleaned_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot be empty.",
            )
        current_user.name = cleaned_name

    if payload.email is not None and payload.email != current_user.email:
        existing = await User.find_one(User.email == payload.email, User.id != current_user.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists.",
            )
        current_user.email = payload.email

    if payload.timezone is not None:
        cleaned_tz = payload.timezone.strip()
        try:
            ZoneInfo(cleaned_tz)
        except (ZoneInfoNotFoundError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timezone.",
            )
        current_user.timezone = cleaned_tz

    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()
    return current_user


@router.post("/me/set-initial-password", summary="Set Initial Password for Auto-Created User")
async def set_initial_password(
    payload: UserSetInitialPassword,
    current_user: User = Depends(get_current_user),
):
    """Sets initial password for users auto-created via external integration claims."""
    current_user.password_hash = hash_password(payload.new_password)
    current_user.needs_password = False
    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()
    return {"message": "Password set successfully."}


@router.post("/me/password", summary="Change Current User Password")
@router.patch("/me/password", summary="Change Current User Password", include_in_schema=False)
async def change_password(
    payload: UserPasswordChange,
    current_user: User = Depends(get_current_user),
):
    if current_user.needs_password or not current_user.password_hash:
        current_user.password_hash = hash_password(payload.new_password)
        current_user.needs_password = False
        current_user.updated_at = datetime.now(timezone.utc)
        await current_user.save()
        return {"message": "Password updated successfully."}

    if not current_user.password_hash or not verify_password(
        payload.current_password, current_user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if payload.new_password == payload.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password.",
        )

    current_user.password_hash = hash_password(payload.new_password)
    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()
    return {"message": "Password updated successfully."}
