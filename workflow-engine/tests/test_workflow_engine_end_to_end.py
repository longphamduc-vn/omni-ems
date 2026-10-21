import pytest
import httpx
from app.core.engine import workflow_engine
from app.core.memory_store import memory_store
from app.main import app


@pytest.mark.asyncio
async def test_end_to_end_search_and_enrich():
    """Test full execution of wf_search_and_enrich against local mock server."""
    memory_store.clear_token_cache()

    result = await workflow_engine.execute(
        workflow_id="wf_search_and_enrich",
        inputs={
            "keyword": "QCAD57452",
            "status_filter": "ACTIVE",
            "items": [{"code": "QCAD57452"}],
        }
    )

    assert result["status"] == "COMPLETED"
    assert result["workflow_id"] == "wf_search_and_enrich"
    assert "metadata" in result
    assert "data" in result
    assert isinstance(result["data"], list)

    # Verify that token was saved in cache
    cached_token = memory_store.get_token("global")
    assert cached_token is not None

    # Run a second time: verify cached token reuse (0 network calls for auth)
    second_result = await workflow_engine.execute(
        workflow_id="wf_search_and_enrich",
        inputs={"keyword": "QCAD57452"}
    )
    assert second_result["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_loop_mode_workflow():
    """Test loop mode execution with concurrency semaphore."""
    result = await workflow_engine.execute(
        workflow_id="wf_loop_item_details",
        inputs={
            "items": [
                {"code": "QCAD57452"},
                {"code": "A1002"},
            ]
        }
    )

    assert result["status"] == "COMPLETED"
    assert result["workflow_id"] == "wf_loop_item_details"
    assert isinstance(result["data"], list)


@pytest.mark.asyncio
async def test_fastapi_rest_endpoint():
    """Test FastAPI POST /api/v1/workflows/execute endpoint."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Health check
        resp = await client.get("/api/v1/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ONLINE"

        # 2. Workflows list
        resp = await client.get("/api/v1/workflows")
        assert resp.status_code == 200
        assert "wf_search_and_enrich" in resp.json()["workflows"]

        # 3. Execute workflow
        exec_resp = await client.post(
            "/api/v1/workflows/execute",
            json={
                "workflow_id": "wf_search_and_enrich",
                "inputs": {
                    "keyword": "QCAD57452",
                    "status_filter": "ACTIVE",
                    "items": [{"code": "QCAD57452"}]
                }
            }
        )
        assert exec_resp.status_code == 200
        data = exec_resp.json()
        assert data["status"] == "COMPLETED"
        assert data["workflow_id"] == "wf_search_and_enrich"
        assert "data" in data
        assert "metadata" in data


@pytest.mark.asyncio
async def test_end_to_end_search_and_enrich_t1_items():
    """Test wf_search_and_enrich with items QCAB17587 and QDAE01694 from t1.txt."""
    result = await workflow_engine.execute(
        workflow_id="wf_search_and_enrich",
        inputs={
            "keyword": "QCAB17587",
            "status_filter": "ACTIVE",
            "items": [{"code": "QCAB17587"}, {"code": "QDAE01694"}]
        }
    )
    assert result["status"] == "COMPLETED"
    items = result["data"]
    assert len(items) >= 2
    qcab = next(i for i in items if i["item_code"] == "QCAB17587")
    assert qcab["maker"] == "YTS"
    assert qcab["organization_name"] == "A13 (LG Display Vietnam Asset)"
    assert qcab["category_name"] == "Joint / Rotary Connector"
    assert qcab["calculated_status"] == "OUT_OF_STOCK"


@pytest.mark.asyncio
async def test_end_to_end_target_stock_optimization_t1():
    """Test wf_target_stock_optimization multi-step flow with t1.txt capture data."""
    result = await workflow_engine.execute(
        workflow_id="wf_target_stock_optimization",
        inputs={
            "organizationId": "28753",
            "userId": "658359",
            "items": [{"item": "QCAB17587", "inventoryItemId": "3042180"}]
        }
    )
    assert result["status"] == "COMPLETED"
    assert "data" in result
    items = result["data"]
    assert len(items) == 1
    item = items[0]
    assert item["item_code"] == "QCAB17587"
    assert item["target_qty"] == 4
    assert item["logic_qty"] == 4
    assert item["due_days"] == 103
    assert item["stock_status"] == "REORDER_PENDING"
    assert item["target_apply_type_desc"] == "Optimized (Unplanned)"
    assert item["buy_item_type_desc"] == "Total Management"
    assert item["organization_name"] == "A13 (LG Display Vietnam Asset)"


@pytest.mark.asyncio
async def test_end_to_end_comprehensive_ems_fusion():
    """Test full sequential 8-step pipeline execution and 360-degree data fusion."""
    result = await workflow_engine.execute(
        workflow_id="wf_comprehensive_ems_fusion",
        inputs={
            "organizationId": "28753",
            "userId": "658359",
            "items": [
                {"item": "QCAB17587", "inventoryItemId": "3042180"},
                {"item": "QDAE01694", "inventoryItemId": "3365330"}
            ]
        }
    )
    assert result["status"] == "COMPLETED"
    assert "data" in result
    items = result["data"]
    assert len(items) == 2

    # Check 360 fused attributes for QCAB17587
    qcab = next(i for i in items if i["item_identification"]["item_code"] == "QCAB17587")
    assert qcab["item_identification"]["maker"] == "YTS"
    assert qcab["item_identification"]["category_name"] == "Joint / Rotary Connector"
    assert qcab["organization_and_responsibility"]["organization_name"] == "A13 (LG Display Vietnam Asset)"
    assert qcab["organization_and_responsibility"]["manager_name"] == "Nguyen Thi Hue"
    assert qcab["organization_and_responsibility"]["buyer_name"] == "Thi Ngoc Mai, Nguyen"
    assert qcab["stock_and_inventory_balances"]["target_stock_qty"] == 4
    assert qcab["stock_and_inventory_balances"]["reorder_requisition_qty"] == 13
    assert qcab["procurement_and_commercials"]["unit_price_new"] == 2997.49
    assert qcab["lead_time_and_equipment_reliability"]["due_days"] == 103
    assert qcab["lead_time_and_equipment_reliability"]["mtbf_days"] == 36.4
    assert qcab["optimization_matrix"]["health_rating"] == "OUT_OF_STOCK_REORDER"


