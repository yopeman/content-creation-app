from typing import AsyncGenerator
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.session import close_db, init_db
from app.main import app
from app.models.enums import UserStatus
from app.models.user import User

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


@pytest_asyncio.fixture
async def auth_client(async_client: AsyncClient) -> AsyncClient:
    test_email = "tester@example.com"
    user = await User.find_one(User.email == test_email)
    if not user:
        user = User(
            name="Test User",
            email=test_email,
            password_hash=hash_password("password123"),
            timezone="UTC",
            status=UserStatus.ACTIVE,
        )
        await user.insert()
    token = create_access_token(user.id)
    async_client.headers["Authorization"] = f"Bearer {token}"
    return async_client
