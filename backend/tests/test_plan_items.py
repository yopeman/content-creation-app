import pytest
from httpx import AsyncClient
from app.models.enums import ContentType, PlanStatus


@pytest.mark.asyncio
async def test_standalone_and_campaign_plan_flow(auth_client: AsyncClient):
    # 1. Create a standalone plan (no campaign_id)
    standalone_payload = {
        "idea": "10 Mind-Blowing AI Breakthroughs to Watch in 2027",
        "formats": ["video", "text"],
        "order": 1,
    }
    create_standalone_resp = await auth_client.post("/api/v1/plans/items", json=standalone_payload)
    assert create_standalone_resp.status_code == 201
    standalone_plan = create_standalone_resp.json()
    assert standalone_plan["idea"] == "10 Mind-Blowing AI Breakthroughs to Watch in 2027"
    assert standalone_plan["campaign_id"] is None
    assert standalone_plan["campaign_title"] is None
    assert "video" in standalone_plan["formats"]
    standalone_id = standalone_plan["_id"]

    # 2. Create a Campaign to test association
    camp_payload = {
        "title": "Spring Product Sprint 2026",
        "idea": "Product Sprint for creators",
        "goal": "Grow engagement by 50%",
        "number_of_content": 2,
        "color_hash_code": "#8b5cf6",
    }
    camp_resp = await auth_client.post("/api/v1/campaigns", json=camp_payload)
    assert camp_resp.status_code == 201
    campaign = camp_resp.json()
    campaign_id = campaign["_id"]

    # 3. Create a Plan explicitly associated with the campaign
    assoc_payload = {
        "campaign_id": campaign_id,
        "idea": "Product Sprint Day 1: Behind the Scenes",
        "formats": ["image", "text"],
        "order": 2,
    }
    create_assoc_resp = await auth_client.post("/api/v1/plans/items", json=assoc_payload)
    assert create_assoc_resp.status_code == 201
    assoc_plan = create_assoc_resp.json()
    assert assoc_plan["campaign_id"] == campaign_id
    assert assoc_plan["campaign_title"] == "Spring Product Sprint 2026"
    assert assoc_plan["campaign_color"] == "#8b5cf6"
    assoc_id = assoc_plan["_id"]

    # 4. List all plans
    all_plans_resp = await auth_client.get("/api/v1/plans/items")
    assert all_plans_resp.status_code == 200
    all_items = all_plans_resp.json()
    item_ids = [p["_id"] for p in all_items]
    assert standalone_id in item_ids
    assert assoc_id in item_ids

    # 5. Filter by standalone=true
    standalone_list_resp = await auth_client.get("/api/v1/plans/items?standalone=true")
    assert standalone_list_resp.status_code == 200
    standalone_items = standalone_list_resp.json()
    assert any(p["_id"] == standalone_id for p in standalone_items)
    assert not any(p["_id"] == assoc_id for p in standalone_items)

    # 6. Filter by campaign_id
    camp_list_resp = await auth_client.get(f"/api/v1/plans/items?campaign_id={campaign_id}")
    assert camp_list_resp.status_code == 200
    camp_items = camp_list_resp.json()
    assert any(p["_id"] == assoc_id for p in camp_items)
    assert not any(p["_id"] == standalone_id for p in camp_items)

    # 7. Update plan: associate the standalone plan with the campaign
    update_to_camp = await auth_client.patch(
        f"/api/v1/plans/{standalone_id}",
        json={"campaign_id": campaign_id},
    )
    assert update_to_camp.status_code == 200
    updated_data = update_to_camp.json()
    assert updated_data["campaign_id"] == campaign_id
    assert updated_data["campaign_title"] == "Spring Product Sprint 2026"

    # 8. Update plan: dissociate back to standalone
    update_to_standalone = await auth_client.patch(
        f"/api/v1/plans/{standalone_id}",
        json={"campaign_id": None},
    )
    assert update_to_standalone.status_code == 200
    standalone_again = update_to_standalone.json()
    assert standalone_again["campaign_id"] is None
    assert standalone_again["campaign_title"] is None

    # 9. Generate content for standalone plan
    gen_resp = await auth_client.post(f"/api/v1/generations/plans/{standalone_id}/content")
    assert gen_resp.status_code == 201
    content_data = gen_resp.json()
    assert content_data["title"] is not None

    # 10. Check that the plan now has content_id enriched
    plan_with_content = await auth_client.get(f"/api/v1/plans/items/{standalone_id}")
    assert plan_with_content.status_code == 200
    pwc_data = plan_with_content.json()
    assert pwc_data["content_id"] == content_data["_id"]
    assert pwc_data["content_title"] == content_data["title"]

    # 11. Delete plan
    del_resp = await auth_client.delete(f"/api/v1/plans/{standalone_id}")
    assert del_resp.status_code == 204

    # 12. Verify deleted plan is not returned in list
    after_del_resp = await auth_client.get("/api/v1/plans/items")
    assert not any(p["_id"] == standalone_id for p in after_del_resp.json())
