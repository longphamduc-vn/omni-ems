# Mock Server & Cơ Sở Dữ Liệu Mô Phỏng API EMS (LG Display)

Hệ thống mô phỏng API chuẩn Nexacro Platform cho các API **lấy dữ liệu nghiệp vụ cốt lõi**, kết nối trực tiếp với Cơ sở dữ liệu SQLite quan hệ hợp nhất (`ems.db`).

---

## 1. Thiết Kế Tối Giản & Tinh Gọn (Streamlined Architecture)

Theo yêu cầu chuẩn hóa:
1. **Loại bỏ hoàn toàn các API không cần thiết**:
   - Loại bỏ Audit Log: `insertStartLog.lgdn`, `updateEndLog.lgdn`.
   - Loại bỏ Menu & Quyền truy cập: `retrieveFavoriteMenuList.lgdn`, `GetSpPrivFlag.lgdn`, `CheckMasterAuth.lgdn`.
   - Loại bỏ Cấu hình hiển thị lưới: `retrieveGridFormat.lgdn`.
   - Loại bỏ Báo cáo tổng hợp ngoài lề: `retrieveUnPrcsTotal.lgdn`.
2. **Không mock rời rạc từng API**:
   - Loại bỏ toàn bộ thư mục handler lẻ tẻ và file stub tĩnh.
   - Toàn bộ 8 API lấy dữ liệu đều truy vấn SQL trực tiếp từ cơ sở dữ liệu SQLite (`db/ems.db`).
3. **Hai tùy chọn runtime linh hoạt**:
   - **Node.js Server (`server.js`)**: Dựa trên Express và `better-sqlite3`.
   - **Python Standalone Simulator (`simulator.py`)**: Zero-dependency (chỉ dùng thư viện chuẩn Python 3 `http.server` & `sqlite3`).

---

## 2. Cấu Trúc Thư Mục

```
mock-server/
├── db/
│   ├── ems.db              # SQLite Database tập trung
│   ├── schema.sql          # Cấu trúc 8 bảng quan hệ chuẩn
│   ├── seed.sql            # Dữ liệu mẫu thực tế trích xuất từ t1.txt
│   ├── database.js         # Module kết nối better-sqlite3 cho Node.js
│   └── init-db.js          # Script re-initialize database
├── utils/
│   ├── nexacro-parser.js   # Parser XML Nexacro Request (Parameters + Datasets)
│   └── nexacro-builder.js  # Builder XML Nexacro Response chuẩn LG Display
├── server.js               # Node.js Express server (8 API trực tiếp vào SQLite)
├── simulator.py            # Python 3 standalone simulator (8 API)
├── test-simulation.js      # Suite kiểm thử tự động 8 API (100% pass)
├── package.json
└── README.md
```

---

## 3. Danh Sách 8 API Nghiệp Vụ Cốt Lõi

| STT | Phương thức | Đường dẫn API | Mô tả nghiệp vụ | Bảng SQLite liên kết |
|---|---|---|---|---|
| 1 | POST | `/emsspareparts/sp101/sp110Nav/RetStockStatusList.lgdn` | Tra cứu danh sách tồn kho phụ tùng | `items`, `inventory` |
| 2 | POST | `/emsspareparts/sp101/sp120Nav/RetEstimateRequestList.lgdn` | Danh sách yêu cầu báo giá (RFQ) | `estimate_requests` |
| 3 | POST | `/emsspareparts/sp102/sp135Nav/retrieveItemInfoDetail.lgdn` | Chi tiết phụ tùng & chỉ số định mức kho | `items`, `inventory`, `item_usage_summary` |
| 4 | POST | `/emsspareparts/sp302/sp335Nav/TargetStockSearchList.lgdn` | Tối ưu hóa tồn kho an toàn & Target Stock | `target_stock` |
| 5 | POST | `/emscom/popupNav/retrieveItem.lgdn` | Cửa sổ popup tra cứu Item Master | `items` |
| 6 | POST | `/emscom/popupNav/retrieveItemPoStatusList.lgdn` | Popup theo dõi lịch sử đơn hàng PO | `item_po_history` |
| 7 | POST | `/emscom/codeNav/retComCodeList.lgdn` | Từ điển mã danh mục dùng chung (Common Code) | `common_codes` |
| 8 | POST | `/emswonew/wn90/wn900Nav/retFactoryList.lgdn` | Danh sách nhà máy / phân xưởng sản xuất | `factories` |

---

## 4. Hướng Dẫn Chạy & Kiểm Thử

### Cách 1: Chạy bằng Node.js (Express + SQLite)
```bash
cd mock-server
npm install
node server.js
```
Server sẽ khởi chạy tại: `http://localhost:9000`

### Cách 2: Chạy bằng Python Standalone (Không cần cài thư viện)
```bash
cd mock-server
python3 simulator.py
```
Server sẽ khởi chạy tại: `http://localhost:9000`

### Kiểm thử tự động (Automated Verification)
Mở một terminal khác và chạy:
```bash
node test-simulation.js
```
Kết quả mong đợi: **8/8 tests passed (100%)**.
