-- ==============================================================
-- Dữ liệu hạt giống thực tế trích xuất từ captures (t1.txt)
-- ==============================================================

-- 1. Items
INSERT OR REPLACE INTO items (item, description, model, maker, catalog_group, uom_code, catalog_group_name, item_spec, item_status, unit_price_new, unit_price_reb, unit_price_po, maker_part)
VALUES
('QCAD57452', 'Vacuum Pad(except Robot) ** ZPT04USK6-04-A8, SMC CORPORATION, Shape:CIRCLE, Thickness:12mm, Material:SILICONE RUBBER', 'ZPT04USK6-04-A8', 'SMC CORPORATION', 'Q4.Vacuum Pad', 'EA', 'Q4.Vacuum Pad', 'Shape:CIRCLE, Thickness:12mm, Material:SILICONE RUBBER', 'Active', 36.0, 0.0, 36.0, 'ZPT04USK6-04-A8'),
('QCAC41921', 'Hose/Tube ** N2-1-1/2-BU-100M, NITTA CORPORATION, Diameter:12.7mm, Inner Diameter:9.56mm, Material:NYLON', 'N2-1-1/2-BU-100M', 'NITTA CORPORATION', 'Q4.Hose/Tube', 'EA', 'Q4.Hose/Tube', 'Diameter:12.7mm, Inner Diameter:9.56mm, Material:NYLON', 'Active', 0.0, 0.0, 0.0, 'N2-1-1/2-BU-100M'),
('QCAD51163', 'Pneumatic Cylinder ** CDQ2YA32-30DCM, SMC CORPORATION, Inner Diameter:32mm, Applicable Pressure:1.0MPa', 'CDQ2YA32-30DCM', 'SMC CORPORATION', 'Q4.Pneumatic Cylinder', 'EA', 'Q4.Pneumatic Cylinder', 'Inner Diameter:32mm, Stroke:30mm, Double Acting', 'Active', 85.5, 45.0, 85.5, 'CDQ2YA32-30DCM'),
('QCAD54664', 'Solenoid Valve ** SY3120-5LZD-M5, SMC CORPORATION, 24VDC, 5 Port', 'SY3120-5LZD-M5', 'SMC CORPORATION', 'Q4.Solenoid Valve', 'EA', 'Q4.Solenoid Valve', '24VDC, 5 Port, Single', 'Active', 42.0, 20.0, 42.0, 'SY3120-5LZD-M5');

-- 2. Inventory
INSERT INTO inventory (
    organization_id, inventory_item_id, item, buy_item_type, price_reg_status,
    review_qty, target_qty, logic_qty, user_qty, safety_stock_qty, user_flag,
    onhand_quantity, allocated_quantity, available_quantity, stock_department,
    inventory_department_code, planner_code, full_lead_time_new,
    optimized_logic_bm_qty, optimized_logic_qty, one_time_user_qty, target_apply_type
) VALUES
('28753', '2271981', 'QCAD57452', 'Individual Management', 'Registered', '1', '1', '17', '0', '0', 'N', '0', '0', '0', 'PO Module Tech', '87301', 'PLANNER', '70', '1', '1', '28', 'Optimized(Unplanned)'),
('28753', '1366786', 'QCAC41921', 'Individual Management', 'Registered', '0', '0', '0', '0', '0', 'N', '0', '0', '0', 'PO Module Tech', '87301', 'PLANNER', '45', '1', '1', '0', 'Non-optimized'),
('28753', '1934887', 'QCAD51163', 'Individual Management', 'Registered', '3', '3', '2', '3', '2', 'Y', '5', '1', '4', 'PO Module Tech', '87301', 'PLANNER', '60', '2', '2', '5', 'Optimized(Planned)'),
('28753', '1945520', 'QCAD54664', 'Individual Management', 'Registered', '5', '5', '4', '5', '4', 'Y', '10', '2', '8', 'PO Module Tech', '87301', 'PLANNER', '30', '4', '4', '0', 'Optimized(Planned)');

-- 3. Item Usage Summary
INSERT OR REPLACE INTO item_usage_summary (item, month_avg_usage_2y, month_avg_usage_1y, month_avg_usage_3m, last_month_issue_qty, this_month_issue_qty, once_avg_issue_qty)
VALUES
('QCAD57452', '12', '15', '18', '5', '8', '4'),
('QCAC41921', '0', '1', '0', '0', '0', '0'),
('QCAD51163', '2.5', '3.0', '2.0', '3', '1', '1'),
('QCAD54664', '4.0', '5.2', '6.0', '4', '2', '2');

