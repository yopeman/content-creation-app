from typing import Optional
from fastapi import Depends, Header, HTTPException, status
import jwt
from app.core.config import settings
from app.models.enums import UserStatus
from app.models.user import User


async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    """Retrieves authenticated user from JWT Bearer token, or defaults to a local dev user for easy local prototyping."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
            user = await User.get(user_id)
            if not user or user.deleted_at is not None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            return user
        except jwt.PyJWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

    # Local development fallback user: Ensures endpoints work immediately in Swagger UI
    dev_email = "dev@example.com"
    dev_user = await User.find_one(User.email == dev_email)
    if not dev_user:
        dev_user = User(
            name="Developer User",
            email=dev_email,
            timezone="UTC",
            status=UserStatus.ACTIVE,
        )
        await dev_user.insert()
    return dev_user
