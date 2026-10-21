import time
import pytest
from app.core.memory_store import MemoryStore


def test_token_caching_and_ttl():
    store = MemoryStore(token_ttl=1)  # 1 second TTL
    store.set_token("test_session", {"token": "JSESSIONID_TEST_123"})

    # Immediate retrieval succeeds
    cached = store.get_token("test_session")
    assert cached is not None
    assert cached["token"] == "JSESSIONID_TEST_123"

    # Invalidate token
    assert store.invalidate_token("test_session") is True
    assert store.get_token("test_session") is None


def test_dictionary_cache():
    store = MemoryStore()
    cat_dict = store.get_dictionary("CATEGORY")
    assert cat_dict is not None
    assert cat_dict.get("PUMP") == "Pressurized Equipment"

    # Custom category registration
    store.set_dictionary("PLANT_SECTION", {"SEC01": "Clean Room 1", "SEC02": "Sub-fab"})
    assert store.get_dictionary("PLANT_SECTION")["SEC01"] == "Clean Room 1"


def test_workflow_registration():
    store = MemoryStore()
    wf_data = {"id": "test_wf", "name": "Test Workflow", "steps": []}
    store.register_workflow("test_wf", wf_data)

    retrieved = store.get_workflow("test_wf")
    assert retrieved == wf_data
    assert "test_wf" in store.list_workflows()


def test_supplier_translation_dictionary():
    store = MemoryStore()
    supplier_dict = store.get_dictionary("SUPPLIER")
    assert supplier_dict is not None
    assert supplier_dict["LGDVN_(주)와이티에스_KR017796"] == "LGDVN YTS Co., Ltd. (KR017796)"
    assert supplier_dict["LGDVN_(주) 서브원_KR017765"] == "LGDVN Serveone Co., Ltd. (KR017765)"

