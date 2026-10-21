import time
import threading
from typing import Any, Dict, List, Optional
from cachetools import TTLCache, LRUCache
from app.config import settings


class MemoryStore:
    """Thread-safe In-Memory Store managing tokens, dictionaries, and workflow definitions."""

    def __init__(self, token_ttl: int = settings.AUTH_TOKEN_TTL_SECONDS, maxsize: int = settings.MAX_CACHE_SIZE):
        self._lock = threading.RLock()
        self._token_ttl = token_ttl
        # TTLCache automatically discards expired entries
        self._token_cache: TTLCache = TTLCache(maxsize=maxsize, ttl=token_ttl)
        # Dictionary cache for code translations (e.g. CATEGORY, STATUS_CODES)
        self._dict_cache: LRUCache = LRUCache(maxsize=maxsize)
        # Workflow definitions in-memory registry
        self._workflow_definitions: Dict[str, Dict[str, Any]] = {}

        # Initialize default dictionary cache
        self._init_default_dictionaries()

    def _init_default_dictionaries(self) -> None:
        """Seed default enterprise code dictionaries extracted from Nexacro EMS production traces (t1.txt)."""
        self._dict_cache["CATEGORY"] = {
            "PUMP": "Pressurized Equipment",
            "VALVE": "Pipeline Fittings",
            "MOTOR": "Electrical Motors",
            "SENSOR": "Instrumentation & Sensors",
            "BEARING": "Rotating Elements",
            "Q4.Joint/Connector": "Joint / Rotary Connector",
            "Q4.Mercury Lamp": "Exposure Mercury Lamp",
            "Q4.Vacuum Pad": "Vacuum Suction Pad",
            "Q4.Pneumatic Cylinder": "Pneumatic Cylinder",
            "Q4.Solenoid Valve": "Solenoid Valve",
        }
        self._dict_cache["STATUS"] = {
            "01": "Active / In-Use",
            "02": "Maintenance Pending",
            "03": "Decommissioned",
            "99": "Disposed",
            "Active": "Active / In-Use",
        }
        # Extracted from t1.txt ds_output0 (retrieveTargetApplyType)
        self._dict_cache["TARGET_APPLY_TYPE"] = {
            "OPTIMIZATION": "Optimized (All)",
            "OPTIMIZATION_NON_PERIOD": "Optimized (Unplanned)",
            "NON_OPTIMIZED": "Non-Optimized",
        }
        # Extracted from t1.txt ds_output1 (retrieveBuyItemType)
        self._dict_cache["BUY_ITEM_TYPE"] = {
            "N001": "Individual Management",
            "N002": "Total Management",
            "N004": "Repair Parts Management",
            "통합 관리": "Total Management",
            "개별 관리": "Individual Management",
        }
        # Supplier / Vendor Translation Dictionary (from translations table in DB)
        self._dict_cache["SUPPLIER"] = {
            "LGDVN_(주)와이티에스_KR017796": "LGDVN YTS Co., Ltd. (KR017796)",
            "LGDVN_(주) 서브원_KR017765": "LGDVN Serveone Co., Ltd. (KR017765)",
        }
        # Tooltip Translations
        self._dict_cache["TOOLTIP"] = {
            "빨간색 : 구매 불가 Parts": "Red: Non-purchasable Parts",
            "고월령, 장기미사용 등을 고려하여 이관 가능하다고 판단되는 재고": "Candidate for transfer (aged / long-term unused inventory)",
        }
        # PO Type Translations
        self._dict_cache["PO_TYPE"] = {
            "원 법인 구매": "Original Entity Purchase",
            "PT003": "Original Entity Purchase",
        }
        # Price Registration Status Translations
        self._dict_cache["PRICE_REG_STATUS"] = {
            "단가 등록": "Price Registered",
        }
        # Extracted from t1.txt ds_output2 (retrieveRepairCategory)
        self._dict_cache["REPAIR_CATEGORY"] = {
            "RT001": "In-house Repair (자체 수리)",
            "RT002": "Outsourced Repair (외주 수리)",
        }
        # Extracted from t1.txt ds_output3 (retrieveOrganizationId)
        self._dict_cache["ORGANIZATION"] = {
            "101": "A01 (LG Display Korea Gumi Asset)",
            "132": "A02 (LG Display Korea Paju Asset)",
            "297": "A03 (LG Display Nanjing Asset)",
            "298": "A04 (LG Display Wroclaw Asset)",
            "299": "A05 (LG Display Guangzhou Asset)",
            "6254": "A06 (LG Display Yantai Asset)",
            "12705": "A07 (LG Display U.S.A Asset)",
            "12708": "A08 (LG Display Reynosa Asset)",
            "16812": "A09 (LG Display CA Asset)",
            "20312": "A10 (LG Display Yantai Asset(NY.Heesung))",
            "24853": "A11 (LG Display Korea Ochang Asset)",
            "28753": "A13 (LG Display Vietnam Asset)",
            "32248": "A14 (LG Display CO Asset)",
            "58514": "CA1 (CSOT CA Asset)",
            "58571": "CA2 (CSOT Guangzhou Asset)",
        }

    # ==========================================
    # Token Cache Operations
    # ==========================================

    def get_token(self, key: str = "global") -> Optional[Dict[str, Any]]:
        """Retrieve token data if present and within TTL."""
        with self._lock:
            data = self._token_cache.get(key)
            if data is not None:
                return data
            return None

    def set_token(self, key: str, token_data: Dict[str, Any], ttl: Optional[int] = None) -> None:
        """Store token data with TTL in memory cache."""
        with self._lock:
            # If custom TTL is provided and differs from default, we can store with timestamp metadata
            if ttl is not None and ttl != self._token_ttl:
                # Custom cache instance or metadata wrapper
                token_data["_cached_at"] = time.time()
                token_data["_expires_at"] = time.time() + ttl
            else:
                token_data["_cached_at"] = time.time()
                token_data["_expires_at"] = time.time() + self._token_ttl

            self._token_cache[key] = token_data

    def invalidate_token(self, key: str = "global") -> bool:
        """Purge token from cache (used by self-healing circuit breaker)."""
        with self._lock:
            if key in self._token_cache:
                del self._token_cache[key]
                return True
            return False

    def clear_token_cache(self) -> None:
        """Purge all cached tokens."""
        with self._lock:
            self._token_cache.clear()

    # ==========================================
    # Dictionary Cache Operations
    # ==========================================

    def get_dictionary(self, category: str) -> Optional[Dict[str, Any]]:
        """Retrieve code lookup table for a given category."""
        with self._lock:
            return self._dict_cache.get(category)

    def set_dictionary(self, category: str, mapping: Dict[str, Any]) -> None:
        """Register or update code lookup table."""
        with self._lock:
            self._dict_cache[category] = mapping

    def get_all_dictionaries(self) -> Dict[str, Dict[str, Any]]:
        """Return all code translation dictionaries."""
        with self._lock:
            return dict(self._dict_cache)

    # ==========================================
    # Workflow Definition Registry
    # ==========================================

    def register_workflow(self, workflow_id: str, definition: Dict[str, Any]) -> None:
        """Register or update in-memory workflow definition."""
        with self._lock:
            self._workflow_definitions[workflow_id] = definition

    def get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve registered workflow definition."""
        with self._lock:
            return self._workflow_definitions.get(workflow_id)

    def list_workflows(self) -> List[str]:
        """List all registered workflow IDs."""
        with self._lock:
            return list(self._workflow_definitions.keys())

    def clear_all(self) -> None:
        """Reset all in-memory stores."""
        with self._lock:
            self._token_cache.clear()
            self._dict_cache.clear()
            self._workflow_definitions.clear()
            self._init_default_dictionaries()


# Global Singleton Instance
memory_store = MemoryStore()
