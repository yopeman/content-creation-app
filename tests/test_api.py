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
async def test_platforms_full_lifecycle(auth_client: AsyncClient):
    # 1. List supported platforms (currently only TG)
    supported_resp = await auth_client.get("/api/v1/platforms/supported")
    assert supported_resp.status_code == 200
    supported_platforms = supported_resp.json()
    assert len(supported_platforms) == 1
    assert supported_platforms[0]["code"] == "TG"
    assert supported_platforms[0]["name"] == "Telegram"
    assert supported_platforms[0]["is_supported"] is True
    assert "bot_token" in supported_platforms[0]["required_details"]

    # 2. General POST /api/v1/platforms is removed (returns 405 Method Not Allowed)
    general_post_resp = await auth_client.post(
        "/api/v1/platforms",
        json={"code": "TG", "chat_id": "@test"},
    )
    assert general_post_resp.status_code == 405

    # 3. Connecting with invalid bot token fails with 400
    invalid_connect = await auth_client.post(
        "/api/v1/platforms/tg",
        json={
            "bot_token": "invalid_bot_token_123",
            "chat_id": "@tech_dispatch",
        },
    )
    assert invalid_connect.status_code == 400
    assert "Invalid Telegram Bot Token" in invalid_connect.json()["detail"]

    # 4. Connect platform via specialized POST /api/v1/platforms/tg (ONLY bot_token & chat_id provided!)
    connect_resp = await auth_client.post(
        "/api/v1/platforms/tg",
        json={
            "bot_token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
            "chat_id": "@tech_dispatch",
        },
    )
    assert connect_resp.status_code == 201
    platform_data = connect_resp.json()
    assert platform_data["code"] == "TG"
    # Auto-resolved channel name bound from Telegram API
    assert platform_data["account_name"] == "Telegram Channel @tech_dispatch"
    assert platform_data["platform_account_id"] == "@tech_dispatch"
    # Verify bot_token and encrypted_bot_token are completely absent from API response
    assert "bot_token" not in platform_data["details"]
    assert "encrypted_bot_token" not in platform_data["details"]
    assert platform_data["details"]["chat_id"] == "@tech_dispatch"
    assert "_id" in platform_data
    platform_id = platform_data["_id"]

    # 4b. Verify bot_token is stored encrypted in DB and decryptable by backend
    from app.models.platform import Platform
    from beanie import PydanticObjectId
    db_platform = await Platform.get(PydanticObjectId(platform_id))
    assert db_platform is not None
    assert "encrypted_bot_token" in db_platform.details
    assert db_platform.details["encrypted_bot_token"] != "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    assert db_platform.get_decrypted_bot_token() == "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"

    # 5. Duplicate Telegram connection should fail (400 Bad Request)
    dup_resp = await auth_client.post(
        "/api/v1/platforms/tg",
        json={
            "bot_token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
            "chat_id": "@tech_dispatch",
        },
    )
    assert dup_resp.status_code == 400
    assert "already connected" in dup_resp.json()["detail"]

    # 6. List connected platforms (verifies account_name is bound and returned)
    list_resp = await auth_client.get("/api/v1/platforms")
    assert list_resp.status_code == 200
    connected_list = list_resp.json()
    matched = [p for p in connected_list if p["_id"] == platform_id]
    assert len(matched) == 1
    assert matched[0]["account_name"] == "Telegram Channel @tech_dispatch"

    # 7. Get detail of connected platform
    detail_resp = await auth_client.get(f"/api/v1/platforms/{platform_id}")
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert detail_data["_id"] == platform_id
    assert detail_data["account_name"] == "Telegram Channel @tech_dispatch"

    # 8. Re-sync platform details with external platform
    sync_resp = await auth_client.post(f"/api/v1/platforms/{platform_id}/sync")
    assert sync_resp.status_code == 200
    assert sync_resp.json()["account_name"] == "Telegram Channel @tech_dispatch"

    # 9. Edit connection
    edit_resp = await auth_client.patch(
        f"/api/v1/platforms/{platform_id}",
        json={"account_name": "Custom Renamed Channel"},
    )
    assert edit_resp.status_code == 200
    edited_data = edit_resp.json()
    assert edited_data["account_name"] == "Custom Renamed Channel"

    # 10. Disconnect platform
    disconnect_resp = await auth_client.delete(f"/api/v1/platforms/{platform_id}")
    assert disconnect_resp.status_code == 204

    # 11. Verify disconnected platform is no longer accessible
    get_after_delete = await auth_client.get(f"/api/v1/platforms/{platform_id}")
    assert get_after_delete.status_code == 404

    list_after_delete = await auth_client.get("/api/v1/platforms")
    assert list_after_delete.status_code == 200
    assert not any(p["_id"] == platform_id for p in list_after_delete.json())


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
    # 1. Connect a platform account via specialized TG endpoint
    platform_resp = await auth_client.post(
        "/api/v1/platforms/tg",
        json={
            "bot_token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
            "chat_id": "@yope_news",
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
