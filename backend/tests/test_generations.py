import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_generation_campaign_and_plan_content(auth_client: AsyncClient):
    # 1. AI Generate Campaign via /api/v1/generations/campaign
    camp_resp = await auth_client.post(
        "/api/v1/generations/campaign",
        json={
            "title": "Spring SaaS Launch",
            "idea": "Next-gen developer platform highlights",
            "number_of_content": 2,
            "color_has_code": "#3B82F6",
        },
    )
    assert camp_resp.status_code == 201
    camp_data = camp_resp.json()
    assert camp_data["title"] == "Spring SaaS Launch"
    assert len(camp_data["plans"]) == 2
    campaign_id = camp_data["_id"]
    plan_id = camp_data["plans"][0]["_id"]

    # 2. AI Generate Content for a specific plan via /api/v1/generations/plans/{plan_id}/content
    content_resp = await auth_client.post(f"/api/v1/generations/plans/{plan_id}/content")
    assert content_resp.status_code == 201
    content_data = content_resp.json()
    assert "_id" in content_data
    assert len(content_data["details"]) == 4

    # 3. Verify Campaign shows plan with content_id populated
    get_camp = await auth_client.get(f"/api/v1/campaigns/{campaign_id}")
    assert get_camp.status_code == 200
    plans = get_camp.json()["plans"]
    updated_plan = next(p for p in plans if p["_id"] == plan_id)
    assert updated_plan["content_id"] == content_data["_id"]
    assert updated_plan["status"] == "ready"


@pytest.mark.asyncio
async def test_generation_loop_existing_campaign(auth_client: AsyncClient):
    # 1. Manually create a campaign with 2 plans
    create_resp = await auth_client.post(
        "/api/v1/campaigns",
        json={
            "title": "Manual Strategy Campaign",
            "idea": "Enterprise Cloud Migration Roadmap",
            "number_of_content": 2,
            "plans": [
                {
                    "order": 1,
                    "idea": "Assessment & Cloud Readiness Checklist",
                    "formats": ["text", "image"],
                },
                {
                    "order": 2,
                    "idea": "Security & Compliance in Hybrid Environments",
                    "formats": ["text", "video"],
                },
            ],
        },
    )
    assert create_resp.status_code == 201
    camp = create_resp.json()
    campaign_id = camp["_id"]
    assert len(camp["plans"]) == 2
    assert all(p.get("content_id") is None for p in camp["plans"])

    # 2. Run AI Generation Loop for this campaign via /api/v1/generations/campaign/{id}/loop
    loop_resp = await auth_client.post(f"/api/v1/generations/campaign/{campaign_id}/loop")
    assert loop_resp.status_code == 200
    loop_data = loop_resp.json()

    assert loop_data["status"] == "ready"
    assert len(loop_data["plans"]) == 2
    # Verify every plan now has generated content in the loop!
    for plan in loop_data["plans"]:
        assert plan["content_id"] is not None
        assert plan["status"] == "ready"


@pytest.mark.asyncio
async def test_generation_loop_from_scratch(auth_client: AsyncClient):
    # Execute full AI generation loop from scratch using generate_contents=True
    resp = await auth_client.post(
        "/api/v1/generations/campaign",
        json={
            "title": "Autonomous Content Series",
            "idea": "AI in Creative Workflows 2026",
            "number_of_content": 2,
            "color_has_code": "#8B5CF6",
            "generate_contents": True,
        },
    )
    assert resp.status_code == 201
    camp = resp.json()
    assert camp["title"] == "Autonomous Content Series"
    assert len(camp["plans"]) == 2
    for plan in camp["plans"]:
        assert plan["content_id"] is not None
        assert plan["status"] == "ready"
