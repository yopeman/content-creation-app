import io
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_user_auth_flow(async_client: AsyncClient):
    # 1. Register a new user
    register_payload = {
        "name": "Jane Creator",
        "email": "jane@example.com",
        "password": "securepassword123",
        "timezone": "America/New_York",
        "status": "active",
    }
    reg_resp = await async_client.post("/api/v1/users/register", json=register_payload)
    assert reg_resp.status_code == 201
    user_data = reg_resp.json()
    assert user_data["name"] == "Jane Creator"
    assert user_data["email"] == "jane@example.com"
    assert "_id" in user_data
    user_id = user_data["_id"]

    # 2. Duplicate registration should fail
    dup_resp = await async_client.post("/api/v1/users/register", json=register_payload)
    assert dup_resp.status_code == 400

    # 3. Login with wrong password should fail (401)
    bad_login = await async_client.post(
        "/api/v1/users/login",
        json={"email": "jane@example.com", "password": "wrongpassword"},
    )
    assert bad_login.status_code == 401

    # 4. Login with correct credentials returns JWT token
    login_resp = await async_client.post(
        "/api/v1/users/login",
        json={"email": "jane@example.com", "password": "securepassword123"},
    )
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    token = token_data["access_token"]

    # 5. Accessing /me without authentication must fail (401 protected)
    unauth_me = await async_client.get("/api/v1/users/me")
    assert unauth_me.status_code == 401

    # 6. Accessing /me with invalid token must fail (401)
    invalid_me = await async_client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer invalid.token.payload"},
    )
    assert invalid_me.status_code == 401

    # 7. Accessing /me with valid Bearer token returns current user
    auth_me = await async_client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert auth_me.status_code == 200
    me_data = auth_me.json()
    assert me_data["_id"] == user_id
    assert me_data["email"] == "jane@example.com"
    assert me_data["name"] == "Jane Creator"

    # 8. Verify list users (GET /api/v1/users) is removed
    list_resp = await async_client.get("/api/v1/users")
    assert list_resp.status_code in [404, 405]

    # 9. Verify get single user by ID (GET /api/v1/users/{user_id}) is removed
    get_user_resp = await async_client.get(f"/api/v1/users/{user_id}")
    assert get_user_resp.status_code == 404


@pytest.mark.asyncio
async def test_local_file_upload_and_content_creation(auth_client: AsyncClient):
    # 1. Upload a simulated image file to local storage
    fake_image_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRtest_image_data"
    files = {"file": ("thumbnail.png", io.BytesIO(fake_image_bytes), "image/png")}
    data = {"media_type": "image"}

    upload_resp = await auth_client.post("/api/v1/contents/upload-media", files=files, data=data)
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
    content_resp = await auth_client.post("/api/v1/contents", json=content_payload)
    assert content_resp.status_code == 201
    content_data = content_resp.json()
    assert content_data["title"] == "10 AI Tools Every Creator Needs in 2026"
    assert len(content_data["details"]) == 2
    assert "_id" in content_data


@pytest.mark.asyncio
async def test_plan_and_post_flow(auth_client: AsyncClient):
    # 1. Connect a platform account
    platform_resp = await auth_client.post(
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
    content_resp = await auth_client.post(
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
    plan_resp = await auth_client.post(
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
    post_resp = await auth_client.post(
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
