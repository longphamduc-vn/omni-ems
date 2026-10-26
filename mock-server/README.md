# ⚡ Omni-EMS Mock Server & Universal Simulation Engine (LG Display)

Hệ thống mô phỏng API chuẩn Nexacro Platform toàn diện cho hệ thống **LG Display EMS**, tích hợp trực tiếp với Cơ sở dữ liệu SQLite quan hệ (`ems.db`) và bộ từ điển 50 Endpoints đồng bộ từ `ems-api-analyzer`.

---

## 🎯 1. Điểm Mới & Kiến Trúc Nâng Cấp (Synchronized with ems-api-analyzer)

Dựa trên kết quả bóc tách từ `ems-api-analyzer` (phân tích 28 phiên người dùng thực tế và 141 lượt gọi API):
1. **Hỗ trợ 100% toàn bộ 50 Endpoints**:
   - **Tier 1 (Database-Backed Core APIs)**: Các API truy vấn/đột biến dữ liệu quan trọng (`RetStockStatusList`, `RetEstimateRequestList`, `retrieveItemInfoDetail`, `TargetStockSearchList`, `retrieveItem`, `retrieveItemPoStatusList`, `retComCodeList`, `retFactoryList`, `CreInsertItemPrvRequest`, `WO230WoSaveInit`, `statusHistory`,...) kết nối trực tiếp với CSDL SQLite `ems.db`.
   - **Tier 2 (Universal Catalog Dispatcher)**: Tự động phục vụ các API phụ trợ, phân quyền, phê duyệt, nhật ký kết nối (`retWaitRepairItemInterlock`, `retEcFlag`, `retrievePurchaseRequest`, `retrieveItemRequestDetail`, `retSparepartsStatus`, `retApprovalLine`, `CheckMasterAuth`, `getAuthButton`, `retrieveGridFormat`, `insertStartLog`,...) với cấu trúc XML và Datasets chuẩn 1:1 trích xuất từ môi trường sản xuất.
   - **Tier 3 (Universal Catch-all)**: Mọi endpoint `.lgdn` hoặc `.document` chưa định nghĩa đều trả về XML Nexacro hợp lệ (`errorCode: 1`) thay vì lỗi 404 HTML, đảm bảo client Nexacro không bị crash.
2. **Bổ sung linh kiện & thực thể thực tế vào CSDL**:
   - Thêm linh kiện **`QCAK93067`** (Bracket Top Engineering, giá 546.39 USD, tồn kho 16 EA, link bản vẽ FDM Windchill).
   - Thêm linh kiện **`QCAC23840`** (Needle Valve Marco Systemanalyse, giá 3726.74 USD, tồn kho 20 EA, dùng trong dự án X410X).
   - Thêm bảng **`work_orders`** và phiếu công tác bảo trì thực tế `WO-232220577`, `WO-248616130`.
   - Thêm bảng **`prv_requests`** và hỗ trợ API tạo yêu cầu mua sắm `CreInsertItemPrvRequest.lgdn`.
3. **Hai tùy chọn runtime linh hoạt**:
   - **Node.js Express Server (`server.js`)**: Server chính với hiệu năng cao, tích hợp SQLite built-in (`node:sqlite`).
   - **Python Standalone Simulator (`simulator.py`)**: Zero-dependency (chỉ dùng thư viện chuẩn Python 3 `http.server` & `sqlite3`).

---

## 📁 2. Cấu Trúc Thư Mục

```
mock-server/
├── db/
│   ├── ems.db                     # SQLite Database tập trung
│   ├── schema.sql                 # Cấu trúc 11 bảng quan hệ chuẩn
│   ├── seed.sql                   # Dữ liệu hạt giống thực tế từ A1.txt
│   └── database.js                # Module kết nối node:sqlite cho Node.js
├── utils/
│   ├── analyzed-catalog.js        # Universal Catalog loader (50 endpoints)
│   ├── nexacro-parser.js          # Parser XML Nexacro Request
│   └── nexacro-builder.js         # Builder XML Nexacro Response chuẩn LG Display
├── server.js                      # Node.js Express server (50 endpoints)
├── simulator.py                   # Python 3 standalone simulator (50 endpoints)
├── test-simulation.js             # Test suite 16 test cases (100% pass)
├── package.json
└── README.md
```

