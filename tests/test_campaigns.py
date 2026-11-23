from datetime import datetime, timezone
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_campaign_crud_flow(auth_client: AsyncClient):
    # 1. Create Campaign with plans
    start = datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc).isoformat()
    end = datetime(2026, 12, 31, 23, 59, 59, tzinfo=timezone.utc).isoformat()

    create_payload = {
        "title": "Winter Growth Sprint",
        "idea": "Scale multi-channel B2B engagement",
        "goal": "Increase trial signups by 40%",
        "context": "Tech founders and lead developers",
        "number_of_content": 2,
        "color_has_code": "#6366F1",
        "permission": "review_required",
        "start_date": start,
        "end_date": end,
        "plans": [
            {
                "order": 1,
                "idea": "Case study on 10x developer workflows",
                "formats": ["text", "image"],
            }
        ],
    }

    resp = await auth_client.post("/api/v1/campaigns", json=create_payload)
    assert resp.status_code == 201
    campaign = resp.json()

    assert campaign["title"] == "Winter Growth Sprint"
    assert campaign["idea"] == "Scale multi-channel B2B engagement"
    assert campaign["goal"] == "Increase trial signups by 40%"
    assert campaign["color_hash_code"] == "#6366F1"
    assert campaign["color_has_code"] == "#6366F1"
    assert campaign["color_hex_code"] == "#6366F1"
    assert campaign["status"] == "draft"
    assert len(campaign["plans"]) == 1
    assert campaign["plans"][0]["idea"] == "Case study on 10x developer workflows"
    assert campaign["plans"][0]["order"] == 1
    campaign_id = campaign["_id"]

    # 2. List Campaigns
    list_resp = await auth_client.get("/api/v1/campaigns")
    assert list_resp.status_code == 200
    campaigns = list_resp.json()
    assert any(c["_id"] == campaign_id for c in campaigns)

    # 3. Get single Campaign
    get_resp = await auth_client.get(f"/api/v1/campaigns/{campaign_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["_id"] == campaign_id
    assert len(get_resp.json()["plans"]) == 1

    # 4. Patch Campaign
    patch_resp = await auth_client.patch(
        f"/api/v1/campaigns/{campaign_id}",
        json={
            "goal": "Increase trial signups by 50%",
            "color_has_code": "#4F46E5",
            "status": "ready",
        },
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["goal"] == "Increase trial signups by 50%"
    assert updated["color_has_code"] == "#4F46E5"
    assert updated["status"] == "ready"

    # 5. Add a Plan directly to Campaign
    add_plan_resp = await auth_client.post(
        f"/api/v1/campaigns/{campaign_id}/plans",
        json={
            "order": 2,
            "idea": "Interactive product demo highlights",
            "formats": ["video"],
        },
    )
    assert add_plan_resp.status_code == 201
    new_plan = add_plan_resp.json()
    assert new_plan["campaign_id"] == campaign_id
    assert new_plan["order"] == 2

    # 6. List Plans of Campaign
    plans_list_resp = await auth_client.get(f"/api/v1/campaigns/{campaign_id}/plans")
    assert plans_list_resp.status_code == 200
    plans_data = plans_list_resp.json()
    assert len(plans_data) == 2

    # 7. Delete Campaign
    del_resp = await auth_client.delete(f"/api/v1/campaigns/{campaign_id}")
    assert del_resp.status_code == 204

    # Verify not returned in active list
    list_after = await auth_client.get("/api/v1/campaigns")
    assert not any(c["_id"] == campaign_id for c in list_after.json())


@pytest.mark.asyncio
async def test_campaign_ai_generation_and_content_creation(auth_client: AsyncClient):
    # 1. AI Campaign generation
    gen_resp = await auth_client.post(
        "/api/v1/campaigns/generate",
        json={
            "idea": "AI Architecture Patterns 2026",
            "title": "AI Architect Summit",
            "goal": "Brand awareness and community engagement",
            "context": "Cloud and Distributed Systems Architects",
            "number_of_content": 2,
            "color_has_code": "#10B981",
        },
    )
    assert gen_resp.status_code == 201
    camp_data = gen_resp.json()
    assert camp_data["title"] == "AI Architect Summit"
    assert camp_data["idea"] == "AI Architecture Patterns 2026"
    assert camp_data["color_has_code"] == "#10B981"
    assert len(camp_data["plans"]) == 2
    campaign_id = camp_data["_id"]
    first_plan_id = camp_data["plans"][0]["_id"]

    # 2. Check prompt record logged with type=campaign
    prompts_resp = await auth_client.get(f"/api/v1/prompts?campaign_id={campaign_id}")
    assert prompts_resp.status_code == 200
    prompts = prompts_resp.json()
    assert any(p["type"] == "campaign" and p["campaign_id"] == campaign_id for p in prompts)

    # 3. Generate content for the plan item under campaign
    content_resp = await auth_client.post(
        f"/api/v1/campaigns/{campaign_id}/plans/{first_plan_id}/generate-content"
    )
    assert content_resp.status_code == 201
    content = content_resp.json()
    assert "_id" in content
    assert len(content["details"]) == 4

    # 4. Check prompt record logged for the plan item
    item_prompts_resp = await auth_client.get(f"/api/v1/prompts?plan_item_id={first_plan_id}")
    assert item_prompts_resp.status_code == 200
    item_prompts = item_prompts_resp.json()
    assert len(item_prompts) == 1
    assert item_prompts[0]["type"] == "plan_item"
    assert item_prompts[0]["content_id"] == content["_id"]
