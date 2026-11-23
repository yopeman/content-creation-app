import os
from fastapi import APIRouter
from app.core.config import settings
from app.db.session import ping_db

router = APIRouter()


@router.get("/health", summary="System Health & Database Ping")
async def health_check():
    db_status = "healthy"
    ping_ms = None
    try:
        ping_ms = await ping_db()
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    storage_writable = settings.upload_path.exists() and os.access(settings.upload_path, os.W_OK)

    return {
        "status": "online" if db_status == "healthy" else "degraded",
        "app_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": {
            "type": "mongodb",
            "name": settings.DATABASE_NAME,
            "status": db_status,
            "ping_ms": ping_ms,
        },
        "storage": {
            "type": "local",
            "upload_dir": str(settings.upload_path),
            "writable": storage_writable,
        },
    }

