from typing import AsyncGenerator
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
from app.db.session import close_db, init_db, motor_client
from app.main import app

# Ensure tests use a dedicated test database
settings.DATABASE_NAME = "content_creation_test_db"


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    client = await init_db()
    yield
    # Clean up test database
    if client:
        await client.drop_database("content_creation_test_db")
    await close_db()


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

