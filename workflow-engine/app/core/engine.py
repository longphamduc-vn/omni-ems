import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import yaml

from app.config import settings
from app.core.data_context import DataContext
from app.core.memory_store import memory_store
from app.adapters.http_adapter import http_adapter, HttpAuthRequiredError
from app.adapters.jsonata_adapter import JsonataAdapter
from app.adapters.nexacro_parser import NexacroError
from app.adapters.subworkflow_adapter import subworkflow_adapter


class WorkflowNotFoundError(Exception):
    """Raised when a requested workflow definition cannot be found."""
    pass


class WorkflowExecutionError(Exception):
    """Raised when an unrecoverable error occurs during workflow step execution."""
    def __init__(self, message: str, step_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.step_id = step_id
        self.details = details or {}


class WorkflowEngine:
    """
    Workflow Engine Core (Domain-Agnostic Executor).
    Orchestrates pipeline steps, handles async I/O, renders templates,
    transforms via JSONata, and manages auth self-healing circuit breaker.
    """

    def __init__(self, workflows_dir: Optional[Union[str, Path]] = None):
        self.workflows_dir = Path(workflows_dir or settings.WORKFLOWS_DIR)
        self.workflows_dir.mkdir(parents=True, exist_ok=True)

        # Wire the subworkflow adapter callback to this engine instance
        subworkflow_adapter.set_engine_executor(self.execute)
        self.http_adapter = http_adapter

        # Automatically load existing YAML workflows from workflows_dir into memory_store
        self.load_workflows_from_disk()

    async def close(self) -> None:
        """Gracefully release HTTP adapter connections."""
        await self.http_adapter.close()

    def load_workflows_from_disk(self) -> None:
        """Scan workflows directory and register YAML files into memory store."""
        if not self.workflows_dir.exists():
            return
        for file_path in self.workflows_dir.glob("*.y*ml"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    if isinstance(data, dict) and "id" in data:
                        memory_store.register_workflow(data["id"], data)
            except Exception as e:
                print(f"[WorkflowEngine] Warning: Could not load workflow from {file_path}: {e}")

    def get_workflow_definition(
        self,
        workflow_id_or_def: Union[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Resolve workflow definition from in-memory cache, filesystem, or raw input."""
        if isinstance(workflow_id_or_def, dict):
            return workflow_id_or_def

        import textwrap
        raw_text = textwrap.dedent(str(workflow_id_or_def)).strip()

        # Check if it's a raw YAML string instead of an ID
        if "\n" in raw_text or "steps:" in raw_text or len(raw_text) > 100:
            try:
                parsed = yaml.safe_load(raw_text)
                if isinstance(parsed, dict):
                    return parsed
            except Exception as e:
                raise WorkflowExecutionError(f"Invalid inline YAML workflow definition: {e}")
            raise WorkflowNotFoundError("Inline YAML definition could not be parsed into a dictionary.")

        workflow_id = raw_text

        # 1. Check in-memory store
        wf_def = memory_store.get_workflow(workflow_id)
        if wf_def:
            return wf_def

        # 2. Check filesystem
        for ext in (".yaml", ".yml"):
            target_path = self.workflows_dir / f"{workflow_id}{ext}"
            if target_path.exists():
                with open(target_path, "r", encoding="utf-8") as f:
                    loaded = yaml.safe_load(f)
                    if isinstance(loaded, dict):
                        memory_store.register_workflow(workflow_id, loaded)
                        return loaded

        raise WorkflowNotFoundError(f"Workflow definition '{workflow_id}' not found in memory or disk.")

    async def execute(
        self,
        workflow_id: Optional[str] = None,
        workflow_definition: Optional[Union[str, Dict[str, Any]]] = None,
        inputs: Optional[Dict[str, Any]] = None,
        globals_override: Optional[Dict[str, Any]] = None,
        parent_execution_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute a complete workflow pipeline instance.
        """
        start_time = time.perf_counter()

        # 1. Resolve workflow definition
        definition_source = workflow_definition if workflow_definition is not None else workflow_id
        if not definition_source:
            raise ValueError("Either 'workflow_id' or 'workflow_definition' must be provided.")

        wf_def = self.get_workflow_definition(definition_source)
        active_wf_id = wf_def.get("id") or workflow_id or "anonymous_workflow"

        # 2. Prepare DataContext with default inputs merged with request inputs
        merged_inputs = dict(wf_def.get("inputs", {}))
        if inputs:
            merged_inputs.update(inputs)

        context = DataContext(
            workflow_id=active_wf_id,
            inputs=merged_inputs,
            globals_data=globals_override,
            execution_id=None,
        )

        steps = wf_def.get("steps", [])
        auth_step_info: Optional[Dict[str, Any]] = None

        # 3. Pipeline Step Execution
        for step_idx, step in enumerate(steps):
            step_id = step.get("id", f"step_{step_idx}")
            step_type = step.get("type")
            step_config = step.get("config", {})
            output_var = step_config.get("output_var")

            step_start = time.perf_counter()

            if step_type == "execute_sub_workflow":
                # Track auth step for potential self-healing
                sub_wf_id = step_config.get("workflow_id", "")
                if "auth" in sub_wf_id.lower() or "login" in sub_wf_id.lower():
                    auth_step_info = {"step_id": step_id, "config": step_config}

                try:
                    result = await subworkflow_adapter.execute(step_config, context)
                    step_duration = (time.perf_counter() - step_start) * 1000

                    # Store output
                    output_payload = {output_var: result} if output_var else result
                    if isinstance(result, dict) and output_var:
                        output_payload.update(result)

                    context.set_step_result(
                        step_id=step_id,
                        status="SUCCESS",
                        output=output_payload,
                        execution_time_ms=step_duration,
                    )
                except Exception as exc:
                    step_duration = (time.perf_counter() - step_start) * 1000
                    context.set_step_result(step_id, status="FAILED", error=str(exc), execution_time_ms=step_duration)
                    raise WorkflowExecutionError(f"Step '{step_id}' failed: {str(exc)}", step_id=step_id) from exc

            elif step_type == "http_request":
                # HTTP Request with Self-Healing mechanism
                try:
                    result = await http_adapter.execute(step_config, context)
                except (HttpAuthRequiredError, NexacroError) as exc:
                    # Self-Healing: Invalidate token, re-authenticate, and retry step once
                    is_auth_error = isinstance(exc, HttpAuthRequiredError) or (
                        isinstance(exc, NexacroError) and exc.error_code < 0
                    )
                    if is_auth_error:
                        print(f"[WorkflowEngine] Self-healing triggered on step '{step_id}': {exc}")
                        # Invalidate cached token
                        cache_key = auth_step_info["config"].get("cache_key", "global") if auth_step_info else "global"
                        subworkflow_adapter.invalidate_token(cache_key)

                        # Re-run auth step
                        fresh_auth_data = None
                        if auth_step_info:
                            fresh_auth_data = await subworkflow_adapter.execute(auth_step_info["config"], context)
                            auth_out_var = auth_step_info["config"].get("output_var")
                            auth_payload = {auth_out_var: fresh_auth_data} if auth_out_var else fresh_auth_data
                            if isinstance(fresh_auth_data, dict) and auth_out_var:
                                auth_payload.update(fresh_auth_data)
                            context.set_step_result(auth_step_info["step_id"], status="RETRIED", output=auth_payload)
                        else:
                            # Default fallback auth sub-workflow
                            fresh_auth_data = await subworkflow_adapter.execute({"workflow_id": "wf_auth_nexacro_global"}, context)

                        # Retry the failed HTTP request
                        result = await http_adapter.execute(step_config, context)
                    else:
                        step_duration = (time.perf_counter() - step_start) * 1000
                        context.set_step_result(step_id, status="FAILED", error=str(exc), execution_time_ms=step_duration)
                        raise WorkflowExecutionError(f"Step '{step_id}' failed: {str(exc)}", step_id=step_id) from exc
                except Exception as exc:
                    step_duration = (time.perf_counter() - step_start) * 1000
                    context.set_step_result(step_id, status="FAILED", error=str(exc), execution_time_ms=step_duration)
                    raise WorkflowExecutionError(f"Step '{step_id}' failed: {str(exc)}", step_id=step_id) from exc

                step_duration = (time.perf_counter() - step_start) * 1000
                output_payload = dict(result)
                if output_var:
                    output_payload[output_var] = result

                context.set_step_result(
                    step_id=step_id,
                    status="SUCCESS",
                    output=output_payload,
                    execution_time_ms=step_duration,
                )

            elif step_type == "transform_jsonata":
                expression = step_config.get("expression")
                if not expression:
                    raise WorkflowExecutionError(f"Step '{step_id}' requires 'expression' in config.", step_id=step_id)

                try:
                    transformed = JsonataAdapter.transform(expression, context)
                except Exception as exc:
                    step_duration = (time.perf_counter() - step_start) * 1000
                    context.set_step_result(step_id, status="FAILED", error=str(exc), execution_time_ms=step_duration)
                    raise WorkflowExecutionError(f"Step '{step_id}' JSONata transformation failed: {str(exc)}", step_id=step_id) from exc

                step_duration = (time.perf_counter() - step_start) * 1000
                if isinstance(transformed, list):
                    from app.core.data_context import OutputList
                    output_payload = OutputList(transformed, output_var=output_var)
                elif isinstance(transformed, dict):
                    output_payload = {output_var: transformed, **transformed} if output_var else transformed
                else:
                    output_payload = transformed

                context.set_step_result(
                    step_id=step_id,
                    status="SUCCESS",
                    output=output_payload,
                    execution_time_ms=step_duration,
                )

            else:
                raise WorkflowExecutionError(f"Unsupported step type: '{step_type}' in step '{step_id}'", step_id=step_id)

        # 4. Resolve Response Schema
        total_time_ms = int((time.perf_counter() - start_time) * 1000)
        response_template = wf_def.get("response", {})

        return self._build_final_response(response_template, context, active_wf_id, total_time_ms)

    def _build_final_response(
        self,
        response_template: Dict[str, Any],
        context: DataContext,
        workflow_id: str,
        total_time_ms: int,
    ) -> Dict[str, Any]:
        """Resolve response payload per Section 5.2."""
        final_response: Dict[str, Any] = {
            "status": "COMPLETED",
            "workflow_id": workflow_id,
            "execution_time_ms": total_time_ms,
        }

        # Resolve each key in response_template
        for key, val in response_template.items():
            if key == "status":
                final_response["status"] = "COMPLETED"
                continue
            if isinstance(val, str):
                trimmed = val.strip()
                # Check for single reference pattern "{{ ... }}"
                match = re.fullmatch(r"\{\{\s*([a-zA-Z0-9_$.]+)\s*\}\}", trimmed)
                if match:
                    path = match.group(1)
                    resolved = context.resolve_path(path)
                    final_response[key] = resolved
                else:
                    # Jinja string rendering if contains {{ ... }}
                    if "{{" in trimmed or "{%" in trimmed:
                        from jinja2 import Template
                        tmpl = Template(trimmed)
                        final_response[key] = tmpl.render(context.to_template_context())
                    else:
                        final_response[key] = val
            else:
                final_response[key] = val

        # Ensure metadata and data exist per specification
        if "metadata" not in final_response:
            # Fallback to last executed step with metadata
            for step_data in reversed(list(context.steps.values())):
                out = step_data.get("output")
                if isinstance(out, dict) and "metadata" in out:
                    final_response["metadata"] = out["metadata"]
                    break
            if "metadata" not in final_response:
                final_response["metadata"] = {"error_code": 0, "error_msg": "SUCCESS", "total_count": 0}

        if "data" not in final_response:
            # Fallback to last step output
            if context.steps:
                last_step = list(context.steps.values())[-1]
                final_response["data"] = last_step.get("output")
            else:
                final_response["data"] = []

        return final_response


# Global Singleton Instance
workflow_engine = WorkflowEngine()
