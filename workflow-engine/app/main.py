from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.core.engine import workflow_engine, WorkflowNotFoundError, WorkflowExecutionError
from app.core.memory_store import memory_store
from app.adapters.http_adapter import http_adapter


# ==========================================
# Pydantic Schemas
# ==========================================

class ExecuteWorkflowRequest(BaseModel):
    workflow_id: Optional[str] = Field(None, description="Registered workflow ID to execute")
    workflow_definition: Optional[Union[Dict[str, Any], str]] = Field(
        None, description="Inline workflow YAML definition or parsed dict"
    )
    inputs: Dict[str, Any] = Field(default_factory=dict, description="Input parameters passed to the workflow")
    globals: Optional[Dict[str, Any]] = Field(None, description="Optional globals overrides")


class WorkflowResponse(BaseModel):
    status: str
    workflow_id: str
    execution_time_ms: int
    metadata: Dict[str, Any]
    data: Any


class WorkflowRegisterRequest(BaseModel):
    workflow_id: str
    definition: Dict[str, Any]


# ==========================================
# Lifespan Management
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure workflows are loaded
    workflow_engine.load_workflows_from_disk()
    yield
    # Shutdown: close persistent HTTP client
    await http_adapter.close()


# ==========================================
# FastAPI Application
# ==========================================

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Domain-agnostic middle-tier data fusion and workflow engine for Legacy EMS integration.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files & Demo Studio UI
STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", include_in_schema=False)
@app.get("/ui", include_in_schema=False)
async def serve_demo_ui():
    """Serve the interactive Demo Studio UI."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Demo UI index not found"}



# ==========================================
# Core Workflow Execution Endpoint
# ==========================================

@app.post(
    "/api/v1/workflows/execute",
    response_model=WorkflowResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute a workflow by ID or dynamic definition",
    description="Dispatches workflow execution through the async execution pipeline (Section 5.2).",
)
async def execute_workflow(payload: ExecuteWorkflowRequest):
    if not payload.workflow_id and not payload.workflow_definition:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'workflow_id' or 'workflow_definition' must be supplied.",
        )

    try:
        result = await workflow_engine.execute(
            workflow_id=payload.workflow_id,
            workflow_definition=payload.workflow_definition,
            inputs=payload.inputs,
            globals_override=payload.globals,
        )
        return result

    except WorkflowNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except WorkflowExecutionError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "status": "FAILED",
                "message": str(e),
                "step_id": e.step_id,
                "details": e.details,
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unhandled engine error: {str(e)}",
        )


# ==========================================
# Workflow Registry Management Endpoints
# ==========================================

@app.get("/api/v1/workflows", summary="List registered workflows")
async def list_workflows():
    workflow_engine.load_workflows_from_disk()
    return {
        "status": "SUCCESS",
        "workflows": memory_store.list_workflows(),
    }


@app.get("/api/v1/workflows/{workflow_id}", summary="Get workflow definition")
async def get_workflow(workflow_id: str):
    try:
        wf_def = workflow_engine.get_workflow_definition(workflow_id)
        return {"status": "SUCCESS", "workflow_id": workflow_id, "definition": wf_def}
    except WorkflowNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow '{workflow_id}' not found")


@app.post("/api/v1/workflows", summary="Register workflow definition")
async def register_workflow(payload: WorkflowRegisterRequest):
    memory_store.register_workflow(payload.workflow_id, payload.definition)
    return {
        "status": "SUCCESS",
        "message": f"Workflow '{payload.workflow_id}' registered successfully.",
        "workflow_id": payload.workflow_id,
    }


@app.post("/api/v1/workflows/reload", summary="Reload workflow definitions from disk")
async def reload_workflows():
    workflow_engine.load_workflows_from_disk()
    memory_store._init_default_dictionaries()
    return {
        "status": "SUCCESS",
        "workflows_loaded": len(memory_store.list_workflows()),
        "dictionaries": list(memory_store.get_all_dictionaries().keys()),
    }



# ==========================================
# Cache & Dictionary Management Endpoints
# ==========================================

@app.get("/api/v1/cache/token", summary="Inspect in-memory auth token cache")
async def get_cached_token():
    token = memory_store.get_token("global")
    return {"status": "SUCCESS", "cached": token is not None, "token_data": token}


@app.post("/api/v1/cache/clear", summary="Purge auth token cache (Self-Healing test)")
async def clear_cache():
    memory_store.clear_token_cache()
    return {"status": "SUCCESS", "message": "Auth token cache cleared."}


@app.get("/api/v1/cache/dictionaries", summary="Get all code dictionaries")
async def get_dictionaries():
    return {"status": "SUCCESS", "dictionaries": memory_store.get_all_dictionaries()}


@app.put("/api/v1/cache/dictionaries/{category}", summary="Update or register a code dictionary")
async def update_dictionary(category: str, mapping: Dict[str, Any]):
    memory_store.set_dictionary(category, mapping)
    return {"status": "SUCCESS", "category": category, "count": len(mapping)}


# ==========================================
# Health Check Endpoint
# ==========================================

@app.get("/health", summary="Engine health check")
@app.get("/api/v1/health", summary="Engine health check")
async def health_check():
    return {
        "status": "ONLINE",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "workflows_loaded": len(memory_store.list_workflows()),
    }
