# TÀI LIỆU SƠ ĐỒ THIẾT KẾ & VẬN HÀNH WORKFLOW ENGINE
## (PlantUML Architecture, Concurrency & 360° Data Fusion Diagrams)

Tài liệu này tổng hợp **7 sơ đồ PlantUML** (đã xuất ra ảnh PNG chất lượng cao) mô tả toàn bộ cơ chế vận hành tổng quát của Workflow Engine, kiến trúc phân tầng, cơ chế điều phối tuần tự 8 bước (Sequential Orchestration), kỹ thuật phân biệt **Batch Mode (Single HTTP)** vs **Loop Mode (Bounded Concurrency Semaphore)**, cơ chế tự phục hồi (**Self-Healing Circuit Breaker**) và kiến trúc **Data Fusion 360°** hợp nhất 6 API Nexacro sản xuất (`t1.txt`).

> **Vị trí ảnh xuất ra:**
> - Linux/WSL: `/home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/*.png`
> - Windows: `\\wsl.localhost\Ubuntu\home\longp\projects\company\omni-ems\workflow-engine\docs\diagrams\`

---

## 0. Sơ Đồ Cách Thức Hoạt Động Tổng Quát Của Workflow Engine (Generic Lifecycle)

- File nguồn: [`docs/diagrams/00_general_workflow_operating_flow.puml`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/00_general_workflow_operating_flow.puml)
- Ảnh xuất ra: [`docs/diagrams/General_Workflow_Operating_Flow.png`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/General_Workflow_Operating_Flow.png)

```plantuml
@startuml General_Workflow_Operating_Flow
!theme plain
skinparam backgroundColor #FFFFFF
skinparam roundcorner 8
skinparam shadowing false
skinparam ArrowColor #2563EB
skinparam ArrowThickness 1.5

title Cách Thức Hoạt Động Tổng Quát Của Workflow Engine

|#EFF6FF| 1. Client & API Layer |
|#FEF3C7| 2. Core Engine & DataContext |
|#F3E8FF| 3. Step Adapters (Plugins) |
|#ECFDF5| 4. External Services & Resilience |

|1. Client & API Layer|
start
:Client gửi **POST /api/v1/workflows/execute**\n{ workflow_id, inputs };
:FastAPI Router nhận & Pydantic xác thực schema;

|2. Core Engine & DataContext|
:Load định nghĩa workflow (**YAML**);\n(Metadata, Globals, Steps, Response);
:Khởi tạo **DataContext (State Bus)**:\n- **$inputs**: Tham số đầu vào\n- **$globals**: Dữ liệu dùng chung / Dict cache\n- **$steps**: Trạng thái và kết quả từng bước;

while (Còn bước tiếp theo trong **steps: [...]**?) is (Có)
  :Đọc cấu hình **step_id** & kiểm tra điều kiện (condition);
  :Phân giải tham số từ DataContext\n($inputs, $globals, $steps.<prev>.output);

  |3. Step Adapters (Plugins)|
  if (Loại Step (type) là gì?) then (sub_workflow)
    :Gọi **SubworkflowAdapter**;
    :Thực thi workflow con (kế thừa context);
  elseif (http) then
    if (Chế độ HTTP?) then (batch / single)
      :Render Jinja2 template cho N items;
      |4. External Services & Resilience|
      :Gửi **1 HTTP Request duy nhất**;
      :Nhận phản hồi & Parse XML/JSON;
    else (loop)
      |3. Step Adapters (Plugins)|
      :Lấy danh sách từ **loop_over**;
      :Khởi tạo **asyncio.Semaphore(max_concurrency)**;
      |4. External Services & Resilience|
      :Phát N HTTP Requests song song;
      :Gộp kết quả qua **asyncio.gather()**;
    endif
  else (jsonata)
    |3. Step Adapters (Plugins)|
    :Gọi **JsonataAdapter**;
    :Đọc dữ liệu từ $steps;
    :Biến đổi, tính toán, join mảng & map từ điển;
  endif

  |4. External Services & Resilience|
  if (Gặp lỗi HTTP 401 hoặc Session Hết Hạn?) then (Có)
    :Kích hoạt **Self-Healing Circuit Breaker**;
    :Xóa TTLCache & Chạy lại sub-flow Auth;
    :Thử lại bước hiện tại (Max Retry: 1);
  else (Thành công)
  endif

  |2. Core Engine & DataContext|
  :Lưu kết quả vào DataContext:\n**$steps.<step_id> = { status, output, metadata }**;
