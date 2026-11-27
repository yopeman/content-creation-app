import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.router import api_router
from app.core.config import settings
from app.db.session import close_db, init_db
from app.services.scheduler import scheduled_post_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize MongoDB connection & Beanie ODM models
    await init_db()
    # Ensure upload directories exist
    try:
        settings.upload_path.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    # Start background worker for scheduled posts (only when running as dedicated daemon, not serverless)
    is_serverless = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
    if not is_serverless:
        scheduled_post_worker.start()
    yield
    # Shutdown: Stop worker and cleanly disconnect from MongoDB
    if not is_serverless:
        await scheduled_post_worker.stop()
    await close_db()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Asynchronous Backend API for Content Creation, Generation, and Multi-Platform Publishing.",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve local media files (images, audio, video) statically
app.mount("/uploads", StaticFiles(directory=str(settings.upload_path)), name="uploads")

# Include API v1 Routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", summary="Root Status")
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "health_url": f"{settings.API_V1_STR}/health",
        "storage": "local",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
