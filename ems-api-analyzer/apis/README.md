# 📁 Danh Mục 50 API EMS Phân Loại Theo Chức Năng Nghiệp Vụ

Hệ thống tệp cấu hình YAML chuẩn hóa từng API Endpoint trích xuất từ **LG Display EMS Nexacro Platform**, được tổ chức phân cấp theo **7 Nhóm Chức Năng Nghiệp Vụ Core**. Mỗi API là 1 tệp cấu hình độc lập (`.yml`) đầy đủ tham số, schema datasets và quan hệ phụ thuộc.

---

## 📊 Thống Kê Tổng Quan

- **Tổng số Endpoints:** 50 API Endpoints
- **Số nhóm chức năng:** 7 Thư mục nghiệp vụ
- **Mỗi API:** 1 tệp `.yml` độc lập, chuẩn hóa trường `info`, `architecture`, `request` và `response`.

| Thư mục chức năng | Tên nhóm chức năng (Nghiệp vụ) | Số lượng API | Mô tả phạm vi |
|:---|:---|:---:|:---|
| [`01_inventory_spareparts/`](./01_inventory_spareparts) | **01. Quản lý Tồn kho & Chi tiết Phụ tùng** | **8** | Tra cứu tồn kho thực tế, tồn khả dụng, quy cách kỹ thuật, MTBF và lịch sử xuất dùng linh kiện. |
| [`02_target_stock_optimization/`](./02_target_stock_optimization) | **02. Tối ưu hóa Định mức Tồn kho An toàn** | **4** | Tính toán 93 thông số tồn kho mục tiêu, lead time, hệ số đệm buffer days và gợi ý mua bù tồn kho. |
| [`03_procurement_orders/`](./03_procurement_orders) | **03. Mua sắm, Báo giá & Đơn hàng PO** | **14** | Lập phiếu PRV, báo giá RFQ, quản lý đơn PO, đơn khẩn cấp Emergency PO và tra cứu đơn giá các site. |
| [`04_work_orders/`](./04_work_orders) | **04. Bảo trì Thiết bị & Lệnh công tác** | **4** | Khởi tạo form công tác WO, xuất dùng vật tư cho bảo trì, lịch sử trạng thái WO và mã thực thể WIP. |
| [`05_approval_workflow/`](./05_approval_workflow) | **05. Quy trình Phê duyệt Điện tử** | **5** | Tính toán luồng duyệt, kiểm tra cờ vượt mức phê duyệt (PLOverFlag) và gửi duyệt điện tử. |
| [`06_common_master_security/`](./06_common_master_security) | **06. Dữ liệu Dùng chung & Bảo mật Phân quyền** | **13** | Từ điển mã combobox, popup tìm kiếm linh kiện, danh bạ nhân viên, phân quyền nút và phân quyền menu. |
| [`07_audit_logging/`](./07_audit_logging) | **07. Nhật ký Hệ thống** | **2** | Ghi nhận thời điểm bắt đầu thao tác màn hình (insertStartLog) và kết thúc phiên làm việc (updateEndLog). |

---

## 🗂️ Chi Tiết 50 Tệp API Theo Từng Nhóm Chức Năng

### 📂 01. Quản lý Tồn kho & Chi tiết Phụ tùng (`01_inventory_spareparts/` - 8 APIs)

> Tra cứu tồn kho thực tế, tồn khả dụng, quy cách kỹ thuật, MTBF và lịch sử xuất dùng linh kiện.

