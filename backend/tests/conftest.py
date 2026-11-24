from typing import AsyncGenerator
from unittest.mock import patch
import pytest
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


@pytest.fixture(autouse=True)
def mock_telegram_api():
    """Mocks outbound Telegram Bot API calls to ensure test runs are fast, isolated, and offline."""
    with patch("app.api.v1.platforms.get_telegram_chat_info") as mock_info, \
         patch("app.api.v1.posts.send_telegram_post") as mock_send:
        async def fake_get_chat_info(bot_token: str, chat_id: str):
            if "invalid" in bot_token.lower():
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=400,
                    detail="Invalid Telegram Bot Token. Please check the token provided by @BotFather.",
                )
            return {
                "title": f"Telegram Channel {chat_id}",
                "type": "channel",
                "username": chat_id.lstrip("@"),
                "raw": {},
            }

        async def fake_send_post(
            bot_token: str,
            chat_id: str,
            text=None,
            media_path=None,
            media_type=None,
            scheduled_at=None,
            payload_override=None,
        ):
            if "invalid" in bot_token.lower():
                return {
                    "success": False,
                    "error": "Telegram API error: Invalid bot token",
                }
            clean_username = chat_id.lstrip("@")
            return {
                "success": True,
                "message_id": "888123",
                "external_url": f"https://t.me/{clean_username}/888123",
                "raw": {"message_id": 888123},
            }

        mock_info.side_effect = fake_get_chat_info
        mock_send.side_effect = fake_send_post
        yield mock_info


@pytest.fixture(autouse=True)
def mock_media_generators():
    """Mocks media generation tools (Pillow, gTTS, MoviePy/ffmpeg) for ultra-fast, isolated test runs."""
    with patch("app.services.content_agent.create_image_content") as mock_img, \
         patch("app.services.content_agent.create_audio_content") as mock_aud, \
         patch("app.services.content_agent.create_video_content") as mock_vid, \
         patch("app.services.content_tools.create_image_content") as mock_tools_img, \
         patch("app.services.content_tools.create_audio_content") as mock_tools_aud, \
         patch("app.services.content_tools.create_video_content") as mock_tools_vid:

        fake_image = {
            "path": "uploads/image/mock_test_image.png",
            "abs_path": str(settings.upload_path / "image" / "mock_test_image.png"),
            "url": "/uploads/image/mock_test_image.png",
            "mime_type": "image/png",
            "file_size_bytes": 1024,
            "dimensions": {"width": 1080, "height": 1080},
        }
        fake_audio = {
            "path": "uploads/audio/mock_test_audio.mp3",
            "abs_path": str(settings.upload_path / "audio" / "mock_test_audio.mp3"),
            "url": "/uploads/audio/mock_test_audio.mp3",
            "mime_type": "audio/mpeg",
            "file_size_bytes": 2048,
        }
        fake_video = {
            "path": "uploads/video/mock_test_video.mp4",
            "abs_path": str(settings.upload_path / "video" / "mock_test_video.mp4"),
            "url": "/uploads/video/mock_test_video.mp4",
            "mime_type": "video/mp4",
            "file_size_bytes": 4096,
        }

        mock_img.return_value = fake_image
        mock_tools_img.return_value = fake_image

        mock_aud.return_value = fake_audio
        mock_tools_aud.return_value = fake_audio

        mock_vid.return_value = fake_video
        mock_tools_vid.return_value = fake_video

        yield

