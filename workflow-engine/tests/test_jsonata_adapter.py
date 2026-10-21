import pytest
from app.core.data_context import DataContext
from app.adapters.jsonata_adapter import JsonataAdapter, transform_jsonata


def test_status_logic_matrix():
    """
    Status Logic Matrix:
    - AVAILABLE: STAT = '01' and QTY > 0
    - OUT_OF_STOCK: STAT = '01' and QTY <= 0
    - INACTIVE: otherwise
    """
    ctx = DataContext(workflow_id="wf_test")
    ctx.set_step_result(
        "fetch_nexacro_data",
        "SUCCESS",
        output={
            "metadata": {"error_code": 0, "error_msg": "SUCCESS", "total_count": 3},
            "raw_flattened": [
                {"ITEM_CD": "PUMP-01", "ITEM_NM": "Pump 1", "CAT_CD": "PUMP", "STAT": "01", "QTY": "15"},
                {"ITEM_CD": "PUMP-02", "ITEM_NM": "Pump 2", "CAT_CD": "PUMP", "STAT": "01", "QTY": "0"},
                {"ITEM_CD": "VALVE-99", "ITEM_NM": "Valve 99", "CAT_CD": "VALVE", "STAT": "02", "QTY": "5"},
            ]
        }
    )

    expr = """
    steps.fetch_nexacro_data.output.raw_flattened.[{
      "item_code": ITEM_CD,
      "item_name": ITEM_NM,
      "category_name": $lookup($globals.dict.CATEGORY, CAT_CD) ? $lookup($globals.dict.CATEGORY, CAT_CD) : "Other",
      "calculated_status": (
        STAT == '01' and $number(QTY) > 0 ? "AVAILABLE" :
        STAT == '01' and $number(QTY) <= 0 ? "OUT_OF_STOCK" : "INACTIVE"
      )
    }]
    """

    results = transform_jsonata(expr, ctx)
    assert len(results) == 3

    # Check Pump 1: STAT=01, QTY=15 -> AVAILABLE
    assert results[0]["item_code"] == "PUMP-01"
    assert results[0]["category_name"] == "Pressurized Equipment"
    assert results[0]["calculated_status"] == "AVAILABLE"

    # Check Pump 2: STAT=01, QTY=0 -> OUT_OF_STOCK
    assert results[1]["item_code"] == "PUMP-02"
    assert results[1]["category_name"] == "Pressurized Equipment"
    assert results[1]["calculated_status"] == "OUT_OF_STOCK"

    # Check Valve 99: STAT=02 -> INACTIVE
    assert results[2]["item_code"] == "VALVE-99"
    assert results[2]["category_name"] == "Pipeline Fittings"
    assert results[2]["calculated_status"] == "INACTIVE"
