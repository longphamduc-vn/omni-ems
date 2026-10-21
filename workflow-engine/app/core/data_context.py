import time
import uuid
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from app.core.memory_store import memory_store


class OutputList(list):
    """A list subclass that preserves list serialization while supporting output_var indexing/attributes."""
    def __init__(self, items, output_var=None):
        super().__init__(items)
        self.output_var = output_var
        if output_var:
            setattr(self, output_var, self)

    def __getitem__(self, key):
        if isinstance(key, str) and key == self.output_var:
            return self
        return super().__getitem__(key)


class StepResult(BaseModel):
    """Execution status and output for an individual workflow step."""
    status: str = "PENDING"  # PENDING, RUNNING, SUCCESS, FAILED, RETRIED
    output: Any = None
    error: Optional[str] = None
    execution_time_ms: Optional[float] = None


class DataContext:
    """
    Centralized In-Memory Execution State Manager for a workflow run instance.
    Adheres strictly to Technical Specification Section 2.2.
    """

    def __init__(
        self,
        workflow_id: str,
        inputs: Optional[Dict[str, Any]] = None,
        globals_data: Optional[Dict[str, Any]] = None,
        execution_id: Optional[str] = None,
    ):
        timestamp_str = time.strftime("%Y%m%d")
        hex_suffix = uuid.uuid4().hex[:8]
        self.execution_id = execution_id or f"exec_{timestamp_str}_{hex_suffix}"
        self.workflow_id = workflow_id
        self.inputs = inputs or {}

        # Initialize globals with memory_store dictionaries and cached auth token if available
        self.globals: Dict[str, Any] = {
            "auth_token": None,
            "dict": memory_store.get_all_dictionaries(),
        }

        # Check if a valid session token exists in cache
        cached_token_data = memory_store.get_token("global")
        if cached_token_data and "token" in cached_token_data:
            self.globals["auth_token"] = cached_token_data["token"]

        # Merge any user-provided globals overrides
        if globals_data:
            if "dict" in globals_data:
                self.globals["dict"].update(globals_data["dict"])
            for k, v in globals_data.items():
                if k != "dict":
                    self.globals[k] = v

        # Steps dictionary tracking step statuses and outputs
        self.steps: Dict[str, Dict[str, Any]] = {}

    def set_step_result(
        self,
        step_id: str,
        status: str,
        output: Any = None,
        error: Optional[str] = None,
        execution_time_ms: Optional[float] = None,
    ) -> None:
        """Record the execution outcome of a workflow step."""
        self.steps[step_id] = {
            "status": status,
            "output": output,
            "error": error,
            "execution_time_ms": execution_time_ms,
        }

    def get_step_output(self, step_id: str, default: Any = None) -> Any:
        """Retrieve output of a previously executed step."""
        step = self.steps.get(step_id)
        if step and "output" in step:
            return step["output"]
        return default

    def resolve_path(self, path: str, default: Any = None) -> Any:
        """
        Resolve a dot-notated path against the DataContext
        (e.g., 'steps.get_auth.output.session_data.token', 'inputs.keyword', '$globals.dict').
        """
        # Strip leading '$' or '$$' if present from JSONata conventions
        normalized_path = path.lstrip("$")
        parts = normalized_path.split(".")

        root_map = {
            "execution_id": self.execution_id,
            "workflow_id": self.workflow_id,
            "inputs": self.inputs,
            "globals": self.globals,
            "steps": self.steps,
        }

        curr: Any = root_map
        for part in parts:
            if isinstance(curr, dict) and part in curr:
                curr = curr[part]
            elif isinstance(curr, (list, tuple)) and part.isdigit():
                idx = int(part)
                if 0 <= idx < len(curr):
                    curr = curr[idx]
                else:
                    return default
            elif hasattr(curr, part):
                curr = getattr(curr, part)
            else:
                return default
        return curr

    def to_template_context(self) -> Dict[str, Any]:
        """Convert DataContext into standard dictionary for Jinja2 rendering."""
        return {
            "execution_id": self.execution_id,
            "workflow_id": self.workflow_id,
            "inputs": self.inputs,
            "globals": self.globals,
            "steps": self.steps,
        }

    def to_dict(self) -> Dict[str, Any]:
        """Convert DataContext into JSON-serializable dictionary."""
        return {
            "execution_id": self.execution_id,
            "workflow_id": self.workflow_id,
            "inputs": self.inputs,
            "globals": self.globals,
            "steps": self.steps,
        }
