# Omni-EMS: LG Display EMS Core Data APIs & Mock Server

Hệ thống đặc tả API, TypeScript SDK và Mock Server mô phỏng các API nghiệp vụ lấy dữ liệu cốt lõi của nền tảng LG Display Equipment Management System (EMS - Nexacro Platform), kết nối trực tiếp với Cơ sở dữ liệu SQLite quan hệ.

---

## 📌 Tính Năng Nổi Bật

1. **Chuẩn hóa API (Clean Architecture)**:
   - Tập trung vào **8 API nghiệp vụ lấy dữ liệu cốt lõi** (Spare Parts, Estimate RFQ, Target Stock Optimization, Popups, Common Codes, Factories).
   - Đã loại bỏ các API dư thừa (Log, Menu, Grid format, Auth checks).
2. **TypeScript SDK & OpenAPI 3.0**:
   - Bộ thư viện `apis/` bao gồm đầy đủ Types, Client gọi API chuẩn XML Nexacro và tài liệu OpenAPI 3.0.
3. **Mock Server Đa Nền Tảng (Node.js & Python)**:
   - **Node.js Server (`server.js`)**: Dựa trên Express và Node.js native `DatabaseSync` (SQLite).
   - **Python Simulator (`simulator.py`)**: Zero-dependency, chỉ sử dụng Python 3 standard library.
4. **Cơ sở dữ liệu SQLite quan hệ tập trung (Không mock tĩnh từng API)**:
   - Lưu trữ dữ liệu thực tế tại `mock-server/db/schema.sql` và `mock-server/db/seed.sql`.
   - Server truy vấn trực tiếp bằng các câu lệnh SQL thay vì mock rời rạc.
5. **Kiểm thử tự động 100%**:
   - Suite kiểm thử tự động `test-simulation.js` kiểm tra độ chính xác của toàn bộ 8 endpoint.

---

## 📁 Cấu Trúc Dự Án

```
omni-ems/
├── apis/                   # Module TypeScript SDK & OpenAPI
│   ├── types.ts            # Type definitions cho 8 thực thể dữ liệu
│   ├── client.ts           # NexacroClient & parser/builder XML
│   ├── openapi.json        # Đặc tả OpenAPI 3.0
│   ├── index.ts            # Barrel export
│   └── package.json
├── mock-server/            # Máy chủ mô phỏng API Nexacro
│   ├── db/
│   │   ├── schema.sql      # 8 bảng SQLite quan hệ cốt lõi
│   │   ├── seed.sql        # Dữ liệu mẫu chuẩn trích xuất từ EMS
│   │   └── database.js     # Kết nối và tự động khởi tạo database
│   ├── utils/
│   │   ├── nexacro-parser.js # Parse XML Nexacro Request
│   │   └── nexacro-builder.js# Build XML Nexacro Response
│   ├── server.js           # Express mock server (truy vấn SQL)
│   ├── simulator.py        # Python 3 standalone simulator
│   ├── test-simulation.js  # Automated test suite (8/8 pass)
│   └── package.json
├── .gitignore
└── README.md
```

---

## 🚀 Danh Sách 8 API Nghiệp Vụ Cốt Lõi

| STT | Method | Endpoint Nexacro | Nghiệp vụ | Bảng SQLite |
|:---:|:---:|---|---|---|
| 1 | POST | `/emsspareparts/sp101/sp110Nav/RetStockStatusList.lgdn` | Tra cứu tồn kho linh kiện & giá nhập | `items`, `inventory` |
| 2 | POST | `/emsspareparts/sp101/sp120Nav/RetEstimateRequestList.lgdn` | Yêu cầu báo giá linh kiện (RFQ) | `estimate_requests` |
| 3 | POST | `/emsspareparts/sp102/sp135Nav/retrieveItemInfoDetail.lgdn` | Chi tiết linh kiện & chỉ số định mức | `items`, `inventory`, `item_usage_summary` |
| 4 | POST | `/emsspareparts/sp302/sp335Nav/TargetStockSearchList.lgdn` | Tối ưu tồn kho an toàn (Target Stock 93 fields) | `target_stock` |
| 5 | POST | `/emscom/popupNav/retrieveItem.lgdn` | Popup tìm kiếm Item Master | `items` |
| 6 | POST | `/emscom/popupNav/retrieveItemPoStatusList.lgdn` | Popup theo dõi lịch sử đơn hàng PO | `item_po_history` |
| 7 | POST | `/emscom/codeNav/retComCodeList.lgdn` | Từ điển mã dùng chung (Common Codes) | `common_codes` |
| 8 | POST | `/emswonew/wn90/wn900Nav/retFactoryList.lgdn` | Danh sách nhà máy sản xuất (Plant List) | `factories` |

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy

### 1. Khởi chạy Mock Server

#### Lựa chọn A: Sử dụng Node.js
```bash
cd mock-server
npm install
npm start
```
Server chạy tại: `http://localhost:9000` (Database tự động khởi tạo và nạp seed data nếu chưa có).

#### Lựa chọn B: Sử dụng Python 3 (Không cần cài thư viện ngoài)
```bash
cd mock-server
python3 simulator.py
```
Server chạy tại: `http://localhost:9000`.

### 2. Chạy Kiểm Thử Tự Động (Automated Verification)
Mở một terminal mới và chạy:
```bash
cd mock-server
node test-simulation.js
```
Kết quả mong đợi: **8/8 tests passed (100%)**.

---

## 📄 License
MIT License.