| STT | Tên Action | Tệp cấu hình YAML | Endpoint thực tế | Phân hệ | Phân loại | Mô tả tóm tắt |
|:---:|:---|:---|:---|:---:|:---:|:---|
| 1 | **retWaitRepairItemInterlock** | [`01_inventory_spareparts/retWaitRepairItemInterlock.yml`](./01_inventory_spareparts/retWaitRepairItemInterlock.yml) | `emsspareparts/sp102/sp131Nav/retWaitRepairItemInterlock.lgdn` | `emsspareparts` | `QUERY` | Kiểm tra ràng buộc interlock đối với linh kiện chờ sửa chữa trước khi cấp phát mới. |
| 2 | **RetStockStatusList** | [`01_inventory_spareparts/RetStockStatusList.yml`](./01_inventory_spareparts/RetStockStatusList.yml) | `emsspareparts/sp101/sp110Nav/RetStockStatusList.lgdn` | `emsspareparts` | `QUERY` | Tra cứu danh sách tồn kho phụ tùng thực tế, tồn kho khả dụng, giá vốn, cờ bản vẽ FDM CAD và cảnh báo Red Flag. |
| 3 | **retEcFlag** | [`01_inventory_spareparts/retEcFlag.yml`](./01_inventory_spareparts/retEcFlag.yml) | `emsspareparts/sp102/sp137Nav/retEcFlag.lgdn` | `emsspareparts` | `QUERY` | Kiểm tra cờ thay đổi kỹ thuật (Engineering Change - EC) của phụ tùng. |
| 4 | **retrieveItemInfoPopList** | [`01_inventory_spareparts/retrieveItemInfoPopList.yml`](./01_inventory_spareparts/retrieveItemInfoPopList.yml) | `emsspareparts/sp102/sp131Nav/retrieveItemInfoPopList.lgdn` | `emsspareparts` | `QUERY` | Danh mục popup danh sách phụ tùng thay thế liên kết của máy móc. |
| 5 | **retrieveItemUseDate** | [`01_inventory_spareparts/retrieveItemUseDate.yml`](./01_inventory_spareparts/retrieveItemUseDate.yml) | `emsspareparts/sp102/sp131Nav/retrieveItemUseDate.lgdn` | `emsspareparts` | `QUERY` | Lấy ngày xuất dùng phụ tùng gần nhất để dự báo hao mòn và chu kỳ thay thế định kỳ. |
| 6 | **retrieveItemInfoDetail** | [`01_inventory_spareparts/retrieveItemInfoDetail.yml`](./01_inventory_spareparts/retrieveItemInfoDetail.yml) | `emsspareparts/sp102/sp135Nav/retrieveItemInfoDetail.lgdn` | `emsspareparts` | `QUERY` | Chi tiết kỹ thuật linh kiện, đơn vị tính, chỉ số độ tin cậy MTBF và lịch sử xuất dùng bình quân 3M/1Y/2Y. |
| 7 | **RetAllocationQuantity** | [`01_inventory_spareparts/RetAllocationQuantity.yml`](./01_inventory_spareparts/RetAllocationQuantity.yml) | `emsspareparts/sp101/sp110Nav/RetAllocationQuantity.lgdn` | `emsspareparts` | `QUERY` | Kiểm tra lượng hàng đã phân bổ cho các chuyền/phân xưởng khác trong nhà máy. |
| 8 | **retSparepartsStatus** | [`01_inventory_spareparts/retSparepartsStatus.yml`](./01_inventory_spareparts/retSparepartsStatus.yml) | `emsspareparts/sp201/sp220Nav/retSparepartsStatus.lgdn` | `emsspareparts` | `QUERY` | Giám sát trạng thái toàn chuỗi cung ứng linh kiện theo thời gian thực (đang duyệt, đã duyệt, đã lên PR, chờ PO, giao lũy kế). |

### 📂 02. Tối ưu hóa Định mức Tồn kho An toàn (`02_target_stock_optimization/` - 4 APIs)

> Tính toán 93 thông số tồn kho mục tiêu, lead time, hệ số đệm buffer days và gợi ý mua bù tồn kho.

| STT | Tên Action | Tệp cấu hình YAML | Endpoint thực tế | Phân hệ | Phân loại | Mô tả tóm tắt |
|:---:|:---|:---|:---|:---:|:---:|:---|
| 1 | **retrieveItemTargetQtyInfo** | [`02_target_stock_optimization/retrieveItemTargetQtyInfo.yml`](./02_target_stock_optimization/retrieveItemTargetQtyInfo.yml) | `emscom/prvNoNav/retrieveItemTargetQtyInfo.lgdn` | `emscom` | `QUERY` | Tra cứu thông tin định mức mục tiêu khi lập phiếu đề nghị mua sắm. |
| 2 | **TargetStockSearchList** | [`02_target_stock_optimization/TargetStockSearchList_sp335.yml`](./02_target_stock_optimization/TargetStockSearchList_sp335.yml) | `emsspareparts/sp302/sp335Nav/TargetStockSearchList.lgdn` | `emsspareparts` | `QUERY` | Truy vấn danh mục định mức tồn kho an toàn với 93 trường dữ liệu tối ưu hóa. |
| 3 | **GetOptimizeInfo** | [`02_target_stock_optimization/GetOptimizeInfo.yml`](./02_target_stock_optimization/GetOptimizeInfo.yml) | `emsspareparts/sp302/sp330Nav/GetOptimizeInfo.lgdn` | `emsspareparts` | `QUERY` | Lấy thông số tối ưu hóa (Lead time cơ sở, ngày đệm đặt hàng, mức tồn an toàn khuyến nghị). |
| 4 | **TargetStockSearchList** | [`02_target_stock_optimization/TargetStockSearchList_sp330.yml`](./02_target_stock_optimization/TargetStockSearchList_sp330.yml) | `emsspareparts/sp302/sp330Nav/TargetStockSearchList.lgdn` | `emsspareparts` | `QUERY` | Truy vấn danh mục định mức tồn kho an toàn với 93 trường dữ liệu tối ưu hóa. |

