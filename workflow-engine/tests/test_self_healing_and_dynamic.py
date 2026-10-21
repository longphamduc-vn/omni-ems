import pytest
from unittest.mock import AsyncMock, patch
import httpx
from app.core.engine import workflow_engine
from app.core.memory_store import memory_store
from app.adapters.http_adapter import HttpAuthRequiredError
from app.main import app


@pytest.mark.asyncio
async def test_dynamic_workflow_definition_execution():
    """Verify executing an inline YAML workflow definition on-the-fly."""
    inline_wf = """
    id: dynamic_inline_wf
    name: "Dynamic Inline Test Workflow"
    inputs:
      raw_items:
        - code: "VALVE-01"
          qty: "5"
          stat: "01"
        - code: "PUMP-01"
          qty: "0"
          stat: "01"

    steps:
      - id: transform_step
        type: "transform_jsonata"
        config:
          expression: |
            inputs.raw_items.[{
              "item_code": code,
              "calculated_status": (
                stat == '01' and $number(qty) > 0 ? "AVAILABLE" :
                stat == '01' and $number(qty) <= 0 ? "OUT_OF_STOCK" : "INACTIVE"
              )
            }]
          output_var: "items"

    response:
      status: "SUCCESS"
      data: "{{ steps.transform_step.output }}"
    """

    res = await workflow_engine.execute(
        workflow_definition=inline_wf,
        inputs={"raw_items": [{"code": "TEST-1", "qty": "100", "stat": "01"}]}
    )

    assert res["status"] == "COMPLETED"
    assert res["workflow_id"] == "dynamic_inline_wf"
    assert res["data"][0]["item_code"] == "TEST-1"
    assert res["data"][0]["calculated_status"] == "AVAILABLE"


@pytest.mark.asyncio
async def test_self_healing_circuit_breaker():
    """
    Test self-healing mechanism:
    When an HTTP call fails with 401 / session expired,
    engine invalidates the token, triggers fresh auth sub-workflow,
    and retries the step successfully.
    """
    memory_store.set_token("global", {"token": "OLD_EXPIRED_TOKEN"})

    call_count = 0

    async def mock_http_execute(config, context):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First attempt fails with expired session
            raise HttpAuthRequiredError("Session expired in Nexacro", status_code=401)
        # Second attempt (after self-healing) succeeds
        return {
            "metadata": {"error_code": 0, "error_msg": "SUCCESS", "total_count": 1},
            "raw_flattened": [{"ITEM_CD": "HEALED_ITEM", "ITEM_NM": "Self Healed Item", "STAT": "01", "QTY": "10"}],
            "datasets": {}
        }

    with patch("app.core.engine.http_adapter.execute", side_effect=mock_http_execute):
        res = await workflow_engine.execute(
            workflow_id="wf_search_and_enrich",
            inputs={"keyword": "TEST"}
        )

    # Verify self-healing happened (Call 1: fail, Call 2: fresh auth login, Call 3: retry succeeds)
    assert call_count == 3
    assert res["status"] == "COMPLETED"
    assert res["data"][0]["item_code"] == "HEALED_ITEM"
    assert res["data"][0]["calculated_status"] == "AVAILABLE"
    # Token cache should now contain a fresh token
    assert memory_store.get_token("global")["token"] != "OLD_EXPIRED_TOKEN"
