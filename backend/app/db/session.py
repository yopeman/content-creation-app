import time
from typing import Optional
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.models import __all_models__

# Motor 3.7+ compatibility with Beanie 2.2+: delegate append_metadata to underlying pymongo client
if not hasattr(AsyncIOMotorClient, "append_metadata"):
    setattr(
        AsyncIOMotorClient,
        "append_metadata",
        lambda self, meta: self.delegate.append_metadata(meta),
    )

motor_client: Optional[AsyncIOMotorClient] = None


async def init_db() -> AsyncIOMotorClient:
    global motor_client
    motor_client = AsyncIOMotorClient(settings.MONGODB_URL)
    database = motor_client[settings.DATABASE_NAME]
    await init_beanie(
        database=database,
        document_models=__all_models__,
    )
    return motor_client


async def close_db():
    global motor_client
    if motor_client:
        motor_client.close()
        motor_client = None


async def ping_db() -> float:
    """Returns roundtrip ping in milliseconds, or raises an exception if unreachable."""
    global motor_client
    if not motor_client:
        raise RuntimeError("Database client not initialized")
    start = time.perf_counter()
    await motor_client.admin.command("ping")
    return round((time.perf_counter() - start) * 1000, 2)