### 📂 03. Mua sắm, Báo giá & Đơn hàng PO (`03_procurement_orders/` - 14 APIs)

> Lập phiếu PRV, báo giá RFQ, quản lý đơn PO, đơn khẩn cấp Emergency PO và tra cứu đơn giá các site.

| STT | Tên Action | Tệp cấu hình YAML | Endpoint thực tế | Phân hệ | Phân loại | Mô tả tóm tắt |
|:---:|:---|:---|:---|:---:|:---:|:---|
| 1 | **retrievePurchaseRequest** | [`03_procurement_orders/retrievePurchaseRequest.yml`](./03_procurement_orders/retrievePurchaseRequest.yml) | `emsspareparts/sp102/sp134Nav/retrievePurchaseRequest.lgdn` | `emsspareparts` | `QUERY` | Tra cứu thông tin chi tiết của một yêu cầu mua sắm đã lập trong hệ thống. |
| 2 | **getEmrgPoFlag** | [`03_procurement_orders/getEmrgPoFlag.yml`](./03_procurement_orders/getEmrgPoFlag.yml) | `emsspareparts/sp102/sp134Nav/getEmrgPoFlag.lgdn` | `emsspareparts` | `QUERY` | Kiểm tra cờ cho phép đặt mua khẩn cấp (Emergency PO Flag). |
| 3 | **RetEstimateRequestList** | [`03_procurement_orders/RetEstimateRequestList.yml`](./03_procurement_orders/RetEstimateRequestList.yml) | `emsspareparts/sp101/sp120Nav/RetEstimateRequestList.lgdn` | `emsspareparts` | `QUERY` | Tra cứu danh sách yêu cầu báo giá nhà cung cấp (RFQ list, trạng thái giá, Work Order). |
| 4 | **retrieveItemBuyMainList** | [`03_procurement_orders/retrieveItemBuyMainList.yml`](./03_procurement_orders/retrieveItemBuyMainList.yml) | `emsspareparts/sp102/sp130Nav/retrieveItemBuyMainList.lgdn` | `emsspareparts` | `QUERY` | Danh mục tổng hợp tình hình mua sắm phụ tùng theo mã đơn hàng PO/RV. |
| 5 | **RetSpPartsTxnGroupIdS** | [`03_procurement_orders/RetSpPartsTxnGroupIdS.yml`](./03_procurement_orders/RetSpPartsTxnGroupIdS.yml) | `emscom/seqNav/RetSpPartsTxnGroupIdS.lgdn` | `emscom` | `QUERY` | Sinh mã định danh phiên giao dịch mua sắm (txnGroupId) từ Sequence hệ thống. |
| 6 | **CreInsertItemPrvRequest** | [`03_procurement_orders/CreInsertItemPrvRequest.yml`](./03_procurement_orders/CreInsertItemPrvRequest.yml) | `emsspareparts/sp101/sp110Nav/CreInsertItemPrvRequest.lgdn` | `emsspareparts` | `MUTATE` | API Đột biến (Mutate) quan trọng: Tạo mới phiếu yêu cầu mua sắm phụ tùng (PRV Request). |
| 7 | **retPoUnitPriceBySiteList** | [`03_procurement_orders/retPoUnitPriceBySiteList.yml`](./03_procurement_orders/retPoUnitPriceBySiteList.yml) | `emsspareparts/sp40/sp403Nav/retPoUnitPriceBySiteList.lgdn` | `emsspareparts` | `QUERY` | Tra cứu lịch sử đơn giá mua PO của phụ tùng theo từng nhà máy sản xuất. |
| 8 | **retrieveItemPoStatusList** | [`03_procurement_orders/retrieveItemPoStatusList.yml`](./03_procurement_orders/retrieveItemPoStatusList.yml) | `emscom/popupNav/retrieveItemPoStatusList.lgdn` | `emscom` | `QUERY` | Tra cứu tiến độ thực hiện đơn hàng PO (ngày đặt, nhà cung cấp, số lượng còn lại). |
| 9 | **retrieveItemRequestDetail** | [`03_procurement_orders/retrieveItemRequestDetail.yml`](./03_procurement_orders/retrieveItemRequestDetail.yml) | `emsspareparts/sp102/sp132Nav/retrieveItemRequestDetail.lgdn` | `emsspareparts` | `QUERY` | Chi tiết mặt hàng được yêu cầu trong phiếu mua sắm. |
| 10 | **retrievePrvNoInfo** | [`03_procurement_orders/retrievePrvNoInfo.yml`](./03_procurement_orders/retrievePrvNoInfo.yml) | `emscom/prvNoNav/retrievePrvNoInfo.lgdn` | `emscom` | `QUERY` | Tra cứu thông tin và tính hợp lệ của số phiếu PRV. |
| 11 | **getCurrencyCode** | [`03_procurement_orders/getCurrencyCode.yml`](./03_procurement_orders/getCurrencyCode.yml) | `emsspareparts/sp102/sp134Nav/getCurrencyCode.lgdn` | `emsspareparts` | `QUERY` | Lấy mã loại tiền tệ thanh toán theo nhà cung cấp (USD, VND, KRW). |
| 12 | **EmergencyPoList** | [`03_procurement_orders/EmergencyPoList.yml`](./03_procurement_orders/EmergencyPoList.yml) | `emsspareparts/sp105/sp180Nav/EmergencyPoList.lgdn` | `emsspareparts` | `OTHER` | Danh sách các đơn đặt hàng mua khẩn cấp được phê duyệt đặc cách. |
| 13 | **getPoMasterReturnUrl** | [`03_procurement_orders/getPoMasterReturnUrl.yml`](./03_procurement_orders/getPoMasterReturnUrl.yml) | `emsspareparts/sp103/sp160Nav/getPoMasterReturnUrl.lgdn` | `emsspareparts` | `QUERY` | Lấy liên kết điều hướng sang hệ thống Quản lý mua hàng tập trung (G-ERP / SRM). |
| 14 | **retrievePrvNoData** | [`03_procurement_orders/retrievePrvNoData.yml`](./03_procurement_orders/retrievePrvNoData.yml) | `emsspareparts/sp102/sp136Nav/retrievePrvNoData.lgdn` | `emsspareparts` | `QUERY` | Trích xuất toàn bộ dữ liệu cấu thành của một mã phiếu PRV. |