endwhile (Hết các bước)

:Áp dụng **response template** lên DataContext\n(Đóng gói dữ liệu đầu ra chuẩn hóa);
:Ghi nhận telemetry (execution_time_ms, metrics);

|1. Client & API Layer|
:Trả về **HTTP 200 JSON Response**\n{ status: COMPLETED, execution_time_ms, data };
stop

@enduml
```

---

## 1. Sơ Đồ Kiến Trúc Phân Tầng & Thành Phần (Architecture & Components)

- File nguồn: [`docs/diagrams/01_architecture_component.puml`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/01_architecture_component.puml)
- Ảnh xuất ra: [`docs/diagrams/Architecture_Component_Diagram.png`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/Architecture_Component_Diagram.png)

```plantuml
@startuml Architecture_Component_Diagram
!theme plain
skinparam backgroundColor #FFFFFF
skinparam roundcorner 8
skinparam shadowing false
skinparam componentStyle uml2
skinparam ArrowColor #2563EB
skinparam ArrowThickness 1.5

title Kiến Trúc Tổng Thể & Phân Tầng Workflow Engine (EMS 360 & 6 Legacy APIs)

actor "Primary Business App\n/ REST Client" as Client #E0F2FE

package "FastAPI Workflow Engine Core (Port 8000)" #F8FAFC {

    package "API & Routing Layer" #EFF6FF {
        component "app.main\n(FastAPI Router)" as APIRouter #DBEAFE
        component "Pydantic Schemas\n(ExecuteRequest / Response)" as Schemas #DBEAFE
    }

    package "Core Engine Layer (Domain-Agnostic)" #FEF3C7 {
        component "WorkflowEngine\n(Pipeline Orchestrator)" as Engine #FDE68A
        component "DataContext\n(In-Memory State Bus)" as DataCtx #FDE68A
        component "MemoryStore\n(cachetools TTLCache 3600s)" as MemStore #FDE68A
    }

    package "Adapters Layer" #F3E8FF {
        component "SubworkflowAdapter\n(Session Auth & Routing)" as SubWfAdapter #E9D5FF
        component "HttpAdapter\n(Dual Mode HTTP Dispatcher)" as HttpAdapter #E9D5FF
        component "NexacroParser\n(XML & Dataset Flattener)" as Parser #E9D5FF
        component "JsonataAdapter\n(360° Data Fusion Engine)" as Jsonata #E9D5FF
    }

    package "Template & Definition Store" #ECFDF5 {
        folder "app/workflows/\n(*.yaml Definitions)" as WorkflowsDir #D1FAE5
        folder "app/templates/\n(*.xml.j2 Jinja2 Templates)" as TemplatesDir #D1FAE5
    }
}

cloud "Legacy Nexacro EMS Platform (:9000)" as LegacyEMS #FEE2E2 {
    package "Batch Endpoints (Single HTTP for N items)" #FECACA {
        interface "1. POST /retComCodeList.lgdn\n(Common Code Dictionaries)" as API_Codes #FCA5A5
        interface "2. POST /RetStockStatusList.lgdn\n(Stock Balances - 38 Columns)" as API_Stock #FCA5A5
        interface "3. POST /GetOptimizeInfo.lgdn\n(Target Stock Optimization Flags)" as API_Opt #FCA5A5
        interface "4. POST /TargetStockSearchList.lgdn\n(Target Stock - 93 Indicators)" as API_Target #FCA5A5
    }

    package "Loop Endpoints (Concurrent Semaphore = 5)" #FED7AA {
        interface "5. POST /retrieveItem.lgdn\n(Item Master & FDM CAD URL)" as API_Popup #FDBA74
        interface "6. POST /retrieveItemInfoDetail.lgdn\n(Tech Specs & MTBF Reliability)" as API_Tech #FDBA74
    }

    database "Legacy Database\n(SQLite / Oracle EMS)" as DB #FECACA
}

