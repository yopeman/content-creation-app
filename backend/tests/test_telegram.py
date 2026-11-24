import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from app.core.config import settings
from app.models.enums import ContentType
from app.models.content import ContentDetail
from app.services.telegram import _resolve_local_media_path, _is_http_url, send_telegram_post


def test_is_http_url():
    assert _is_http_url("http://example.com/img.png") is True
    assert _is_http_url("https://example.com/video.mp4") is True
    assert _is_http_url("/uploads/image/test.png") is False
    assert _is_http_url("uploads/image/test.png") is False
    assert _is_http_url(None) is False
    assert _is_http_url("") is False


def test_resolve_local_media_path():
    # Create temporary dummy file in uploads/image
    img_dir = settings.upload_path / "image"
    img_dir.mkdir(parents=True, exist_ok=True)
    test_file = img_dir / "test_unit_resolve.png"
    test_file.write_bytes(b"dummy png content")

    try:
        # 1. With leading slash /uploads/image/...
        p1 = _resolve_local_media_path("/uploads/image/test_unit_resolve.png")
        assert p1 is not None
        assert p1.name == "test_unit_resolve.png"

        # 2. Relative uploads/image/...
        p2 = _resolve_local_media_path("uploads/image/test_unit_resolve.png")
        assert p2 is not None
        assert p2.name == "test_unit_resolve.png"

        # 3. Relative /image/...
        p3 = _resolve_local_media_path("/image/test_unit_resolve.png")
        assert p3 is not None
        assert p3.name == "test_unit_resolve.png"

        # 4. Basename only
        p4 = _resolve_local_media_path("test_unit_resolve.png")
        assert p4 is not None
        assert p4.name == "test_unit_resolve.png"

        # 5. Remote URL returns None (not local)
        assert _resolve_local_media_path("https://example.com/image.png") is None

        # 6. Non-existent returns None
        assert _resolve_local_media_path("/uploads/image/definitely_not_existing_12345.png") is None
    finally:
        if test_file.exists():
            test_file.unlink()


@pytest.mark.asyncio
async def test_send_telegram_post_falls_back_to_text_when_media_missing():
    # If media file does not exist locally and is not an HTTP URL:
    # it must NOT call sendPhoto with empty host URL, but instead fall back to sendMessage
    content_details = [
        ContentDetail(type=ContentType.TEXT, text="Hello Telegram World!", order=1),
        ContentDetail(type=ContentType.IMAGE, path="/uploads/image/non_existent_mock_file.png", order=2),
    ]

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "ok": True,
        "result": {
            "message_id": 999123,
            "chat": {"id": 1234567, "username": "testchannel"},
        },
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        res = await send_telegram_post(
            bot_token="test_bot_token",
            chat_id="@testchannel",
            content_details=content_details,
        )

        assert res["success"] is True
        assert res["message_id"] == "999123"

        # Verify sendPhoto was NOT called with the missing local path
        called_urls = [call.args[0] for call in mock_post.call_args_list]
        assert not any("sendPhoto" in url for url in called_urls)
        # Verify sendMessage WAS called
        assert any("sendMessage" in url for url in called_urls)


@pytest.mark.asyncio
async def test_send_telegram_post_uploads_file_when_local_path_exists():
    img_dir = settings.upload_path / "image"
    img_dir.mkdir(parents=True, exist_ok=True)
    test_file = img_dir / "test_upload_file.png"
    test_file.write_bytes(b"\x89PNG\r\n\x1a\ntest")

    try:
        content_details = [
            ContentDetail(type=ContentType.TEXT, text="Post with real image", order=1),
            ContentDetail(type=ContentType.IMAGE, path="/uploads/image/test_upload_file.png", order=2),
        ]

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "ok": True,
            "result": {
                "message_id": 888777,
                "chat": {"id": 1234567, "username": "testchannel"},
            },
        }

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response

            res = await send_telegram_post(
                bot_token="test_bot_token",
                chat_id="@testchannel",
                content_details=content_details,
            )

            assert res["success"] is True
            assert res["message_id"] == "888777"

            # Verify sendPhoto WAS called with multipart files upload
            called_urls = [call.args[0] for call in mock_post.call_args_list]
            assert any("sendPhoto" in url for url in called_urls)
            # Check files argument in call_args_list
            photo_calls = [call for call in mock_post.call_args_list if "sendPhoto" in call.args[0]]
            assert len(photo_calls) == 1
            assert "files" in photo_calls[0].kwargs
            assert "photo" in photo_calls[0].kwargs["files"]
    finally:
        if test_file.exists():
            test_file.unlink()
