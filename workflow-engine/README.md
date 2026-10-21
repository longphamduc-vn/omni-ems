# Workflow Engine & Data Fusion Layer (Legacy EMS Integration)

> **Modernization Pattern:** Strangler Fig Pattern (Parallel / Incremental Migration)  
> **Runtime Stack:** Python 3.11+ / FastAPI / `httpx` (Async I/O) / Jinja2 / JSONata (`jsonata-python`) / `xmltodict` / `cachetools`  
> **Specification Version:** 1.1.0  
> **Status:** Production-Ready Implementation

---

## 1. Architectural Overview & Design Principles

The **Workflow Engine & Data Fusion Layer** acts as an independent, domain-agnostic middle-tier execution engine for modernizing legacy platforms (such as LG Display EMS built on Nexacro Platform). Because the legacy platform functions as a black-box system where backend source code and database schemas cannot be modified directly, this engine performs:
- **On-demand legacy scraping & XML payload compilation** via Jinja2 templates.
- **Asynchronous HTTP transport** using connection-pooled `httpx.AsyncClient` supporting both Single (batch) and Loop (bounded concurrency) execution modes.
- **Nexacro XML response unpacking & dataset flattening** into normalized JSON arrays of objects.
- **In-memory session token caching** with automatic TTL management (`cachetools.TTLCache`).
- **Autonomous self-healing circuit breaker** that detects session expirations (HTTP `401`/`403` or negative Nexacro `ErrorCode`), invalidates cached tokens, executes fresh re-authentication, and transparently retries failed operations.
- **Real-time data fusion & enrichment** via JSONata expressions, evaluating multi-column status matrices and translating domain codes via in-memory dictionaries.

```text
[PRIMARY BUSINESS APP / CLIENT]
       │
       │ (1) Dispatch Execution Request: { workflow_id / definition, inputs }
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FASTAPI WORKFLOW ENGINE CORE                         │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 1. GLOBAL ROUTER & AUTH SUB-WORKFLOW HANDLER                      │  │
│  │    - Reuse valid session tokens from In-Memory Cache (cachetools) │  │
│  │    - 0ms network overhead when token within TTL (3600s)           │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 2. DYNAMIC PAYLOAD BUILDER STEP (Jinja2 Templates)                │  │
│  │    - Batch Mode: Renders 1 multi-row Dataset XML                  │  │
│  │    - Loop Mode: Renders N single-item XML payloads                │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 3. ASYNC ADAPTER LAYER (httpx AsyncClient Engine)                 │  │
│  │    - Batch Mode: Dispatches 1 HTTP POST Batch request             │  │
│  │    - Loop Mode: Dispatches N concurrent requests (Semaphore Pool) │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 4. RESPONSE PARSER & DATASET FLATTENER                            │  │
│  │    - Control Params (ErrorCode/ErrorMsg) -> Self-healing / Retry  │  │
│  │    - Dataset Flattener -> Unpacks nested XML to Array of Objects  │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 5. TRANSFORMATION, ENRICHMENT & COMPUTED FIELDS (JSONata)         │  │
│  │    - Translates codes using Local Dictionary Cache ($globals.dict)│  │
│  │    - Evaluates multi-column logical status matrix                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     │ (2) Returns Normalized JSON Response
                                     ▼
                     [PRIMARY BUSINESS APP / CLIENT]
```

> 📊 **PlantUML Architecture Diagrams:** Chi tiết 5 sơ đồ PlantUML mô tả cơ chế hoạt động, luồng thực thi, Self-Healing và Concurrency xem tại [docs/ARCHITECTURE_DIAGRAMS.md](docs/ARCHITECTURE_DIAGRAMS.md).

---

## 2. Project Structure

Adheres strictly to Technical Specification Section 5.1:

```text
workflow-engine/
├── app/
│   ├── main.py                     # FastAPI Application Entrypoint & REST APIs
│   ├── config.py                   # System Configuration Settings (Pydantic)
│   ├── core/
│   │   ├── engine.py               # Global Workflow Execution Core
│   │   ├── data_context.py         # DataContext Class Definition & Path Resolver
│   │   └── memory_store.py         # Cachetools In-Memory Store Interface (TTLCache)
│   ├── adapters/
│   │   ├── http_adapter.py         # Async HTTP Adapter (Batch & Loop Modes)
│   │   ├── nexacro_parser.py       # XML Parser & Dataset Flattener
│   │   ├── jsonata_adapter.py      # JSONata Transformation Adapter
│   │   └── subworkflow_adapter.py  # Nested Sub-Workflow & Auth Handler
│   ├── templates/                  # Base Jinja2 XML Templates Directory
│   │   ├── nexacro_search_template.xml.j2
│   │   └── nexacro_auth_template.xml.j2
│   └── workflows/                  # Pre-defined Workflow YAML Definitions
│       ├── wf_auth_nexacro_global.yaml
│       ├── wf_search_and_enrich.yaml
│       └── wf_loop_item_details.yaml
├── tests/                          # 100% Automated Test Suite (Pytest)
│   ├── test_data_context.py
│   ├── test_memory_store.py
│   ├── test_nexacro_parser.py
│   ├── test_jsonata_adapter.py
│   ├── test_self_healing_and_dynamic.py
│   └── test_workflow_engine_end_to_end.py
├── pytest.ini
├── requests.http                   # VS Code / HTTP Client Test Requests
├── requirements.txt
└── README.md
```

---

## 3. Core Engine Components

