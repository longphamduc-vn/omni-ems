/**
 * Core Data Models & Types for LG Display EMS Data Retrieval APIs
 */

// Nexacro Envelope
export interface NexacroParameter {
  id: string;
  value: string;
  type?: string;
}

export interface NexacroPayload {
  parameters?: Record<string, string | number | boolean | null | undefined>;
  datasets?: Record<string, Record<string, any>[]>;
}

export interface NexacroResponse<T = any> {
  errorCode: number;
  errorMsg: string;
  parameters: Record<string, string>;
  datasets: Record<string, any[]>;
  data: T;
}

export interface NexacroClientConfig {
  baseUrl?: string;
  userId?: string;
  organizationId?: string;
  language?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

// 1. Stock Status (Tồn kho phụ tùng)
export interface StockStatusSearchParams {
  organizationId: string;
  itemId?: string;
  itemDesc?: string;
  maker?: string;
  model?: string;
  stockDept?: string;
  optimizeFlag?: string;
  itemCond?: string;
}

export interface StockStatusItem {
  itemName: string;
  organizationId: string;
  inventoryItemId: string;
  itemDescription: string;
  itemStatus: string;
  uomCode: string;
  maker: string;
  catalogGroupName: string;
  itemSpec: string;
  model: string;
  onhandQuantity: string;
  allocatedQuantity: string;
  availableQuantity: string;
  unitPriceNew: string;
  unitPriceReb: string;
  stockDepartment?: string;
  inventoryDepartmentCode?: string;
  plannerCode?: string;
  itemTypeName?: string;
}

// 2. Estimate Requests (Báo giá RFQ)
export interface EstimateRequestSearchParams {
  organizationId: string;
  itemType?: string;
  budgetDept?: string;
  estimateStatus?: string;
  estimateRequestDateFrom?: string;
  estimateRequestDateTo?: string;
  workOrder?: string;
}

export interface EstimateRequestItem {
  filePrvNo: string;
  prvNo?: string;
  estimateRequestDate: string;
  contact: string;
  factory: string;
  emNo: string;
  emNoDesc: string;
  budgetDept: string;
  budgetDepartmentCode: string;
  workOrder: string;
  woType: string;
  requestComment: string;
  item: string;
  itemDescription: string;
  supplier: string;
  requestQty: string;
  estimateStatus: string;
  estimateCost: string;
  prNo?: string;
  poNo?: string;
}

// 3. Item Detail & Inventory Metrics (Chi tiết linh kiện & Định mức tồn kho)
export interface ItemDetailInput {
  organizationId: string;
  inventoryItemId?: string;
  item?: string;
}

export interface ItemDetailMaster {
  item: string;
  description: string;
  uomCode: string;
  maker: string;
  catalogGroup: string;
  makerPart: string;
  onhandQuantity: string;
  allocatedQuantity: string;
  availableQuantity: string;
  vendorName: string;
  unitPriceNew: string;
  itemStatus: string;
}

export interface ItemDetailInventory {
  buyItemType: string;
  priceRegStatus: string;
  targetQty: string;
  logicQty: string;
  userQty: string;
  safetyStockQty: string;
  onhandQty: string;
  fullLeadTimeNew: string;
  optimizedLogicBmQty: string;
  optimizedLogicQty: string;
  oneTimeUserQty: string;
  targetApplyType: string;
}

export interface ItemDetailSummary {
  monthAvgUsage2y: string;
  monthAvgUsage1y: string;
  monthAvgUsage3m: string;
  lastMonthIssueQty: string;
  thisMonthIssueQty: string;
  onceAvgIssueQty: string;
}

export interface ItemDetailResponse {
  item: ItemDetailMaster;
  inventory: ItemDetailInventory;
  summary: ItemDetailSummary;
}

// 4. Target Stock & Safety Stock Optimization (Tồn kho tối ưu & an toàn)
export interface TargetStockSearchParams {
  organizationId: string;
  userId?: string;
  item?: string;
}

export interface TargetStockItem {
  item: string;
  itemDescription: string;
  model: string;
  maker: string;
  targetQty: string;
  safetyQty: string;
  logicQty: string;
  userQty: string;
  optimizedLogicBmQty: string;
  optimizedLogicQty: string;
  orderBufDay: string;
  dueDays: string;
  fullLeadTime: string;
  targetApplyTypeCode: string;
  targetApplyType: string;
  oneTimeUserQty: string;
  managementContactName: string;
  purchaseRequisitionQty: string;
}

// 5. Item Search Popup (Tra cứu linh kiện)
export interface ItemSearchParams {
  organizationId: string;
  item?: string;
  itemDescription?: string;
  maker?: string;
  model?: string;
}

export interface ItemSearchRecord {
  item: string;
  description: string;
  model: string;
  maker: string;
  catalogGroup: string;
  uomCode: string;
}

// 6. Item PO History (Lịch sử đơn mua hàng PO)
export interface ItemPoStatusParams {
  organizationId: string;
  item?: string;
  inventoryItemId?: string;
}

export interface ItemPoStatusRecord {
  poNumber: string;
  poDate: string;
  supplier: string;
  item: string;
  quantity: string;
  unitPrice: string;
  status: string;
  requestor: string;
  department: string;
}

// 7. Common Codes (Từ điển danh mục mã dùng chung)
export interface CommonCodeItem {
  comCode: string;
  comCodeDesc: string;
  enabledFlag: string;
  data2Code?: string;
  data3Code?: string;
}

// 8. Factory List (Danh mục nhà máy)
export interface FactoryItem {
  comCode: string;
  comCodeDesc: string;
  description: string;
  factoryType: string;
  city: string;
  areaCode: string;
  organizationId: string;
  seqNo: string;
}