' Flow Connections
Client --> APIRouter : 1. POST /api/v1/workflows/execute\n{workflow_id: "wf_comprehensive_ems_fusion", inputs: {...}}
APIRouter --> Schemas : Validate Request
APIRouter --> Engine : Dispatch Execution

Engine ..> WorkflowsDir : Ingest YAML Definition
Engine --> DataCtx : Initialize Context\n($inputs, $globals, $steps)
Engine --> MemStore : Check Session Token

' Step 1: Sub-workflow Auth
Engine --> SubWfAdapter : Step 1: execute_sub_workflow\n(wf_auth_nexacro_global)
SubWfAdapter --> MemStore : Check TTLCache (0ms network hit)
SubWfAdapter ..> Engine : Auto-login & Refresh if Expired

' Step 2-5: Batch Mode Execution
Engine --> HttpAdapter : Steps 2, 3, 4, 5: BATCH MODE
HttpAdapter ..> TemplatesDir : Render Jinja2 Batch Template\n<Dataset><Rows>{% for item in items %}...</Rows></Dataset>
HttpAdapter --> API_Codes : 1 HTTP POST (Batch)
HttpAdapter --> API_Stock : 1 HTTP POST (Batch 38 cols)
HttpAdapter --> API_Opt : 1 HTTP POST (Batch)
HttpAdapter --> API_Target : 1 HTTP POST (Batch 93 metrics)

' Step 6-7: Concurrent Loop Mode Execution
Engine --> HttpAdapter : Steps 6, 7: CONCURRENT LOOP MODE
note right of HttpAdapter
  **Bounded Concurrency Pattern:**
  - Resolve items array via config.loop_over
  - asyncio.Semaphore(max_concurrency = 5)
  - N parallel workers render individual XML
  - asyncio.gather(*tasks) merges results
end note
HttpAdapter --> API_Popup : N Parallel POSTs (Semaphore=5)
HttpAdapter --> API_Tech : N Parallel POSTs (Semaphore=5)

API_Codes --> DB
API_Stock --> DB
API_Opt --> DB
API_Target --> DB
API_Popup --> DB
API_Tech --> DB

' Response Parsing
LegacyEMS --> HttpAdapter : XML Response Payloads
HttpAdapter --> Parser : Parse Nexacro XML
Parser --> DataCtx : Extract metadata & raw_flattened arrays

' Step 8: 360 Data Fusion
Engine --> Jsonata : Step 8: transform_jsonata\n(synthesize_and_fuse_360)
Jsonata --> DataCtx : Read all 6 raw_flattened datasets
Jsonata --> Jsonata : Merge 6 pillars into Spare Part 360 Master Record
Jsonata --> DataCtx : Write normalized 360° entities

' Output Response
DataCtx --> Engine : Resolve Response Block
Engine --> APIRouter : Normalized JSON Payload
APIRouter --> Client : 2. HTTP 200 OK\n{status: COMPLETED, data: [Spare Part 360 Objects]}

@enduml
```

---

## 2. Sơ Đồ Tuần Tự Luồng Thực Thi 8 Bước (Sequential Pipeline Sequence)

- File nguồn: [`docs/diagrams/02_workflow_execution_sequence.puml`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/02_workflow_execution_sequence.puml)
- Ảnh xuất ra: [`docs/diagrams/Workflow_Execution_Sequence.png`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/Workflow_Execution_Sequence.png)

```plantuml
@startuml Workflow_Execution_Sequence
!theme plain
autonumber
skinparam backgroundColor #FFFFFF
skinparam roundcorner 6
skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam ArrowColor #2563EB
skinparam ArrowThickness 1.5

