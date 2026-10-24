# Omni-EMS: LX EMS Core Data APIs, Mock Server & 360° Workflow Engine

Hệ thống tích hợp toàn diện gồm:
1. **Mock Server Nexacro Platform**: Mô phỏng các API nghiệp vụ cốt lõi của nền tảng LX Equipment Management System (EMS), kết nối trực tiếp với Cơ sở dữ liệu SQLite quan hệ.
2. **FastAPI Workflow Engine & Data Fusion Layer (Port 8000)**: Bộ điều phối luồng xử lý dữ liệu động, cơ chế tự phục hồi (**Self-Healing Circuit Breaker**), xử lý song song phân biệt **Batch Mode (Single HTTP)** vs **Loop Mode (Bounded Concurrency Semaphore)**, và hợp nhất dữ liệu 360° (**JSONata Fusion**).
3. **Demo UI Pipeline Trực Quan**: Giao diện người dùng theo dõi trực tiếp luồng thực thi (Live Pipeline), biểu đồ radar sức khỏe linh kiện và bảng hợp nhất 6 trụ cột dữ liệu.

---

## ⚡ Hướng Dẫn Cài Đặt & Chạy Nhanh (1-Click Scripts)

Dự án đã trang bị sẵn bộ script tự động hóa toàn bộ việc cài đặt thư viện (npm & Python venv) và khởi động cả 2 server (`:9000` & `:8000`) cho cả **Windows** và **WSL / Linux**:

### 🐧 Dành Cho WSL / Linux

Chỉ cần mở terminal tại thư mục gốc và chạy:

```bash
# Cấp quyền thực thi nếu cần
chmod +x setup.sh start.sh

# 1. Cài đặt toàn bộ dependencies (Node.js & Python .venv)
./setup.sh

# 2. Khởi chạy toàn bộ hệ thống (Mock Server + FastAPI Engine)
./start.sh
```

*(Nhấn `Ctrl+C` tại terminal để dừng toàn bộ hệ thống một cách an toàn).*

---

### 🪟 Dành Cho Windows (CMD / PowerShell / File Explorer)

#### Cách 1: Chạy trực tiếp bằng File Explorer
- Nhấp đúp chuột vào file **`setup_windows.bat`** để cài đặt tự động.
- Nhấp đúp chuột vào file **`start_windows.bat`** để khởi chạy cả 2 server và tự động mở trình duyệt!

#### Cách 2: Chạy qua PowerShell
```powershell
# Cài đặt
.\scripts\setup_windows.ps1

# Khởi chạy
.\scripts\start_windows.ps1
```

---

## 🌐 Các Cổng Dịch Vụ Sau Khi Chạy

| Dịch vụ | Địa chỉ URL | Mô tả |
|---|---|---|
| **🖥️ Demo UI EMS 360°** | [http://localhost:8000/](http://localhost:8000/) | Giao diện Live Pipeline, Radar chart & Bảng 360° |
| **📖 Swagger API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Tài liệu OpenAPI tương tác cho Workflow Engine |
| **🏢 Legacy Mock Server** | [http://localhost:9000/health](http://localhost:9000/health) | Máy chủ mô phỏng Nexacro XML & SQLite DB |
| **📊 API Dịch Thuật DB** | [http://localhost:9000/api/translations](http://localhost:9000/api/translations) | Bảng dịch đa ngữ (Hàn -> Anh) từ SQLite |

---

## 📁 Cấu Trúc Thư Mục Dự Án

```text
omni-ems/
├── start.sh                # Script 1-click khởi chạy cho WSL / Linux
├── setup.sh                # Script 1-click cài đặt cho WSL / Linux
├── start_windows.bat       # Script 1-click khởi chạy cho Windows
├── setup_windows.bat       # Script 1-click cài đặt cho Windows
├── scripts/                # Thư mục chứa script chi tiết (PowerShell / Bash)
│   ├── start_wsl.sh
│   ├── setup_wsl.sh
│   ├── start_windows.ps1
│   └── setup_windows.ps1
├── workflow-engine/        # FastAPI Workflow Engine & Data Fusion Layer
│   ├── app/
│   │   ├── core/           # WorkflowEngine, DataContext (State Bus), MemoryStore
│   │   ├── adapters/       # HttpAdapter, JsonataAdapter, SubworkflowAdapter, NexacroParser
│   │   ├── workflows/      # Khai báo workflow YAML (wf_comprehensive_ems_fusion.yaml)
│   │   ├── templates/      # Jinja2 XML templates cho Nexacro
│   │   └── static/         # Demo UI (HTML, Tailwind/Vanilla CSS, Live Pipeline JS)
│   ├── docs/
│   │   ├── ARCHITECTURE_DIAGRAMS.md # Tài liệu tổng hợp 7 sơ đồ PlantUML & ảnh PNG
│   │   └── diagrams/       # Mã nguồn *.puml và 7 file ảnh *.png đã xuất
│   ├── tests/              # Test suite (18/18 pytest passed)
│   └── requirements.txt
├── mock-server/            # Máy chủ mô phỏng API Nexacro Platform
│   ├── db/
│   │   ├── schema.sql      # Schema SQLite (Bảng items, target_stock, translations...)
│   │   ├── seed.sql        # Dữ liệu chuẩn trích xuất từ EMS & từ điển dịch thuật
│   │   └── database.js     # Trình quản lý kết nối SQLite
│   ├── server.js           # Express mock server phục vụ 8 API Nexacro & SQLite
│   └── package.json
└── README.md
```

---

## 📊 Tài Liệu Sơ Đồ Thiết Kế (PlantUML Diagrams)

Toàn bộ sơ đồ thiết kế chi tiết và ảnh PNG chất lượng cao được lưu tại:
- **Tài liệu chi tiết:** [`workflow-engine/docs/ARCHITECTURE_DIAGRAMS.md`](workflow-engine/docs/ARCHITECTURE_DIAGRAMS.md)
- **Danh sách 7 sơ đồ đã xuất ảnh:**
  1. `General_Workflow_Operating_Flow.png`: Vòng đời vận hành tổng quát của Workflow Engine.
  2. `Architecture_Component_Diagram.png`: Kiến trúc phân tầng và các Adapter.
  3. `Workflow_Execution_Sequence.png`: Quy trình tuần tự 8 bước thực thi pipeline.
  4. `Self_Healing_Circuit_Breaker.png`: Cơ chế tự phục hồi Session khi hết hạn phiên.
  5. `Single_vs_Loop_Concurrency.png`: So sánh Batch Mode vs Loop Concurrency (Semaphore).
  6. `DataContext_State_Evolution.png`: Sự tiến triển dữ liệu qua State Bus.
  7. `Comprehensive_Data_Fusion_360.png`: Hợp nhất 6 nguồn dữ liệu thành 6 trụ cột 360°.

---

## 🧪 Kiểm Thử Tự Động (Automated Testing)

### 1. Kiểm thử Mock Server (Node.js)
```bash
cd mock-server
node test-simulation.js
# Kết quả: 8/8 tests passed
```

### 2. Kiểm thử Workflow Engine (Pytest)
```bash
cd workflow-engine
pytest tests/ -v
# Kết quả: 18/18 tests passed
```

---

## 📄 License
MIT License.
