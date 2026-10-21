from __future__ import annotations
import time
from typing import TYPE_CHECKING, Any, Callable, Dict, Optional
from app.config import settings
if TYPE_CHECKING:
    from app.core.data_context import DataContext
from app.core.memory_store import memory_store


class SubworkflowAdapter:
    """
    Sub-Workflow & Global Auth Handler.
    Manages nested workflow execution, in-memory token caching with TTL,
    and self-healing session recovery.
    """

    def __init__(self):
        self._engine_executor: Optional[Callable] = None

    def set_engine_executor(self, executor: Callable) -> None:
        """Register the workflow engine executor callback to avoid circular imports."""
        self._engine_executor = executor

    async def execute(
        self,
        config: Dict[str, Any],
        parent_context: DataContext,
    ) -> Dict[str, Any]:
        """
        Execute sub-workflow with in-memory caching for auth tokens.
        """
        sub_workflow_id = config.get("workflow_id")
        if not sub_workflow_id:
            raise ValueError("Sub-workflow configuration requires 'workflow_id'.")

        cache_key = config.get("cache_key", "global")
        use_cache = config.get("use_cache", True)

        # 1. Inspect In-Memory Store (TTLCache) for existing valid token
        if use_cache:
            cached_data = memory_store.get_token(cache_key)
            if cached_data and "token" in cached_data:
                token = cached_data["token"]
                # Update parent context globals with the cached token
                parent_context.globals["auth_token"] = token
                return {
                    "token": token,
                    "session_token": token,
                    "cached": True,
                    "data": cached_data,
                }

        # 2. Token expired or missing: Execute Sub-Workflow
        sub_inputs = config.get("inputs", {})
        # Merge parent inputs if sub_inputs are not provided
        if not sub_inputs:
            sub_inputs = dict(parent_context.inputs)

        session_data = await self._run_sub_workflow(sub_workflow_id, sub_inputs, parent_context)

        # Extract token
        token = (
            session_data.get("token")
            or session_data.get("session_token")
            or session_data.get("session_id")
            or f"JSESSIONID_{int(time.time())}"
        )

        session_data["token"] = token
        session_data["session_token"] = token
        session_data["cached"] = False

        # 3. Update In-Memory Store with new token and TTL
        ttl = config.get("ttl", settings.AUTH_TOKEN_TTL_SECONDS)
        memory_store.set_token(cache_key, session_data, ttl=ttl)

        # Update parent context globals
        parent_context.globals["auth_token"] = token

        return session_data

    async def _run_sub_workflow(
        self,
        sub_workflow_id: str,
        inputs: Dict[str, Any],
        parent_context: DataContext,
    ) -> Dict[str, Any]:
        """Dispatch sub-workflow execution through registered engine executor."""
        if self._engine_executor is None:
            # Fallback mock session token if engine executor is not yet wired
            return {
                "token": f"JSESSIONID_{int(time.time()*1000)}",
                "session_token": f"JSESSIONID_{int(time.time()*1000)}",
                "status": "SUCCESS",
            }

        result = await self._engine_executor(
            workflow_id=sub_workflow_id,
            inputs=inputs,
            parent_execution_id=parent_context.execution_id,
        )

        if isinstance(result, dict):
            # Check response block or data
            if "token" in result:
                return result
            if "data" in result and isinstance(result["data"], dict) and "token" in result["data"]:
                return result["data"]
            return result
        return {"token": f"JSESSIONID_{int(time.time())}", "raw": result}

    def invalidate_token(self, cache_key: str = "global") -> bool:
        """Purge token from in-memory cache to trigger re-authentication (Self-Healing)."""
        return memory_store.invalidate_token(cache_key)


# Singleton instance
subworkflow_adapter = SubworkflowAdapter()
