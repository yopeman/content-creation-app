from fastapi import APIRouter
from app.api.v1.contents import router as contents_router
from app.api.v1.health import router as health_router
from app.api.v1.plans import router as plans_router
from app.api.v1.platforms import router as platforms_router
from app.api.v1.posts import router as posts_router
from app.api.v1.users import router as users_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["Health"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(platforms_router, prefix="/platforms", tags=["Platforms"])
api_router.include_router(contents_router, prefix="/contents", tags=["Contents"])
api_router.include_router(plans_router, prefix="/plans", tags=["Plans"])
api_router.include_router(posts_router, prefix="/posts", tags=["Posts"])