title Quy Trình Thực Thi 8 Bước (wf_comprehensive_ems_fusion)

actor "Client" as Client #E0F2FE
participant "API Router" as API #DBEAFE
participant "WorkflowEngine" as Engine #FEF3C7
participant "DataContext" as Ctx #FDE68A
participant "MemoryStore\n(TTLCache)" as Cache #FDE047
participant "SubworkflowAdapter\n(Auth)" as Auth #E9D5FF
participant "HttpAdapter" as Http #DDD6FE
participant "Legacy Nexacro\n(:9000)" as Legacy #FEE2E2
participant "NexacroParser" as Parser #DDD6FE
participant "JsonataAdapter\n(360° Fusion)" as Jsonata #C4B5FD

== 1. Khởi Tạo Context ==
Client -> API : POST /api/v1/workflows/execute
API -> Engine : execute("wf_comprehensive_ems_fusion", inputs)
Engine -> Ctx : new DataContext()

== 2. Bước 1: Auth Sub-Workflow ==
Engine -> Auth : execute("wf_auth_nexacro_global")
Auth -> Cache : get_token("global")
alt Token hợp lệ (TTL < 3600s)
    Cache --> Auth : Token cached (0ms)
else Token hết hạn / Chưa có
    Auth -> Http : POST /login
    Http -> Legacy : POST /login
    Legacy --> Http : 200 OK (JSESSIONID)
    Http --> Auth : New Token
    Auth -> Cache : set_token(ttl=3600)
end
Auth --> Engine : session_token
Engine -> Ctx : set_step("auth_session", SUCCESS)

== 3. Bước 2: Dictionaries [BATCH: 1 HTTP] ==
Engine -> Http : Step 2 (Batch)
Http -> Legacy : POST /retComCodeList.lgdn
Legacy --> Http : XML (Category, Status, PO_Type)
Http -> Parser : parse_nexacro_response()
Parser --> Engine : raw_flattened
Engine -> Ctx : set_step("fetch_common_dictionaries", SUCCESS)

== 4. Bước 3: Stock Status [BATCH: 1 HTTP] ==
Engine -> Http : Step 3 (Batch)
Http -> Legacy : POST /RetStockStatusList.lgdn
Legacy --> Http : XML (38 cols stock balances)
Http -> Parser : parse_nexacro_response()
Parser --> Engine : raw_flattened
Engine -> Ctx : set_step("fetch_stock_status", SUCCESS)

== 5. Bước 4: Optimize Info [BATCH: 1 HTTP] ==
Engine -> Http : Step 4 (Batch)
Http -> Legacy : POST /GetOptimizeInfo.lgdn
Legacy --> Http : XML (optimize flags)
Http -> Parser : parse_nexacro_response()
Parser --> Engine : raw_flattened
Engine -> Ctx : set_step("fetch_optimize_flag", SUCCESS)

== 6. Bước 5: Target Stock [BATCH: 1 HTTP] ==
Engine -> Http : Step 5 (Batch)
Http -> Legacy : POST /TargetStockSearchList.lgdn
Legacy --> Http : XML (93 indicators)
Http -> Parser : parse_nexacro_response()
Parser --> Engine : raw_flattened
Engine -> Ctx : set_step("fetch_target_stock_metrics", SUCCESS)

== 7. Bước 6: Popup Master [LOOP: SEMAPHORE=5] ==
Engine -> Http : Step 6 (Loop over items)
par Concurrently (Semaphore = 5)
    Http -> Legacy : POST /retrieveItem.lgdn (Item 1)
    Legacy --> Http : XML
else
    Http -> Legacy : POST /retrieveItem.lgdn (Item 2)
    Legacy --> Http : XML
end
Http -> Parser : Parse & gather
Parser --> Engine : raw_flattened
Engine -> Ctx : set_step("fetch_item_popup_master", SUCCESS)

