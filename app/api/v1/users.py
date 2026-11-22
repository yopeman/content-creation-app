from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserStatus
from app.models.user import User
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse

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