### 3.1 Central Data Context (`DataContext`)
The execution state manager for a single workflow run instance:
- `execution_id`: Auto-generated unique identifier (e.g. `exec_20261021_9f8a2b1c`).
- `workflow_id`: Active workflow identifier.
- `inputs`: User-supplied input parameters merged with YAML defaults.
- `globals`: Shared runtime values, including `auth_token` and `dict` (code translation dictionary).
- `steps`: Step execution history, status, timing, and step outputs.

### 3.2 In-Memory Store & Session Management (`MemoryStore`)
- Built on `cachetools.TTLCache` (default TTL: $3600\text{s}$, size: 1000).
- Stores session tokens keyed by `cache_key` ("global"). Subsequent calls within the TTL return the token with **0ms network overhead**.
- Built-in enterprise code translation dictionaries (`CATEGORY`, `STATUS`).
- Dynamic registry for workflow definitions loaded at startup or ingested via API.

### 3.3 Dynamic Payload Builder & HTTP Adapter (`HttpAdapter`)
- Powered by `httpx.AsyncClient` with TCP Keep-Alive connection pooling.
- **Batch / Single Mode:** Renders 1 multi-row XML payload via Jinja2 loop directives (`{% for item in inputs.items %}`).
- **Loop / Iterative Mode:** Renders individual payloads for items in `loop_over` (e.g., `inputs.items`) and dispatches concurrent async requests bounded by `asyncio.Semaphore(max_concurrency)` (default: 5).

### 3.4 Response Parsing & Dataset Flattening (`NexacroParser`)
- Extracts control parameters (`errorCode`, `errorMsg`) and metadata (`TotalCount`).
- Unpacks `<Dataset id="...">` `<ColumnInfo>` and `<Rows><Row><Col>` XML structures into clean JSON Arrays of Objects (`raw_flattened`).
- Raises `NexacroError` when `errorCode < 0` to activate self-healing or fail-safe error handling.

### 3.5 Data Fusion & JSONata Adapter (`JsonataAdapter`)
- Normalizes expression syntax (e.g., automatically sanitizing `==` to JSONata `=` outside string literals).
- Injects `$globals`, `$inputs`, and `$steps` as bound variables.
- Evaluates the status logic matrix:
  $$\text{Calculated Status} = \begin{cases} \text{"AVAILABLE"} & \text{if } \text{STAT} = \text{'01'} \text{ and } \text{QTY} > 0 \\ \text{"OUT\_OF\_STOCK"} & \text{if } \text{STAT} = \text{'01'} \text{ and } \text{QTY} \le 0 \\ \text{"INACTIVE"} & \text{otherwise} \end{cases}$$

### 3.6 Autonomous Self-Healing Circuit Breaker
When an operational step encounters HTTP `401`/`403` or a negative `ErrorCode` from Nexacro:
1. Detects session expiration or authorization loss.
2. Purges the cached token from `MemoryStore`.
3. Re-executes the authentication sub-workflow (`wf_auth_nexacro_global`) to establish a fresh session.
4. Updates `DataContext.globals["auth_token"]` and the auth step output.
5. Retries the failed operational step transparently.

---

## 4. API Reference

### 4.1 Execute Workflow
* **Method & URL:** `POST /api/v1/workflows/execute`
* **Headers:** `Content-Type: application/json`

#### Request Payload (Execute by Workflow ID):
```json
{
  "workflow_id": "wf_search_and_enrich",
  "inputs": {
    "keyword": "QCAD57452",
    "status_filter": "ACTIVE",
    "items": [{"code": "QCAD57452"}]
  }
}
```

#### Request Payload (Execute by Dynamic Inline Definition):
```json
{
  "workflow_definition": "id: my_dynamic_wf\nsteps:\n  - id: t\n    type: transform_jsonata\n    config:\n      expression: 'inputs.items'\nresponse:\n  status: SUCCESS\n  data: '{{ steps.t.output }}'",
  "inputs": {
    "items": [{"code": "A1"}]
  }
}
```

#### Response Payload (200 OK):
```json
{
  "status": "COMPLETED",
  "workflow_id": "wf_search_and_enrich",
  "execution_time_ms": 235,
  "metadata": {
    "error_code": 1,
    "error_msg": "SUCCESS",
    "total_count": 1
  },
  "data": [
    {
      "item_code": "QCAD57452",
      "item_name": "Vacuum Pad(except Robot) ** ZPT04USK6-04-A8",
      "category_name": "Other",
      "calculated_status": "AVAILABLE"
    }
  ]
}
```

### 4.2 Supplementary Endpoints
- `GET /api/v1/health`: System health and loaded workflow count.
- `GET /api/v1/workflows`: List all registered workflow IDs.
- `GET /api/v1/workflows/{id}`: Inspect workflow definition.
- `POST /api/v1/workflows`: Register a new workflow definition dynamically.
- `GET /api/v1/cache/token`: Inspect current cached session token.
- `POST /api/v1/cache/clear`: Purge cached session token.
- `GET /api/v1/cache/dictionaries`: Inspect code translation dictionaries.
- `PUT /api/v1/cache/dictionaries/{category}`: Update or register code dictionaries.

---

## 5. Getting Started & Testing

### 5.1 Installation
```bash
cd workflow-engine
pip install -r requirements.txt
```

### 5.2 Running the Workflow Engine
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5.3 Running the Automated Test Suite
```bash
pytest -v
```
All 14 unit and integration tests will execute, validating:
- `DataContext` lifecycle and path navigation.
- `MemoryStore` TTLCache and dictionary lookup.
- `NexacroParser` parameter and dataset extraction.
- `JsonataAdapter` status matrix and syntax normalization.
- Self-healing circuit breaker with automatic retry.
- Single and Loop mode HTTP concurrency.
- FastAPI REST endpoints.