== 8. Bước 7: Tech Specs & MTBF [LOOP: SEMAPHORE=5] ==
Engine -> Http : Step 7 (Loop over items)
par Concurrently (Semaphore = 5)
    Http -> Legacy : POST /retrieveItemInfoDetail.lgdn (Item 1)
    Legacy --> Http : XML
else
    Http -> Legacy : POST /retrieveItemInfoDetail.lgdn (Item 2)
    Legacy --> Http : XML
end
Http -> Parser : Parse & gather
Parser --> Engine : raw_flattened
Engine -> Ctx : set_step("fetch_item_tech_details", SUCCESS)

== 9. Bước 8: Data Fusion 360° ==
Engine -> Jsonata : Step 8 (Synthesize 360)
Jsonata -> Ctx : Read 6 Datasets
Jsonata -> Jsonata : Stitch 6 Domain Pillars\n& Lookup Dictionary Translations
Jsonata --> Engine : 360° Fused Records
Engine -> Ctx : set_step("synthesize_and_fuse_360", SUCCESS)

== 10. Trả Kết Quả ==
Engine --> API : Response JSON (360° Entities)
API --> Client : 200 OK

@enduml
```

---

## 3. Sơ Đồ Cơ Chế Tự Phục Hồi Session (Self-Healing Circuit Breaker)

- File nguồn: [`docs/diagrams/03_self_healing_circuit_breaker.puml`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/03_self_healing_circuit_breaker.puml)
- Ảnh xuất ra: [`docs/diagrams/Self_Healing_Circuit_Breaker.png`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/Self_Healing_Circuit_Breaker.png)

```plantuml
@startuml Self_Healing_Circuit_Breaker
!theme plain
autonumber
skinparam backgroundColor #FFFFFF
skinparam roundcorner 6
skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam ArrowColor #DC2626
skinparam ArrowThickness 1.5

title Cơ Chế Tự Phục Hồi Session (Self-Healing Circuit Breaker)

participant "WorkflowEngine" as Engine #FEF3C7
participant "DataContext" as Ctx #FDE68A
participant "HttpAdapter" as Http #DDD6FE
participant "SubworkflowAdapter" as Auth #E9D5FF
participant "MemoryStore\n(TTLCache)" as Cache #FDE047
participant "Legacy Nexacro\nPlatform" as Legacy #FEE2E2

== 1. Thực Thi Nghiệp Vụ ==
Engine -> Http : fetch_nexacro_data (token cũ)
Http -> Legacy : POST /RetStockStatusList.lgdn

alt HTTP 401/403 Unauthorized
    Legacy --> Http : 401 Unauthorized
    Http --> Engine : throw HttpAuthRequiredError(401)
else Nexacro ErrorCode < 0 (Session Expired)
    Legacy --> Http : 200 OK (errorCode: -1, "Session Expired")
    Http --> Engine : throw NexacroError(-1)
end

== 2. Kích Hoạt Self-Healing ==
note over Engine #FEE2E2
  <b>HẾT HẠN PHIÊN (Max retry: 1)</b>
  Tự động phục hồi trong suốt
end note

Engine -> Cache : invalidate_token("global")

== 3. Tự Động Tái Xác Thực ==
Engine -> Auth : execute(wf_auth_nexacro_global)
Auth -> Http : POST /login
Http -> Legacy : POST /login XML
Legacy --> Http : 200 OK (fresh_token)
Http --> Auth : fresh_token
Auth -> Cache : set_token("global", fresh_token, ttl=3600)
Auth --> Engine : { session_token: fresh_token }

Engine -> Ctx : globals.auth_token = fresh_token
Engine -> Ctx : step "get_auth".status = "RETRIED"

== 4. Transparent Retry ==
Engine -> Http : fetch_nexacro_data [RETRY]\n(fresh_token)
Http -> Legacy : POST /RetStockStatusList.lgdn
Legacy --> Http : 200 OK (Dataset)
Http --> Engine : step_output (SUCCESS)
Engine -> Ctx : set_step_result(SUCCESS)

