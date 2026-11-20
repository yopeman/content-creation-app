import io
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_list_users(async_client: AsyncClient):
    # 1. Create a user
    payload = {
        "name": "Jane Creator",
        "email": "jane@example.com",
        "password": "securepassword123",
        "timezone": "America/New_York",
        "status": "active",
    }
    response = await async_client.post("/api/v1/users", json=payload)
    assert response.status_code == 201
    user_data = response.json()
    assert user_data["name"] == "Jane Creator"
    assert user_data["email"] == "jane@example.com"
    assert "_id" in user_data

    # 2. List users
    list_resp = await async_client.get("/api/v1/users")
    assert list_resp.status_code == 200
    users = list_resp.json()
    assert len(users) >= 1


@pytest.mark.asyncio
async def test_local_file_upload_and_content_creation(async_client: AsyncClient):
    # 1. Upload a simulated image file to local storage
    fake_image_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRtest_image_data"
    files = {"file": ("thumbnail.png", io.BytesIO(fake_image_bytes), "image/png")}
    data = {"media_type": "image"}

    upload_resp = await async_client.post("/api/v1/contents/upload-media", files=files, data=data)
    assert upload_resp.status_code == 200
    upload_result = upload_resp.json()
    assert upload_result["status"] == "success"
    assert upload_result["detail"]["url"].startswith("/uploads/image/")
    assert upload_result["detail"]["file_size_bytes"] == len(fake_image_bytes)

    saved_path = upload_result["detail"]["path"]

    # 2. Create Content using this uploaded media detail
    content_payload = {
        "title": "10 AI Tools Every Creator Needs in 2026",
        "details": [
            {
                "type": "text",
                "script": "Here is the full video script...",
                "text": "10 AI Tools Every Creator Needs in 2026. Watch till the end!",
                "order": 1,
            },
            {
                "type": "image",
                "path": saved_path,
                "mime_type": "image/png",
                "order": 2,
            },
        ],
        "status": "draft",
    }
    content_resp = await async_client.post("/api/v1/contents", json=content_payload)
    assert content_resp.status_code == 201
    content_data = content_resp.json()
    assert content_data["title"] == "10 AI Tools Every Creator Needs in 2026"
    assert len(content_data["details"]) == 2
    assert "_id" in content_data


@pytest.mark.asyncio
async def test_plan_and_post_flow(async_client: AsyncClient):
    # 1. Connect a platform account
    platform_resp = await async_client.post(
        "/api/v1/platforms",
        json={
            "code": "TG",
            "account_name": "My Telegram Channel",
            "platform_account_id": "@yope_news",
            "status": "connected",
        },
    )
    assert platform_resp.status_code == 201
    platform_id = platform_resp.json()["_id"]

    # 2. Create a Content draft
    content_resp = await async_client.post(
        "/api/v1/contents",
        json={
            "title": "Weekly Tech Roundup",
            "details": [{"type": "text", "text": "This week in AI..."}],
            "status": "ready",
        },
    )
    assert content_resp.status_code == 201
    content_id = content_resp.json()["_id"]

    # 3. Create a Plan with an item
    plan_resp = await async_client.post(
        "/api/v1/plans",
        json={
            "idea": "Q4 AI Trends Campaign",
            "context": "Focus on developer tooling and content creation workflows",
            "number_of_content": 1,
            "items": [
                {
                    "order": 1,
                    "idea": "AI in Video Production",
                    "content_id": content_id,
                    "platform_ids": [platform_id],
                    "formats": ["video", "text"],
                }
            ],
        },
    )
    assert plan_resp.status_code == 201
    plan_data = plan_resp.json()
    assert plan_data["idea"] == "Q4 AI Trends Campaign"
    assert len(plan_data["items"]) == 1

    # 4. Schedule a Post with a PostTarget
    post_resp = await async_client.post(
        "/api/v1/posts",
        json={
            "content_id": content_id,
            "status": "scheduled",
            "targets": [
                {
                    "platform_id": platform_id,
                    "platform_code": "TG",
                    "payload_override": {"disable_notification": True},
                }
            ],
        },
    )
    assert post_resp.status_code == 201
    post_data = post_resp.json()
    assert post_data["status"] == "scheduled"
    assert len(post_data["targets"]) == 1
    assert post_data["targets"][0]["platform_code"] == "TG"