### 📂 04. Bảo trì Thiết bị & Lệnh công tác (`04_work_orders/` - 4 APIs)

> Khởi tạo form công tác WO, xuất dùng vật tư cho bảo trì, lịch sử trạng thái WO và mã thực thể WIP.

| STT | Tên Action | Tệp cấu hình YAML | Endpoint thực tế | Phân hệ | Phân loại | Mô tả tóm tắt |
|:---:|:---|:---|:---|:---:|:---:|:---|
| 1 | **WoMasterRetInit** | [`04_work_orders/WoMasterRetInit.yml`](./04_work_orders/WoMasterRetInit.yml) | `emscom/woMasterNav/WoMasterRetInit.lgdn` | `emscom` | `OTHER` | Tải dữ liệu master của một phiếu công tác bảo trì định kỳ. |
| 2 | **WO230WoSaveInit** | [`04_work_orders/WO230WoSaveInit.yml`](./04_work_orders/WO230WoSaveInit.yml) | `emsworkorder/wo20/wo230Nav/WO230WoSaveInit.lgdn` | `emsworkorder` | `OTHER` | Khởi tạo form lưu phiếu công tác WO (công đoạn, vật tư phụ tùng xuất dùng, file đính kèm). |
| 3 | **statusHistory** | [`04_work_orders/statusHistory.yml`](./04_work_orders/statusHistory.yml) | `emsworkorder/wo50/wo580Nav/statusHistory.lgdn` | `emsworkorder` | `OTHER` | Truy vấn lịch sử thay đổi trạng thái của phiếu công tác bảo trì. |
| 4 | **retrieveWipEntity** | [`04_work_orders/retrieveWipEntity.yml`](./04_work_orders/retrieveWipEntity.yml) | `emscom/woSearchNav/retrieveWipEntity.lgdn` | `emscom` | `QUERY` | Tìm kiếm mã định danh thực thể WIP gắn với thiết bị/chuyền sản xuất. |