note over Engine #DCFCE7
  <b>TỰ PHỤC HỒI THÀNH CÔNG</b>
  Pipeline tiếp tục không gián đoạn
end note

@enduml
```

---

## 4. Sơ Đồ So Sánh: Batch Mode vs. Loop Mode (Concurrency)

- File nguồn: [`docs/diagrams/04_single_vs_loop_concurrency.puml`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/04_single_vs_loop_concurrency.puml)
- Ảnh xuất ra: [`docs/diagrams/Single_vs_Loop_Concurrency.png`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/Single_vs_Loop_Concurrency.png)

```plantuml
@startuml Single_vs_Loop_Concurrency
!theme plain
skinparam backgroundColor #FFFFFF
skinparam roundcorner 8
skinparam shadowing false
skinparam ArrowColor #2563EB
skinparam ArrowThickness 1.5

title So Sánh: Batch Mode (Single HTTP) vs. Loop Mode (Semaphore = 5)

|#EFF6FF| Batch Mode (1 HTTP Request) |
|#FEF3C7| Loop Mode (Concurrent Semaphore = 5) |

|Batch Mode (1 HTTP Request)|
start
:Nhận N items từ inputs;
:Render Jinja2 thành **1 XML Body duy nhất**\n(<Dataset><Rows>{% for itm in items %}...);
:Gửi **1 HTTP POST duy nhất**;
:Legacy trả về 1 XML chứa N rows;
:Flattener bóc tách thành **raw_flattened**;
stop

|Loop Mode (Concurrent Semaphore = 5)|
start
:Đánh giá **config.loop_over** (N items);
:Khởi tạo **asyncio.Semaphore(max_concurrency = 5)**;

fork
  :Worker 1: Acquire -> POST Item 1;
fork again
  :Worker 2: Acquire -> POST Item 2;
fork again
  :Worker 3: Acquire -> POST Item 3;
fork again
  :Worker 4: Acquire -> POST Item 4;
fork again
  :Worker 5: Acquire -> POST Item 5;
fork again
  :... (Item 6..N xếp hàng đợi slot trống);
end fork

:Thu thập kết quả qua **asyncio.gather()**;
:Gộp thành mảng **raw_flattened** (N items);
stop

@enduml
```

---

## 5. Sơ Đồ Tiến Trình Trạng Thái DataContext

- File nguồn: [`docs/diagrams/05_data_context_state_evolution.puml`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/05_data_context_state_evolution.puml)
- Ảnh xuất ra: [`docs/diagrams/DataContext_State_Evolution.png`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/DataContext_State_Evolution.png)

```plantuml
@startuml DataContext_State_Evolution
!theme plain
skinparam backgroundColor #FFFFFF
skinparam roundcorner 6
skinparam shadowing false
skinparam state {
    BackgroundColor #F8FAFC
    BorderColor #64748B
    ArrowColor #2563EB
}

title Tiến Trình Trạng Thái DataContext

[*] --> InitialState : new DataContext()

state "1. Khởi Tạo (Init)" as InitialState #EFF6FF {
    InitialState : execution_id = "exec_..."
    InitialState : workflow_id = "wf_..."
    InitialState : inputs = { keyword: "PUMP-2026" }
    InitialState : globals.dict = { CATEGORY: {...}, STATUS: {...} }
    InitialState : globals.auth_token = None
    InitialState : steps = {}
}

InitialState --> AfterAuth : Step 1: get_auth

state "2. Sau Xác Thực (Auth)" as AfterAuth #FEF3C7 {
    AfterAuth : globals.auth_token = "JSESSIONID_..."
    AfterAuth : steps.get_auth = { status: "SUCCESS", cached: true }
}

AfterAuth --> AfterFetch : Step 2: fetch_data

state "3. Sau Lấy Dữ Liệu (Fetch)" as AfterFetch #EDE9FE {
    AfterFetch : steps.fetch_nexacro_data = {
    AfterFetch :   status: "SUCCESS",
    AfterFetch :   raw_flattened: [ { ITEM_CD: "...", ... } ]
    AfterFetch : }
}

