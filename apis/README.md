# Bộ Chuẩn Hóa API Cốt Lõi LG Display EMS (`apis/`)

Thư mục này tập trung vào **8 API lấy dữ liệu nghiệp vụ chính** của hệ thống LG Display EMS. Toàn bộ các API phụ trợ như Log hệ thống (`insertStartLog`, `updateEndLog`), Cây menu (`retrieveFavoriteMenuList`), Giao diện lưới (`retrieveGridFormat`), và cờ quyền hạn đã được loại bỏ để tập trung vào dữ liệu.

---

## 1. Cấu Trúc Thư Mục Tinh Gọn

```text
omni-ems/apis/
├── README.md                          # Tài liệu mô tả 8 API lấy dữ liệu & hướng dẫn tích hợp
├── client.ts                          # Client gọi API Nexacro Platform chuẩn (TS/JS)
├── types.ts                           # Định nghĩa kiểu dữ liệu cho 8 nghiệp vụ (Item, Stock, RFQ, PO...)
├── openapi.json                       # Đặc tả OpenAPI 3.0 cho 8 API lấy dữ liệu
└── index.ts                           # Export toàn bộ client & types
```

---

## 2. Bảng Danh Mục 8 API Lấy Dữ Liệu Cốt Lõi

| STT | Tên API | URL Endpoint | Output Dataset | Mục Đích Nghiệp Vụ |
|:---:|:---|:---|:---|:---|
| 1 | **Tồn kho phụ tùng** | `/emsspareparts/sp101/sp110Nav/RetStockStatusList.lgdn` | `ds_result` (38 cols) | Tra cứu số lượng tồn kho (onhand), phân bổ, khả dụng, đơn giá linh kiện mới/sửa chữa. |
| 2 | **Danh sách báo giá (RFQ)** | `/emsspareparts/sp101/sp120Nav/RetEstimateRequestList.lgdn` | `ds_list` (63 cols) | Danh sách yêu cầu báo giá linh kiện, giá dự kiến, liên kết Work Order và mã PR/PO. |
| 3 | **Chi tiết linh kiện & kho** | `/emsspareparts/sp102/sp135Nav/retrieveItemInfoDetail.lgdn` | `ds_Item`, `ds_Inv`, `ds_Summary` | Quy cách kỹ thuật linh kiện, định mức tồn kho an toàn và tần suất xuất kho 3 tháng/1 năm/2 năm. |
| 4 | **Tồn kho tối ưu (Target Stock)** | `/emsspareparts/sp302/sp335Nav/TargetStockSearchList.lgdn` | `ds_StockInfomation` (93 cols) | Bảng 93 chỉ số tồn kho an toàn, thời gian lead time, buffer days theo logic tính toán. |
| 5 | **Tra cứu danh mục linh kiện** | `/emscom/popupNav/retrieveItem.lgdn` | `ds_List` | Popup tìm kiếm linh kiện Master theo mã Item, mô tả, Maker, Model. |
| 6 | **Lịch sử đơn mua hàng (PO)** | `/emscom/popupNav/retrieveItemPoStatusList.lgdn` | `ds_Rtn` | Popup lịch sử các đơn đặt hàng PO của từng linh kiện phụ tùng. |
| 7 | **Từ điển mã dùng chung** | `/emscom/codeNav/retComCodeList.lgdn` | `ds_output0`... | Danh mục mã loại linh kiện (`Q`, `C`), trạng thái báo giá (`DRAFT`, `APPROVED`), nhà xưởng. |
| 8 | **Danh mục nhà máy (Factory)** | `/emswonew/wn90/wn900Nav/retFactoryList.lgdn` | `ds_cbo_factory` (10 cols) | Danh mục cơ cấu nhà máy (`HW` Hải Phòng, `M06` Paju, `LGDVH`). |

---

## 3. Ví Dụ Tích Hợp Nhanh

```typescript
import { emsClient } from "./apis";

// Cấu hình Session
emsClient.setSession("658359", "28753", "EN");

// 1. Lấy dữ liệu tồn kho phụ tùng
const stockList = await emsClient.getStockStatus(
  { organizationId: "28753", optimizeFlag: "Y" },
  ["QCAD57452", "QCAD51163"]
);

// 2. Lấy dữ liệu chi tiết linh kiện
const itemDetail = await emsClient.getItemDetail({
  organizationId: "28753",
  inventoryItemId: "1934887"
});
console.log("Linh kiện:", itemDetail.item.description);
console.log("Tồn kho khả dụng:", itemDetail.item.availableQuantity);
console.log("Tồn kho an toàn:", itemDetail.inventory.safetyStockQty);

// 3. Lấy danh sách yêu cầu báo giá (RFQ)
const rfqList = await emsClient.getEstimateRequests({
  organizationId: "28753"
});
```
