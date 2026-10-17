-- ==============================================================
-- LG Display EMS Core Data Database Schema (SQLite)
-- Only business data tables (Removed log, menu, layout, auth)
-- ==============================================================

-- 1. Danh mục linh kiện Master
CREATE TABLE IF NOT EXISTS items (
    item TEXT PRIMARY KEY,
    description TEXT,
    model TEXT,
    maker TEXT,
    catalog_group TEXT,
    uom_code TEXT DEFAULT 'EA',
    catalog_group_name TEXT,
    item_spec TEXT,
    item_status TEXT DEFAULT 'Active',
    unit_price_new REAL DEFAULT 0,
    unit_price_reb REAL DEFAULT 0,
    unit_price_unl REAL DEFAULT 0,
    unit_price_po REAL DEFAULT 0,
    maker_part TEXT,
    item_type_name TEXT DEFAULT 'Individual Management'
);

-- 2. Tồn kho phụ tùng
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id TEXT,
    inventory_item_id TEXT,
    item TEXT,
    buy_item_type TEXT DEFAULT 'Non-integrated',
    price_reg_status TEXT DEFAULT 'Registered',
    review_qty TEXT DEFAULT '0',
    target_qty TEXT DEFAULT '0',
    logic_qty TEXT DEFAULT '0',
    user_qty TEXT DEFAULT '0',
    safety_stock_qty TEXT DEFAULT '0',
    user_flag TEXT DEFAULT 'N',
    onhand_quantity TEXT DEFAULT '0',
    allocated_quantity TEXT DEFAULT '0',
    available_quantity TEXT DEFAULT '0',
    stock_department TEXT,
    inventory_department_code TEXT,
    planner_code TEXT,
    full_lead_time_new TEXT DEFAULT '70',
    optimized_logic_bm_qty TEXT DEFAULT '1',
    optimized_logic_qty TEXT DEFAULT '1',
    one_time_user_qty TEXT DEFAULT '0',
    target_apply_type TEXT,
    FOREIGN KEY(item) REFERENCES items(item)
);

-- 3. Thống kê xuất dùng bình quân
CREATE TABLE IF NOT EXISTS item_usage_summary (
    item TEXT PRIMARY KEY,
    month_avg_usage_2y TEXT DEFAULT '0',
    month_avg_usage_1y TEXT DEFAULT '0',
    month_avg_usage_3m TEXT DEFAULT '0',
    last_month_issue_qty TEXT DEFAULT '0',
    this_month_issue_qty TEXT DEFAULT '0',
    once_avg_issue_qty TEXT DEFAULT '0',
    FOREIGN KEY(item) REFERENCES items(item)
);

-- 4. Danh sách yêu cầu báo giá (RFQ)
CREATE TABLE IF NOT EXISTS estimate_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_prv_no TEXT,
    prv_no TEXT,
    estimate_request_date TEXT,
    contact TEXT,
    factory TEXT,
    em_no TEXT,
    em_no_desc TEXT,
    budget_dept TEXT,
    budget_department_code TEXT,
    work_order TEXT,
    wo_type TEXT DEFAULT 'PR',
    request_comment TEXT,
    item TEXT,
    item_description TEXT,
    supplier TEXT,
    request_qty TEXT DEFAULT '1',
    estimate_status TEXT DEFAULT 'Available',
    estimate_cost TEXT,
    pr_no TEXT,
    po_no TEXT,
    organization_id TEXT
);

-- 5. Tồn kho an toàn & tối ưu (Target Stock 93 fields)
CREATE TABLE IF NOT EXISTS target_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id TEXT,
    inventory_item_id TEXT,
    item TEXT,
    item_description TEXT,
    model TEXT,
    maker TEXT,
    target_qty TEXT DEFAULT '0',
    safety_qty TEXT DEFAULT '0',
    logic_qty TEXT DEFAULT '0',
    user_qty TEXT DEFAULT '0',
    optimized_logic_bm_qty TEXT DEFAULT '1',
    optimized_logic_qty TEXT DEFAULT '1',
    order_buf_day TEXT DEFAULT '99999999',
    due_days TEXT DEFAULT '0',
    full_lead_time TEXT DEFAULT '70',
    target_apply_type_code TEXT,
    target_apply_type TEXT,
    one_time_user_qty TEXT DEFAULT '0',
    management_contact_name TEXT,
    purchase_requisition_qty TEXT DEFAULT '0'
);

-- 6. Lịch sử đơn mua hàng PO
CREATE TABLE IF NOT EXISTS item_po_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id TEXT,
    inventory_item_id TEXT,
    item TEXT,
    po_number TEXT,
    po_date TEXT,
    supplier TEXT,
    quantity TEXT,
    unit_price TEXT,
    status TEXT,
    requestor TEXT,
    department TEXT
);

-- 7. Từ điển mã dùng chung
CREATE TABLE IF NOT EXISTS common_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_code TEXT,
    com_code TEXT,
    com_code_desc TEXT,
    enabled_flag TEXT DEFAULT 'Y',
    data2_code TEXT,
    data3_code TEXT
);

-- 8. Danh mục nhà máy
CREATE TABLE IF NOT EXISTS factories (
    com_code TEXT PRIMARY KEY,
    com_code_desc TEXT,
    description TEXT,
    factory_type TEXT,
    city TEXT,
    area_code TEXT,
    organization_id TEXT,
    seq_no TEXT
);
