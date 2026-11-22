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

    # 9. Edit general platform connection metadata
    edit_resp = await auth_client.patch(
        f"/api/v1/platforms/{platform_id}",
        json={"account_name": "Custom Renamed Channel"},
    )
    assert edit_resp.status_code == 200
    edited_data = edit_resp.json()
    assert edited_data["account_name"] == "Custom Renamed Channel"

    # 9b. Edit Telegram credentials via specialized PATCH /api/v1/platforms/tg/{platform_id}
    tg_edit_resp = await auth_client.patch(
        f"/api/v1/platforms/tg/{platform_id}",
        json={
            "bot_token": "999999:ZZZ-NEW-TOKEN-abcdefghijklmn",
            "chat_id": "@tech_dispatch_v2",
        },
    )
    assert tg_edit_resp.status_code == 200
    tg_edited_data = tg_edit_resp.json()
    assert tg_edited_data["platform_account_id"] == "@tech_dispatch_v2"
    assert "bot_token" not in tg_edited_data["details"]
    assert "encrypted_bot_token" not in tg_edited_data["details"]

    # Verify updated token is encrypted in DB and decryptable by backend
    updated_db = await Platform.get(PydanticObjectId(platform_id))
    assert updated_db.get_decrypted_bot_token() == "999999:ZZZ-NEW-TOKEN-abcdefghijklmn"
    assert updated_db.details["chat_id"] == "@tech_dispatch_v2"

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
    # 1. Upload a simulated image file to local storage (explicit media_type)
    fake_image_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRtest_image_data"
    files = {"file": ("thumbnail.png", io.BytesIO(fake_image_bytes), "image/png")}
    data = {"media_type": "image"}

    upload_resp = await auth_client.post("/api/v1/contents/upload-media", files=files, data=data)
    assert upload_resp.status_code == 200
    upload_result = upload_resp.json()
    assert upload_result["status"] == "success"
    assert upload_result["detail"]["type"] == "image"
    assert upload_result["detail"]["url"].startswith("/uploads/image/")
    assert upload_result["detail"]["file_size_bytes"] == len(fake_image_bytes)

    saved_path = upload_result["detail"]["path"]

    # 1b. Upload without media_type (auto-detected from file)
    fake_video_bytes = b"\x00\x00\x00 ftypisomtest_video_data"
    files_video = {"file": ("sample.mp4", io.BytesIO(fake_video_bytes), "video/mp4")}
    auto_upload_resp = await auth_client.post("/api/v1/contents/upload-media", files=files_video)
    assert auto_upload_resp.status_code == 200
    assert auto_upload_resp.json()["detail"]["type"] == "video"
    assert auto_upload_resp.json()["detail"]["url"].startswith("/uploads/video/")

    # 1c. Upload unsupported file fails with 400
    bad_file = {"file": ("script.sh", io.BytesIO(b"echo hello"), "text/x-shellscript")}
    bad_upload_resp = await auth_client.post("/api/v1/contents/upload-media", files=bad_file)
    assert bad_upload_resp.status_code == 400

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
    created_id = content_data["_id"]

    # 3. Read back created content (GET /contents/{id})
    get_resp = await auth_client.get(f"/api/v1/contents/{created_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["_id"] == created_id

    # 4. Update content (PUT /contents/{id})
    update_resp = await auth_client.put(
        f"/api/v1/contents/{created_id}",
        json={"title": "Updated: 10 AI Tools Every Creator Needs", "status": "ready"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Updated: 10 AI Tools Every Creator Needs"
    assert update_resp.json()["status"] == "ready"

    # 5. List contents (GET /contents)
    list_resp = await auth_client.get("/api/v1/contents")
    assert list_resp.status_code == 200
    assert any(c["_id"] == created_id for c in list_resp.json())

    # 6. Delete content (DELETE /contents/{id})
    del_resp = await auth_client.delete(f"/api/v1/contents/{created_id}")
    assert del_resp.status_code == 204

    # 7. Deleted content should return 404
    del_check_resp = await auth_client.get(f"/api/v1/contents/{created_id}")
    assert del_check_resp.status_code == 404


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

    # 4. Schedule a Post with a PostTarget (dispatches to Telegram with native schedule)
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
    target_data = post_data["targets"][0]
    assert target_data["platform_code"] == "TG"
    assert target_data["status"] == "published"
    assert target_data["external_post_id"] == "888123"
    assert target_data["external_url"] == "https://t.me/yope_news/888123"
    assert target_data["published_at"] is not None

    # 5. Create Draft Post and publish via POST /posts/{id}/publish
    draft_resp = await auth_client.post(
        "/api/v1/posts",
        json={
            "content_id": content_id,
            "status": "draft",
            "targets": [
                {
                    "platform_id": platform_id,
                    "platform_code": "TG",
                }
            ],
        },
    )
    assert draft_resp.status_code == 201
    draft_data = draft_resp.json()
    assert draft_data["status"] == "draft"
    assert draft_data["targets"][0]["status"] == "pending"
    draft_id = draft_data["_id"]

    publish_resp = await auth_client.post(f"/api/v1/posts/{draft_id}/publish")
    assert publish_resp.status_code == 200
    published_data = publish_resp.json()
    assert published_data["status"] == "published"
    assert published_data["targets"][0]["status"] == "published"
    assert published_data["targets"][0]["external_post_id"] == "888123"

    # 6. Direct publish with status inside target (inferred as published)
    target_pub_resp = await auth_client.post(
        "/api/v1/posts",
        json={
            "content_id": content_id,
            "targets": [
                {
                    "platform_id": platform_id,
                    "platform_code": "TG",
                    "status": "published",
                }
            ],
        },
    )
    assert target_pub_resp.status_code == 201
    assert target_pub_resp.json()["status"] == "published"
    assert target_pub_resp.json()["targets"][0]["status"] == "published"
    assert target_pub_resp.json()["targets"][0]["external_post_id"] == "888123"


@pytest.mark.asyncio
async def test_ai_content_generation_agent(auth_client: AsyncClient):
    # 1. Call AI content generation endpoint via /api/v1/generations
    gen_payload = {
        "prompt": "Top 5 Tips for Developer Productivity in 2026",
        "title": "Top 5 Developer Productivity Tips",
        "formats": ["text", "image", "audio", "video"],
    }
    gen_resp = await auth_client.post("/api/v1/generations", json=gen_payload)
    assert gen_resp.status_code == 201
    content_data = gen_resp.json()
    assert content_data["title"] == "Top 5 Developer Productivity Tips"
    assert "_id" in content_data
    content_id = content_data["_id"]

    # 2. Verify all 4 modalities and field mappings
    details = content_data["details"]
    assert len(details) == 4

    # Text detail: script has sub-prompt, text has generated content, path is None
    text_item = next(d for d in details if d["type"] == "text")
    assert text_item["script"] is not None
    assert len(text_item["script"]) > 0
    assert text_item["text"] is not None
    assert len(text_item["text"]) > 0
    assert text_item["path"] is None

    # Image detail: script has sub-prompt, path has local file, text is None
    img_item = next(d for d in details if d["type"] == "image")
    assert img_item["script"] is not None
    assert img_item["path"] is not None
    assert img_item["path"].startswith("uploads/image/")
    assert img_item["mime_type"] == "image/png"

    # Audio detail: script has sub-prompt, path has local MP3 file
    audio_item = next(d for d in details if d["type"] == "audio")
    assert audio_item["script"] is not None
    assert audio_item["path"] is not None
    assert audio_item["path"].startswith("uploads/audio/")
    assert audio_item["mime_type"] == "audio/mpeg"

    # Video detail: script has sub-prompt, path has local MP4 file
    video_item = next(d for d in details if d["type"] == "video")
    assert video_item["script"] is not None
    assert video_item["path"] is not None
    assert video_item["path"].startswith("uploads/video/")
    assert video_item["mime_type"] == "video/mp4"

    # 3. Verify Prompt collection record logged for this generation
    prompts_resp = await auth_client.get(f"/api/v1/prompts?content_id={content_id}")
    assert prompts_resp.status_code == 200
    prompts_list = prompts_resp.json()
    assert len(prompts_list) == 1
    prompt_record = prompts_list[0]
    assert prompt_record["type"] == "content"
    assert prompt_record["status"] == "done"
    assert prompt_record["prompt"] == gen_payload["prompt"]
    assert prompt_record["content_id"] == content_id
    assert prompt_record["model"] == "openai/gpt-oss-120b"


@pytest.mark.asyncio
async def test_ai_plan_and_plan_item_generation(auth_client: AsyncClient):
    # 1. AI Campaign Plan Generation (logs type=PromptType.PLAN)
    plan_gen_payload = {
        "idea": "Developer Tools Launch 2026",
        "context": "DevOps and FullStack Engineers",
        "number_of_content": 2,
    }
    plan_resp = await auth_client.post("/api/v1/plans/generate", json=plan_gen_payload)
    assert plan_resp.status_code == 201
    plan_data = plan_resp.json()
    assert plan_data["idea"] == "Developer Tools Launch 2026"
    assert len(plan_data["items"]) == 2
    plan_id = plan_data["_id"]
    plan_item_id = plan_data["items"][0]["_id"]

    # Verify Prompt record logged for the plan
    plan_prompts_resp = await auth_client.get(f"/api/v1/prompts?plan_id={plan_id}")
    assert plan_prompts_resp.status_code == 200
    plan_prompts = plan_prompts_resp.json()
    assert any(p["type"] == "plan" and p["plan_id"] == plan_id for p in plan_prompts)

    # 2. AI Content Generation for a specific Plan Item (logs type=PromptType.PLAN_ITEM)
    item_gen_resp = await auth_client.post(f"/api/v1/plans/{plan_id}/items/{plan_item_id}/generate-content")
    assert item_gen_resp.status_code == 201
    item_content = item_gen_resp.json()
    assert "_id" in item_content
    generated_content_id = item_content["_id"]
    assert len(item_content["details"]) == 4

    # Verify Prompt record logged for this specific plan item
    item_prompts_resp = await auth_client.get(f"/api/v1/prompts?plan_item_id={plan_item_id}")
    assert item_prompts_resp.status_code == 200
    item_prompts = item_prompts_resp.json()
    assert len(item_prompts) == 1
    assert item_prompts[0]["type"] == "plan_item"
    assert item_prompts[0]["content_id"] == generated_content_id
    assert item_prompts[0]["plan_id"] == plan_id


@pytest.mark.asyncio
async def test_prompt_chaining_and_content_improvement(auth_client: AsyncClient):
    # 1. Initial Content Generation (Root Prompt in Chain)
    initial_payload = {
        "prompt": "Top 3 Python Tips for Backend Engineers",
        "title": "Top 3 Python Tips",
        "formats": ["text", "image", "audio", "video"],
    }
    gen_resp = await auth_client.post("/api/v1/generations", json=initial_payload)
    assert gen_resp.status_code == 201
    content_data = gen_resp.json()
    content_id = content_data["_id"]
    initial_text = next(d["text"] for d in content_data["details"] if d["type"] == "text")
    assert initial_text is not None

    # Fetch root prompt record
    root_prompts_resp = await auth_client.get(f"/api/v1/prompts?content_id={content_id}")
    assert root_prompts_resp.status_code == 200
    root_prompts = root_prompts_resp.json()
    assert len(root_prompts) == 1
    root_prompt = root_prompts[0]
    assert root_prompt["parent_prompt_id"] is None
    assert root_prompt["status"] == "done"
    root_prompt_id = root_prompt["_id"]

    # 2. First Iterative Improvement via POST /generations/{content_id}/improve
    improve_payload_1 = {
        "instruction": "Make the text punchier, add 3 bullet points, and add hashtags. Update text, audio, and video.",
        "formats": ["text", "audio", "video"],
    }
    improve_resp_1 = await auth_client.post(f"/api/v1/generations/{content_id}/improve", json=improve_payload_1)
    assert improve_resp_1.status_code == 200
    improved_content_1 = improve_resp_1.json()
    improved_text_1 = next(d["text"] for d in improved_content_1["details"] if d["type"] == "text")
    assert improved_text_1 is not None

    # Check that prompt chain now has 2 prompts and parent_prompt_id points to root prompt
    chain_resp_1 = await auth_client.get(f"/api/v1/generations/{content_id}/chain")
    assert chain_resp_1.status_code == 200
    chain_1 = chain_resp_1.json()
    assert len(chain_1) == 2
    assert chain_1[0]["_id"] == root_prompt_id
    assert chain_1[0]["parent_prompt_id"] is None
    assert chain_1[1]["parent_prompt_id"] == root_prompt_id
    assert chain_1[1]["prompt"] == improve_payload_1["instruction"]
    assert chain_1[1]["status"] == "done"
    second_prompt_id = chain_1[1]["_id"]

    # 3. Second Iterative Improvement via POST /generations passing content_id
    improve_payload_2 = {
        "content_id": content_id,
        "prompt": "Add a short call-to-action at the end asking developers for their favorite tip.",
        "formats": ["text"],
    }
    improve_resp_2 = await auth_client.post("/api/v1/generations", json=improve_payload_2)
    assert improve_resp_2.status_code == 200 or improve_resp_2.status_code == 201
    improved_content_2 = improve_resp_2.json()
    improved_text_2 = next(d["text"] for d in improved_content_2["details"] if d["type"] == "text")
    assert improved_text_2 is not None

    # Verify full 3-step prompt chain via GET /generations/{content_id}/chain
    chain_resp_2 = await auth_client.get(f"/api/v1/generations/{content_id}/chain")
    assert chain_resp_2.status_code == 200
    chain_2 = chain_resp_2.json()
    assert len(chain_2) == 3
    assert chain_2[0]["_id"] == root_prompt_id
    assert chain_2[1]["_id"] == second_prompt_id
    assert chain_2[1]["parent_prompt_id"] == root_prompt_id
    assert chain_2[2]["parent_prompt_id"] == second_prompt_id
    assert chain_2[2]["prompt"] == improve_payload_2["prompt"]
    third_prompt_id = chain_2[2]["_id"]

    # Verify lineage lookup via GET /prompts/chain/{third_prompt_id}
    lineage_resp = await auth_client.get(f"/api/v1/prompts/chain/{third_prompt_id}")
    assert lineage_resp.status_code == 200
    lineage = lineage_resp.json()
    assert len(lineage) == 3
    assert [p["_id"] for p in lineage] == [root_prompt_id, second_prompt_id, third_prompt_id]