---

## 📊 3. Bảng Phân Nhóm 50 Endpoints

| Phân hệ (Subsystem) | Số Endpoints | Các Endpoint tiêu biểu | Cơ chế phục vụ |
|---|---|---|---|
| **`emsspareparts`** | 27 | `RetStockStatusList`, `retrieveItemInfoDetail`, `TargetStockSearchList`, `CreInsertItemPrvRequest`, `RetEstimateRequestList`, `retWaitRepairItemInterlock`, `retEcFlag`, `retrievePurchaseRequest`, `retrieveItemRequestDetail` | SQLite DB + Catalog |
| **`emscom`** | 20 | `retrieveItem`, `retrieveItemPoStatusList`, `retComCodeList`, `retApprovalLine`, `retApprovalRequest`, `retrieveLowestEmNo`, `retrieveUserOrgList`, `getAuthButton`, `retrieveGridFormat`, `insertStartLog` | SQLite DB + Catalog |
| **`emsworkorder`** | 2 | `WO230WoSaveInit`, `statusHistory` | SQLite DB (`work_orders`) |
| **`Servlet`** | 1 | `Servlet/MenuPermit.document` | Catalog Dispatcher |

---

## 🚀 4. Hướng Dẫn Khởi Chạy & Kiểm Thử

### Cách 1: Chạy bằng Node.js Server
```bash
cd mock-server
npm install
npm run seed     # Khởi tạo hoặc cập nhật CSDL ems.db
npm start        # Khởi động tại http://localhost:9000
```

### Cách 2: Chạy bằng Python Standalone (Không cần cài thư viện ngoài)
```bash
cd mock-server
python simulator.py
```
Server sẽ lắng nghe tại `http://localhost:9000`.

---

## 🧪 5. Kiểm Thử Tự Động (Automated Verification)

Mở một terminal và chạy lệnh:
```bash
node test-simulation.js
```
Kết quả mong đợi: **16/16 tests passed (100%)**.

```
========================================================================
⚡ [Omni-EMS Mock Server Verification] Testing against http://127.0.0.1:9000
   Universal 50-Endpoint Engine synchronized with ems-api-analyzer
========================================================================

  [PASS] [1/16] Spare Parts: Stock Status Search (QCAD57452 & QCAK93067)
  [PASS] [2/16] Spare Parts: Estimate Requests (RFQ)
  [PASS] [3/16] Spare Parts: Item Detail Info (MTBF & Inventory)
  [PASS] [4/16] Spare Parts: Target Stock Optimization (93 Indicators)
  [PASS] [5/16] Spare Parts: Optimization Info (GetOptimizeInfo)
  [PASS] [6/16] Popups: Item Master Search (retrieveItem with FDM CAD)
  [PASS] [7/16] Popups: Item PO Status Tracking
  [PASS] [8/16] Common: Common Code Dictionary (retComCodeList)
  [PASS] [9/16] Work Order: Factory List (retFactoryList)
  [PASS] [10/16] MUTATE: Purchase Request Creation (CreInsertItemPrvRequest)
  [PASS] [11/16] Operational Checks: Repair Interlock & EC Flag
  [PASS] [12/16] Work Orders: WO Save Init (WO230WoSaveInit)
  [PASS] [13/16] Work Orders: Status History (statusHistory)
  [PASS] [14/16] Security & Governance: Master Auth & Priv Flag Check
  [PASS] [15/16] Universal Catalog Dispatcher: Realtime Status & Lowest EmNo
  [PASS] [16/16] REST Management APIs: Health Check & Endpoints Catalog

========================================================================
🎉 Kết quả kiểm thử: 16/16 tests passed (100%)
========================================================================
```

---

## 🌐 6. Các REST APIs Quản Trị & Giám Sát

- **Kiểm tra trạng thái**: `GET http://localhost:9000/api/health`
- **Danh sách 50 Endpoints**: `GET http://localhost:9000/api/endpoints`
- **Chi tiết 1 Endpoint**: `GET http://localhost:9000/api/endpoints/RetStockStatusList`
- **Từ điển dịch thuật**: `GET http://localhost:9000/api/translations`
