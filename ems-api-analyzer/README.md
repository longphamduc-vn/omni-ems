# ⚡ EMS API Studio & Analyzer

Thư mục chuyên biệt phục vụ việc **đọc, phân tích cú pháp, bóc tách cấu trúc datasets, phân nhóm nghiệp vụ và cung cấp giao diện trực quan hóa** cho toàn bộ các API Endpoints trích xuất từ hệ thống **LG Display EMS** (chỉ đọc dữ liệu từ file `A1.txt`).

---

## 🎯 Tổng Quan & Kết Quả Phân Tích

Từ dữ liệu 28 phiên tương tác (Notes) trong `A1.txt`:
- **50 Endpoints duy nhất** được bóc tách và phân loại.
- **141 Lượt gọi API** thực tế với đầy đủ Request / Response Datasets.
- **68 Bảng Datasets có cấu trúc** (Request & Response schemas) với tên cột và kiểu dữ liệu.
- **Thời gian phản hồi trung bình**: 389.8 ms.
- **Tỉ lệ thành công**: 100% (HTTP 200).

### Phân nhóm theo Phân hệ (Subsystems):
1. **`emsspareparts` (27 Endpoints)**: Quản lý linh kiện phụ tùng, PRV (Purchase Request Voucher), tra cứu tồn kho, tình trạng sửa chữa, tạo yêu cầu mua sắm khẩn cấp (Emergency PO), cờ EC (Engineering Change), kiểm tra dòng phê duyệt.
2. **`emscom` (20 Endpoints)**: Các dịch vụ dùng chung: đăng nhập, phân quyền, cấu trúc tổ chức, lấy danh mục mã dùng chung (Code List), kiểm tra nút bấm quyền hạn (Auth Buttons), cấu hình lưới (Grid Formats), nhật ký phiên làm việc (Start/End Logs).
3. **`emsworkorder` (2 Endpoints)**: Quản lý phiếu công tác bảo trì Work Order, khởi tạo lưu WO, lịch sử trạng thái WO.
4. **`Servlet` (1 Endpoint)**: Quản trị menu và quyền hạn hệ thống (`MenuPermit`).

### Phân nhóm theo Nghiệp vụ (Operations):
- **QUERY (37 endpoints)**: Tra cứu danh sách, dữ liệu hiển thị, chi tiết phiếu.
- **SECURITY (6 endpoints)**: Kiểm tra phân quyền, ủy quyền duyệt, kiểm tra button.
- **LOGGING (2 endpoints)**: Nhật ký kết nối client `insertStartLog` và `updateEndLog`.
- **MUTATE (1 endpoint)**: Khởi tạo, tạo mới yêu cầu (`CreInsertItemPrvRequest`).
- **OTHER (4 endpoints)**: Cấu hình hệ thống, URL trả về.

---

## 🚀 Hướng Dẫn Sử Dụng Nhanh

### 1. Khởi động 1 lệnh duy nhất (Phân tích & Mở Giao Diện Web):
```bash
./start.sh
```
Hoặc chỉ định cổng tùy chọn (mặc định là `8765`):
```bash
./start.sh 9090
```

Truy cập giao diện tại: **[http://localhost:8765](http://localhost:8765)**

---

### 2. Chỉ chạy phân tích CLI (không bật web server):
```bash
python3 analyzer.py ../A1.txt
```
Lệnh này sẽ quét file `A1.txt` và xuất ra 3 tệp dữ liệu trong thư mục `data/`:
- `data/analyzed_apis.json`: Toàn bộ cấu trúc phân tích chi tiết, schema dataset, workflow sessions.
- `data/openapi.json`: Chuẩn OpenAPI 3.0 (Swagger) có thể import vào Swagger UI, Postman, Insomnia.
- `data/postman_collection.json`: Bộ sưu tập Postman v2.1 sẵn sàng chạy thử.

---

## 🖥️ Tính Năng Giao Diện Web

1. **Dashboard Tổng Quan**:
   - Thẻ KPI thông số (Endpoints, Calls, Datasets, Latency).
   - Biểu đồ phân bổ tỷ trọng theo phân hệ và nghiệp vụ.
   - Bảng xếp hạng Top API được gọi nhiều nhất.

2. **Khám Phá Endpoints (API Explorer)**:
   - Tìm kiếm thời gian thực (hỗ trợ phím tắt `Ctrl + K`).
   - Lọc nhanh theo phân hệ, nhóm nghiệp vụ, Program ID (`SP130`, `SP110`, `CM311`,...).
   - Sắp xếp theo số lượt gọi, độ trễ, tên action.
   - Thẻ card trực quan với nhãn màu, thông số độ trễ, số bảng dataset in/out.

3. **Cửa Sổ Chi Tiết Specs (Drawer Modal)**:
   - **Request Specs**: Bảng tham số URL/Body + Chi tiết bảng Dataset (`ds_search`, `ds_param`,...) kèm xem trước cột và dòng dữ liệu mẫu.
   - **Response Specs**: Tham số trả về (`errorCode`, `errorMsg`) + Bảng kết quả Dataset (`ds_list`, `ds_ec`,...) với bảng dữ liệu tương tác.
   - **Trình tạo mã mẫu**: Copy cURL 1 chạm, code JavaScript (Fetch), Python (Requests).
   - **Raw JSON**: Toàn bộ payload nguyên bản.

4. **Workflow & Call Traces (Session Timeline)**:
   - Xem chuỗi tuần tự từng bước gọi API trong 28 phiên người dùng tương tác.
   - Biểu đồ độ trễ thác nước (waterfall duration).

5. **Từ Điển Datasets (Datasets Dictionary)**:
   - Danh bạ tra cứu 68 bảng dataset dùng trong hệ thống EMS.
   - Tra cứu cột và danh sách các endpoints sử dụng bảng đó.

6. **Tương Tác Nâng Cao**:
   - Nút **"Phân tích lại A1.txt"** giúp cập nhật dữ liệu ngay khi bạn chỉnh sửa file `A1.txt`.
   - Chế độ **Giao diện Tối (Dark mode) / Sáng (Light mode)** linh hoạt.
   - Menu xuất nhanh OpenAPI 3.0 và Postman Collection.

---

## 📁 Cấu Trúc Thư Mục

```
ems-api-analyzer/
├── analyzer.py            # Logic đọc, chuẩn hóa YAML/JSON và phân tích A1.txt
├── server.py              # Web server đa luồng cung cấp API & giao diện tĩnh
├── start.sh               # Script khởi động tự động một chạm
├── README.md              # Tài liệu hướng dẫn sử dụng
├── data/                  # Thư mục chứa dữ liệu xuất ra
│   ├── analyzed_apis.json # Kết quả phân tích toàn diện
│   ├── openapi.json       # Đặc tả OpenAPI 3.0
│   └── postman_collection.json # Bộ sưu tập Postman v2.1
└── web/                   # Giao diện người dùng hiện đại
    ├── index.html         # Khung HTML5 chuẩn ngữ nghĩa
    ├── styles.css         # CSS Tokens, Glassmorphism, Responsive
    └── app.js             # Logic xử lý giao diện, bộ lọc và biểu đồ
```
