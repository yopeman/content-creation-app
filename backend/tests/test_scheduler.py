from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient

from app.models.enums import PostStatus, PostTargetStatus
from app.models.post import Post
from app.models.post_target import PostTarget
from app.services.scheduler import scheduled_post_worker


@pytest.mark.asyncio
async def test_scheduled_post_creation_holds_until_due(auth_client: AsyncClient):
    # 1. Connect Telegram platform
    platform_resp = await auth_client.post(
        "/api/v1/platforms/tg",
        json={
            "bot_token": "123456:SCHEDULER-TEST-TOKEN",
            "chat_id": "@test_channel",
        },
    )
    assert platform_resp.status_code == 201
    platform_id = platform_resp.json()["_id"]

    # 2. Create multimodal content (text + image + audio + video)
    content_resp = await auth_client.post(
        "/api/v1/contents",
        json={
            "title": "Multimodal Scheduled Announcement",
            "details": [
                {"type": "text", "text": "Exciting product launch coming today!", "order": 1},
                {"type": "image", "url": "/uploads/image/launch_banner.png", "order": 2},
                {"type": "audio", "url": "/uploads/audio/podcast_preview.mp3", "order": 3},
                {"type": "video", "url": "/uploads/video/demo_reel.mp4", "order": 4},
            ],
            "status": "ready",
        },
    )
    assert content_resp.status_code == 201
    content_id = content_resp.json()["_id"]

    # 3. Schedule for future (2 hours ahead)
    future_time = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    post_resp = await auth_client.post(
        "/api/v1/posts",
        json={
            "content_id": content_id,
            "scheduled_at": future_time,
            "targets": [
                {
                    "platform_id": platform_id,
                    "platform_code": "TG",
                }
            ],
        },
    )
    assert post_resp.status_code == 201
    post_data = post_resp.json()
    post_id = post_data["_id"]
    assert post_data["status"] == PostStatus.SCHEDULED
    assert post_data["targets"][0]["status"] == PostTargetStatus.PENDING
    assert post_data["targets"][0]["external_post_id"] is None

    # 4. Trigger worker processing now -> should NOT process future post
    processed = await scheduled_post_worker.process_due_posts()
    assert processed == 0

    post_check = await Post.get(post_id)
    assert post_check.status == PostStatus.SCHEDULED
    target_check = await PostTarget.find_one(PostTarget.post_id == post_check.id)
    assert target_check.status == PostTargetStatus.PENDING

    # 5. Fast-forward scheduled_at to past so it becomes due
    post_check.scheduled_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    await post_check.save()

    # 6. Process due posts via worker
    processed_due = await scheduled_post_worker.process_due_posts()
    assert processed_due == 1

    # 7. Verify post is now published and target has external_post_id
    await post_check.sync()
    assert post_check.status == PostStatus.PUBLISHED

    await target_check.sync()
    assert target_check.status == PostTargetStatus.PUBLISHED
    assert target_check.external_post_id is not None
    assert target_check.published_at is not None


@pytest.mark.asyncio
async def test_dispatch_due_api_endpoint(auth_client: AsyncClient):
    # 1. Connect platform
    p_resp = await auth_client.post(
        "/api/v1/platforms/tg",
        json={"bot_token": "123456:API-DISPATCH-TOKEN", "chat_id": "@dispatch_channel"},
    )
    assert p_resp.status_code == 201
    p_id = p_resp.json()["_id"]

    # 2. Create content
    c_resp = await auth_client.post(
        "/api/v1/contents",
        json={
            "title": "Immediate Manual Due Dispatch",
            "details": [{"type": "text", "text": "Manual trigger test"}],
            "status": "ready",
        },
    )
    c_id = c_resp.json()["_id"]

    # 3. Create scheduled post with past scheduled_at
    past_time = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
    post_resp = await auth_client.post(
        "/api/v1/posts",
        json={
            "content_id": c_id,
            "scheduled_at": past_time,
            "targets": [{"platform_id": p_id, "platform_code": "TG"}],
        },
    )
    # Since scheduled_at <= now, create_post dispatches directly, or if scheduled holds and dispatch-due handles it
    assert post_resp.status_code == 201

    # Call POST /api/v1/posts/dispatch-due
    dispatch_resp = await auth_client.post("/api/v1/posts/dispatch-due")
    assert dispatch_resp.status_code == 200
    assert "processed_count" in dispatch_resp.json()
    assert dispatch_resp.json()["status"] == "success"