### 📂 05. Quy trình Phê duyệt Điện tử (`05_approval_workflow/` - 5 APIs)

> Tính toán luồng duyệt, kiểm tra cờ vượt mức phê duyệt (PLOverFlag) và gửi duyệt điện tử.

| STT | Tên Action | Tệp cấu hình YAML | Endpoint thực tế | Phân hệ | Phân loại | Mô tả tóm tắt |
|:---:|:---|:---|:---|:---:|:---:|:---|
| 1 | **retrieveCheckAppLine** | [`05_approval_workflow/retrieveCheckAppLine.yml`](./05_approval_workflow/retrieveCheckAppLine.yml) | `emsspareparts/sp103/sp161Nav/retrieveCheckAppLine.lgdn` | `emsspareparts` | `QUERY` | Kiểm tra tính hợp lệ của luồng phê duyệt trước khi ký duyệt. |
| 2 | **retApprovalRequest** | [`05_approval_workflow/retApprovalRequest.yml`](./05_approval_workflow/retApprovalRequest.yml) | `emscom/approvalNav/retApprovalRequest.lgdn` | `emscom` | `QUERY` | Gửi yêu cầu phê duyệt điện tử chính thức vào hệ thống ký duyệt. |
| 3 | **retApprovalLine** | [`05_approval_workflow/retApprovalLine.yml`](./05_approval_workflow/retApprovalLine.yml) | `emscom/approvalNav/retApprovalLine.lgdn` | `emscom` | `QUERY` | Tự động tính toán tuyến duyệt hồ sơ theo ngân sách, phòng ban, loại mua sắm. |
| 4 | **retPLOverFlag** | [`05_approval_workflow/retPLOverFlag.yml`](./05_approval_workflow/retPLOverFlag.yml) | `emscom/approvalNav/retPLOverFlag.lgdn` | `emscom` | `QUERY` | Kiểm tra cờ vượt hạn mức phê duyệt (Price Level Over Flag) để bổ sung cấp duyệt cao hơn. |
| 5 | **retMethodPop** | [`05_approval_workflow/retMethodPop.yml`](./05_approval_workflow/retMethodPop.yml) | `emscom/approvalNav/retMethodPop.lgdn` | `emscom` | `QUERY` | Lựa chọn phương thức phê duyệt (Trực tiếp, Ủy quyền, Ký song song). |

### 📂 06. Dữ liệu Dùng chung & Bảo mật Phân quyền (`06_common_master_security/` - 13 APIs)

> Từ điển mã combobox, popup tìm kiếm linh kiện, danh bạ nhân viên, phân quyền nút và phân quyền menu.

