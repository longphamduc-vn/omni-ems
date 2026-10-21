import pytest
from app.core.data_context import DataContext


def test_data_context_initialization():
    ctx = DataContext(
        workflow_id="wf_test",
        inputs={"keyword": "PUMP-2026", "count": 10},
        globals_data={"custom_global": "val123"}
    )
    assert ctx.workflow_id == "wf_test"
    assert ctx.execution_id.startswith("exec_")
    assert ctx.inputs["keyword"] == "PUMP-2026"
    assert ctx.globals["custom_global"] == "val123"
    assert "CATEGORY" in ctx.globals["dict"]


def test_data_context_step_recording_and_resolution():
    ctx = DataContext(workflow_id="wf_test", inputs={"keyword": "PUMP-2026"})
    ctx.set_step_result(
        step_id="get_auth",
        status="SUCCESS",
        output={"session_data": {"token": "TOKEN_ABC"}}
    )

    # Resolve paths
    assert ctx.resolve_path("inputs.keyword") == "PUMP-2026"
    assert ctx.resolve_path("steps.get_auth.output.session_data.token") == "TOKEN_ABC"
    assert ctx.resolve_path("steps.get_auth.status") == "SUCCESS"
    assert ctx.resolve_path("globals.dict.CATEGORY.PUMP") == "Pressurized Equipment"
    assert ctx.resolve_path("non.existent.path", default="fallback") == "fallback"


def test_to_dict_and_template_context():
    ctx = DataContext(workflow_id="wf_test", inputs={"a": 1})
    d = ctx.to_dict()
    assert d["workflow_id"] == "wf_test"
    assert "inputs" in d
    assert "globals" in d
    assert "steps" in d