AfterFetch --> AfterTransform : Step 3: JSONata Fusion

state "4. Sau Hợp Nhất (Fused)" as AfterTransform #DCFCE7 {
    AfterTransform : steps.transform_and_enrich = {
    AfterTransform :   status: "SUCCESS",
    AfterTransform :   output: [ { item_code: "...", health_rating: "A", ... } ]
    AfterTransform : }
}

AfterTransform --> FinalResponse : Response Template

state "5. Kết Quả Cuối (Response)" as FinalResponse #F1F5F9 {
    FinalResponse : status: "COMPLETED"
    FinalResponse : execution_time_ms: 235
    FinalResponse : data: [ ... 360° Records ... ]
}

FinalResponse --> [*] : Trả HTTP 200 Client

@enduml
```

---

## 6. Sơ Đồ Kiến Trúc Data Fusion 360° (Comprehensive Entity Stitching)

- File nguồn: [`docs/diagrams/06_comprehensive_data_fusion_360.puml`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/06_comprehensive_data_fusion_360.puml)
- Ảnh xuất ra: [`docs/diagrams/Comprehensive_Data_Fusion_360.png`](file:///home/longp/projects/company/omni-ems/workflow-engine/docs/diagrams/Comprehensive_Data_Fusion_360.png)

```plantuml
@startuml Comprehensive_Data_Fusion_360
!theme plain
skinparam backgroundColor #FFFFFF
skinparam roundcorner 8
skinparam shadowing false
skinparam componentStyle uml2
skinparam ArrowColor #2563EB
skinparam ArrowThickness 1.5

title Kiến Trúc Data Fusion 360° (Hợp Nhất 6 Nguồn Dữ Liệu Nexacro)

package "6 Nguồn Dữ Liệu Nexacro" #EFF6FF {

    component "1. Dictionaries\n(/retComCodeList)" as S1 #DBEAFE
    component "2. Stock Balances\n(/RetStockStatusList)" as S2 #DBEAFE
    component "3. Optimize Info\n(/GetOptimizeInfo)" as S3 #DBEAFE
    component "4. Target Stock 93\n(/TargetStockSearchList)" as S4 #DBEAFE
    component "5. Popup Master\n(/retrieveItem)" as S5 #FED7AA
    component "6. Tech Specs\n(/retrieveItemInfoDetail)" as S6 #FED7AA
}

package "Core Fusion Engine" #FEF3C7 {
    component "JSONata Synthesizer\n(DataContext Bus)" as FusionEngine #FDE68A
}

package "Spare Part 360° Record (6 Trụ Cột)" #ECFDF5 {
    component "1. Identification\n(Code, InvId, CAD URL)" as Pillar1 #D1FAE5
    component "2. Organization\n(Org, Dept, Planner, Buyer)" as Pillar2 #D1FAE5
    component "3. Stock Balances\n(Onhand, Avail, Target, Safety)" as Pillar3 #D1FAE5
    component "4. Procurement\n(PO Price, Supplier, PO Type)" as Pillar4 #D1FAE5
    component "5. Reliability & LT\n(Lead Time, Due, MTBF)" as Pillar5 #D1FAE5
    component "6. Optimization Matrix\n(Health Rating, Actions)" as Pillar6 #D1FAE5
}

' Inputs into Fusion
S1 --> FusionEngine : Codes & Translations
S2 --> FusionEngine : 38 Stock Cols
S3 --> FusionEngine : Optimize Flags
S4 --> FusionEngine : 93 Metrics
S5 --> FusionEngine : Master & Drawings
S6 --> FusionEngine : MTBF & Specs

' Outputs to Pillars
FusionEngine --> Pillar1
FusionEngine --> Pillar2
FusionEngine --> Pillar3
FusionEngine --> Pillar4
FusionEngine --> Pillar5
FusionEngine --> Pillar6

@enduml
```