| STT | Tên Action | Tệp cấu hình YAML | Endpoint thực tế | Phân hệ | Phân loại | Mô tả tóm tắt |
|:---:|:---|:---|:---|:---:|:---:|:---|
| 1 | **retrieveGridFormat** | [`06_common_master_security/retrieveGridFormat.yml`](./06_common_master_security/retrieveGridFormat.yml) | `emscom/gridFormatNav/retrieveGridFormat.lgdn` | `emscom` | `QUERY` | Tải cấu hình ẩn/hiện cột, độ rộng cột của các bảng theo user. |
| 2 | **retComCodeList** | [`06_common_master_security/retComCodeList.yml`](./06_common_master_security/retComCodeList.yml) | `emscom/codeNav/retComCodeList.lgdn` | `emscom` | `QUERY` | Từ điển mã dùng chung: Lấy đồng thời 9 nhóm mã combobox toàn hệ thống. |
| 3 | **CheckMasterAuth** | [`06_common_master_security/CheckMasterAuth.yml`](./06_common_master_security/CheckMasterAuth.yml) | `emsspareparts/sp302/sp330Nav/CheckMasterAuth.lgdn` | `emsspareparts` | `SECURITY` | Kiểm tra quyền quản trị tối cao đối với phân hệ phụ tùng. |
| 4 | **retrieveUserOrgList** | [`06_common_master_security/retrieveUserOrgList.yml`](./06_common_master_security/retrieveUserOrgList.yml) | `emscom/loginNav/retrieveUserOrgList.lgdn` | `emscom` | `QUERY` | Lấy danh sách phòng ban và vai trò trách nhiệm của người dùng. |
| 5 | **GetSpPrivFlag** | [`06_common_master_security/GetSpPrivFlag.yml`](./06_common_master_security/GetSpPrivFlag.yml) | `emsspareparts/sp302/sp330Nav/GetSpPrivFlag.lgdn` | `emsspareparts` | `SECURITY` | Kiểm tra cờ đặc quyền thao tác dữ liệu tồn kho đặc biệt. |
| 6 | **getAuthButton** | [`06_common_master_security/getAuthButton.yml`](./06_common_master_security/getAuthButton.yml) | `emscom/authButtonNav/getAuthButton.lgdn` | `emscom` | `SECURITY` | Lấy cấu hình phân quyền nút bấm theo form (Ẩn/Hiện nút Thêm, Sửa, Xóa, Export). |
| 7 | **retrieveEmployeeNumber** | [`06_common_master_security/retrieveEmployeeNumber.yml`](./06_common_master_security/retrieveEmployeeNumber.yml) | `emscom/loginNav/retrieveEmployeeNumber.lgdn` | `emscom` | `QUERY` | Xác thực thông tin mã nhân viên đăng nhập. |
| 8 | **retrieveLowestEmNo** | [`06_common_master_security/retrieveLowestEmNo.yml`](./06_common_master_security/retrieveLowestEmNo.yml) | `emscom/popupNav/retrieveLowestEmNo.lgdn` | `emscom` | `QUERY` | Popup tra cứu danh bạ nhân viên nội bộ cấp dưới. |
| 9 | **retSiteManagerInfo** | [`06_common_master_security/retSiteManagerInfo.yml`](./06_common_master_security/retSiteManagerInfo.yml) | `emsspareparts/sp102/sp130Nav/retSiteManagerInfo.lgdn` | `emsspareparts` | `QUERY` | Lấy thông tin người phụ trách kho/site tương ứng. |
| 10 | **MenuPermit** | [`06_common_master_security/MenuPermit.yml`](./06_common_master_security/MenuPermit.yml) | `Servlet/MenuPermit.document` | `Servlet` | `SECURITY` | Xác thực quyền mở form/menu của người dùng. |
| 11 | **retrieveAuthCommPartsManager** | [`06_common_master_security/retrieveAuthCommPartsManager.yml`](./06_common_master_security/retrieveAuthCommPartsManager.yml) | `emscom/prvNoNav/retrieveAuthCommPartsManager.lgdn` | `emscom` | `SECURITY` | Quyền duyệt phụ tùng dùng chung liên xưởng. |
| 12 | **RetAuthEmergencyPo** | [`06_common_master_security/RetAuthEmergencyPo.yml`](./06_common_master_security/RetAuthEmergencyPo.yml) | `emsspareparts/sp101/sp110Nav/RetAuthEmergencyPo.lgdn` | `emsspareparts` | `SECURITY` | Kiểm tra quyền phê duyệt đơn hàng mua khẩn cấp. |
| 13 | **retrieveItem** | [`06_common_master_security/retrieveItem.yml`](./06_common_master_security/retrieveItem.yml) | `emscom/popupNav/retrieveItem.lgdn` | `emscom` | `QUERY` | Popup tra cứu tìm kiếm linh kiện chuẩn toàn hệ thống. |

### 📂 07. Nhật ký Hệ thống (`07_audit_logging/` - 2 APIs)

> Ghi nhận thời điểm bắt đầu thao tác màn hình (insertStartLog) và kết thúc phiên làm việc (updateEndLog).

| STT | Tên Action | Tệp cấu hình YAML | Endpoint thực tế | Phân hệ | Phân loại | Mô tả tóm tắt |
|:---:|:---|:---|:---|:---:|:---:|:---|
| 1 | **insertStartLog** | [`07_audit_logging/insertStartLog.yml`](./07_audit_logging/insertStartLog.yml) | `emscom/connLogNav/insertStartLog.lgdn` | `emscom` | `LOGGING` | Ghi nhận thời điểm bắt đầu thao tác trên màn hình. |
| 2 | **updateEndLog** | [`07_audit_logging/updateEndLog.yml`](./07_audit_logging/updateEndLog.yml) | `emscom/connLogNav/updateEndLog.lgdn` | `emscom` | `LOGGING` | Cập nhật thời điểm kết thúc phiên thao tác và tính thời lượng thực hiện. |