-- 4. Estimate Requests (RFQ)
INSERT INTO estimate_requests (
    file_prv_no, prv_no, estimate_request_date, contact, factory, em_no, em_no_desc,
    budget_dept, budget_department_code, work_order, wo_type, request_comment, item,
    item_description, supplier, request_qty, estimate_status, estimate_cost,
    pr_no, po_no, organization_id
) VALUES (
    'Q2610-3091080', '', '20261009000000000', 'LGDVH', 'HW', 'HWBMTL21EC0101',
    'HW CP LASER MARKING 201-STAGE UNIT-ALIGN STAGE', 'PO Module Technology Team 2', '87321',
    'WO-248616130', 'PR', '1. Purpose : RFQ 2. Contents : Laser marking pad replacement',
    'QCAD57452', 'Vacuum Pad(except Robot) ** ZPT04USK6-04-A8, SMC CORPORATION',
    'SMC CORPORATION', '1', 'Available', '36', 'PR-2026-9011', 'PO-2026-4412', '28753'
);

-- 5. Target Stock
INSERT INTO target_stock (
    organization_id, inventory_item_id, item, item_description, model, maker,
    target_qty, safety_qty, logic_qty, user_qty,
    optimized_logic_bm_qty, optimized_logic_qty, order_buf_day, due_days, full_lead_time,
    target_apply_type_code, target_apply_type, one_time_user_qty, management_contact_name,
    purchase_requisition_qty
) VALUES (
    '28753', '2271981', 'QCAD57452',
    'Vacuum Pad(except Robot) ** ZPT04USK6-04-A8, SMC CORPORATION, Shape:CIRCLE, Thickness:12mm, Material:SILICONE RUBBER',
    'ZPT04USK6-04-A8', 'SMC CORPORATION', '1', '0', '17', '0',
    '1', '1', '99999999', '0', '70',
    'OPTIMIZATION_NON_PERIOD', 'Optimized(Unplanned)', '28', '20260922_Pham Duc Long', '28'
);

-- 6. Item PO History
INSERT INTO item_po_history (organization_id, inventory_item_id, item, po_number, po_date, supplier, quantity, unit_price, status, requestor, department)
VALUES
('28753', '2271981', 'QCAD57452', 'PO-2026-4412', '2026-10-10', 'SMC CORPORATION', '28', '36.0', 'APPROVED', 'Pham Duc Long', 'PO Module Tech 2'),
('28753', '1934887', 'QCAD51163', 'PO-2026-3890', '2026-08-20', 'SMC CORPORATION', '5', '85.5', 'COMPLETED', 'Pham Duc Long', 'PO Module Tech 1');

-- 7. Common Codes
INSERT INTO common_codes (group_code, com_code, com_code_desc, enabled_flag, data2_code, data3_code)
VALUES
('retrieveItemType', 'Q', 'Spare Parts (Q)', 'Y', 'SP', ''),
('retrieveItemType', 'C', 'Consumables (C)', 'Y', 'CS', ''),
('retrieveItemType', 'T', 'Tools (T)', 'Y', 'TL', ''),
('retrieveEstimateStatus', 'DRAFT', 'Draft RFQ', 'Y', '01', ''),
('retrieveEstimateStatus', 'REQUESTED', 'Estimate Requested', 'Y', '02', ''),
('retrieveEstimateStatus', 'BID_SUBMITTED', 'Supplier Bid Submitted', 'Y', '03', ''),
('retrieveEstimateStatus', 'APPROVED', 'Estimate Approved', 'Y', '04', ''),
('retrieveNewWoOrg', 'HW', 'Hai Phong Works', 'Y', '28753', 'A13'),
('retrieveNewWoOrg', 'M06', 'Paju Module Works', 'Y', '132', 'M06');

-- 8. Factories
INSERT OR REPLACE INTO factories (com_code, com_code_desc, description, factory_type, city, area_code, organization_id, seq_no)
VALUES
('HW', 'Hai Phong Works', 'Module Factory Hai Phong', 'Module Factory', 'Hai Phong', 'M01', '28753', '1'),
('M06', 'Paju Works', 'Module Factory Paju', 'Module Factory', 'Paju', 'M06', '132', '2'),
('LGDVH', 'LGDVH Plant', 'LG Display Vietnam Asset Plant', 'Main Plant', 'Hai Phong', 'VH', '28753', '3');
