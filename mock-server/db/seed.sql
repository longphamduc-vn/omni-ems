-- ==============================================================
-- Dữ liệu hạt giống thực tế trích xuất từ captures (t1.txt)
-- Bao gồm đầy đủ linh kiện thực tế QCAB17587, QDAE01694 & các mã từ điển
-- ==============================================================

-- 1. Items
INSERT OR REPLACE INTO items (
    item, description, model, maker, catalog_group, uom_code, catalog_group_name,
    item_spec, item_status, unit_price_new, unit_price_reb, unit_price_unl, unit_price_po,
    maker_part, item_type_name, supplier_id, supplier_name, buyer_name, buyer_id,
    fdm_url, fdm_flag, timely_purchase_date, po_type, po_type_code,
    item_category_code, item_category_desc, item_catalog_group_id
)
VALUES
('QCAB17587', 'Joint/Connector ** YTS-S-12-AL, YTS, Material:ALUMINUM, Length:163.5mm, Connection Method:, Remark:ROTARY JOINT(12PORTS), Application Tube Outside Diameter:, Spiral(Inch):', 'YTS-S-12-AL', 'YTS', 'Q4.Joint/Connector', 'EA', 'Q4.Joint/Connector', 'Material:ALUMINUM, Length:163.5mm, Connection Method:, Remark:ROTARY JOINT(12PORTS), Application Tube Outside Diameter:, Spiral(Inch):', 'Active', 2997.49, 0.0, 0.0, 2985.55, 'YTS-S-12-AL', 'Total Management', '863437', 'LGDVN_(주)와이티에스_KR017796', 'Thi Ngoc Mai, Nguyen', '877778', 'http://fdm.lgdisplay.com:8008/Windchill/extcore/jsp/lgdfdm/drawing/qcodeDrawing.jsp?oid=VR:wt.part.WTPart:218987912', 'Y', '20260731', '원 법인 구매', 'PT003', 'QCAB1301', 'Q4.Joint/Connector', '504'),
('QDAE01694', 'Mercury Lamp ** OL-M-NRU7D, ONUV CO.,LTD, Current:8A, Power Rating:200W, Voltage:24VDC, Life:3000HR, Remark:', 'OL-M-NRU7D', 'ONUV CO.,LTD', 'Q4.Mercury Lamp', 'EA', 'Q4.Mercury Lamp', 'Current:8A, Power Rating:200W, Voltage:24VDC, Life:3000HR, Remark:', 'Active', 917.73, 0.0, 0.0, 917.73, 'OL-M-NRU7D', 'Total Management', '863381', 'LGDVN_(주) 서브원_KR017765', 'Thi Ngoc Mai, Nguyen', '877778', 'http://fdm.lgdisplay.com:8008/Windchill/extcore/jsp/lgdfdm/drawing/qcodeDrawing.jsp?oid=VR:wt.part.WTPart:237125783', 'Y', '20260909', '원 법인 구매', 'PT003', 'QDAE0101', 'Q4.Mercury Lamp', '512'),
('QCAD57452', 'Vacuum Pad(except Robot) ** ZPT04USK6-04-A8, SMC CORPORATION, Shape:CIRCLE, Thickness:12mm, Material:SILICONE RUBBER', 'ZPT04USK6-04-A8', 'SMC CORPORATION', 'Q4.Vacuum Pad', 'EA', 'Q4.Vacuum Pad', 'Shape:CIRCLE, Thickness:12mm, Material:SILICONE RUBBER', 'Active', 36.0, 0.0, 0.0, 36.0, 'ZPT04USK6-04-A8', 'Individual Management', '861001', 'SMC CORPORATION', 'Pham Duc Long', '855123', '', 'N', '20261130', 'Local PO', 'PT001', 'QCAD1101', 'Q4.Vacuum Pad', '501'),
('QCAC41921', 'Hose/Tube ** N2-1-1/2-BU-100M, NITTA CORPORATION, Diameter:12.7mm, Inner Diameter:9.56mm, Material:NYLON', 'N2-1-1/2-BU-100M', 'NITTA CORPORATION', 'Q4.Hose/Tube', 'EA', 'Q4.Hose/Tube', 'Diameter:12.7mm, Inner Diameter:9.56mm, Material:NYLON', 'Active', 0.0, 0.0, 0.0, 0.0, 'N2-1-1/2-BU-100M', 'Individual Management', '861002', 'NITTA CORPORATION', 'Pham Duc Long', '855123', '', 'N', '20261231', 'Local PO', 'PT001', 'QCAC1201', 'Q4.Hose/Tube', '502'),
('QCAD51163', 'Pneumatic Cylinder ** CDQ2YA32-30DCM, SMC CORPORATION, Inner Diameter:32mm, Applicable Pressure:1.0MPa', 'CDQ2YA32-30DCM', 'SMC CORPORATION', 'Q4.Pneumatic Cylinder', 'EA', 'Q4.Pneumatic Cylinder', 'Inner Diameter:32mm, Stroke:30mm, Double Acting', 'Active', 85.5, 45.0, 0.0, 85.5, 'CDQ2YA32-30DCM', 'Individual Management', '861001', 'SMC CORPORATION', 'Pham Duc Long', '855123', '', 'N', '20261015', 'Local PO', 'PT001', 'QCAD1301', 'Q4.Pneumatic Cylinder', '503'),
('QCAD54664', 'Solenoid Valve ** SY3120-5LZD-M5, SMC CORPORATION, 24VDC, 5 Port', 'SY3120-5LZD-M5', 'SMC CORPORATION', 'Q4.Solenoid Valve', 'EA', 'Q4.Solenoid Valve', '24VDC, 5 Port, Single', 'Active', 42.0, 20.0, 0.0, 42.0, 'SY3120-5LZD-M5', 'Individual Management', '861001', 'SMC CORPORATION', 'Pham Duc Long', '855123', '', 'N', '20261020', 'Local PO', 'PT001', 'QCAD1401', 'Q4.Solenoid Valve', '505');

-- 2. Inventory
INSERT OR REPLACE INTO inventory (
    organization_id, inventory_item_id, item, buy_item_type, buy_item_type_code, price_reg_status,
    review_qty, target_qty, logic_qty, user_qty, safety_stock_qty, user_flag,
    onhand_quantity, allocated_quantity, available_quantity, stock_department,
    inventory_department_code, planner_code, full_lead_time_new,
    optimized_logic_bm_qty, optimized_logic_qty, one_time_user_qty, target_apply_type, target_apply_type_code,
    not_receiving_qty, over_flag, over_qty, other_site_onhand_qty, disuse_flag, mtbf_day,
    repair_request_qty, wait_repair_qty, available_transfer_qty_all, po_opt_target, red_flag
) VALUES
('28753', '3042180', 'QCAB17587', '통합 관리', 'N002', '단가 등록', '0', '4', '4', '0', '0', 'N', '0', '0', '0', 'NY PO M Technology CP/SG Part 1', '84788', 'SP_UP_VH', '90', '4', '4', '13', '최적화(비계획)', 'OPTIMIZATION_NON_PERIOD', '13', 'Y', '9', '4', 'N', '36.4', '0', '0', '0', 'N', 'N'),
('28753', '3365330', 'QDAE01694', 'Total Management', 'N002', '단가 등록', '0', '0', '0', '0', '0', 'N', '0', '0', '0', 'NY PO M Technology CP/SG Part 1', '84788', 'SP_UP_VH', '70', '0', '0', '0', 'Optimized(Unplanned)', 'OPTIMIZATION_NON_PERIOD', '0', 'N', '0', '0', 'N', '0', '0', '0', '0', 'N', 'N'),
('28753', '2271981', 'QCAD57452', 'Individual Management', 'N001', 'Registered', '1', '1', '17', '0', '0', 'N', '0', '0', '0', 'PO Module Tech', '87301', 'PLANNER', '70', '1', '1', '28', 'Optimized(Unplanned)', 'OPTIMIZATION_NON_PERIOD', '28', 'Y', '10', '0', 'N', '45.0', '0', '0', '0', 'N', 'N'),
('28753', '1366786', 'QCAC41921', 'Individual Management', 'N001', 'Registered', '0', '0', '0', '0', '0', 'N', '0', '0', '0', 'PO Module Tech', '87301', 'PLANNER', '45', '1', '1', '0', 'Non-optimized', 'NON_OPTIMIZED', '0', 'N', '0', '0', 'N', '0', '0', '0', '0', 'N', 'N'),
('28753', '1934887', 'QCAD51163', 'Individual Management', 'N001', 'Registered', '3', '3', '2', '3', '2', 'Y', '5', '1', '4', 'PO Module Tech', '87301', 'PLANNER', '60', '2', '2', '5', 'Optimized(Planned)', 'OPTIMIZATION', '0', 'N', '0', '0', 'N', '120.0', '0', '0', '0', 'N', 'N'),
('28753', '1945520', 'QCAD54664', 'Individual Management', 'N001', 'Registered', '5', '5', '4', '5', '4', 'Y', '10', '2', '8', 'PO Module Tech', '87301', 'PLANNER', '30', '4', '4', '0', 'Optimized(Planned)', 'OPTIMIZATION', '0', 'N', '0', '0', 'N', '90.0', '0', '0', '0', 'N', 'N');

-- 3. Item Usage Summary
INSERT OR REPLACE INTO item_usage_summary (
    item, month_avg_usage_2y, month_avg_usage_1y, month_avg_usage_3m,
    last_month_issue_qty, this_month_issue_qty, once_avg_issue_qty,
    once_max_issue_qty, once_min_issue_qty
)
VALUES
('QCAB17587', '1', '2', '1', '0', '0', '2', '7', '1'),
('QDAE01694', '0', '0', '0', '0', '0', '0', '0', '0'),
('QCAD57452', '12', '15', '18', '5', '8', '4', '10', '2'),
('QCAC41921', '0', '1', '0', '0', '0', '0', '0', '0'),
('QCAD51163', '2.5', '3.0', '2.0', '3', '1', '1', '5', '1'),
('QCAD54664', '4.0', '5.2', '6.0', '4', '2', '2', '8', '1');

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
INSERT OR REPLACE INTO target_stock (
    organization_id, inventory_item_id, item, item_description, model, maker,
    target_qty, safety_qty, logic_qty, user_qty,
    optimized_logic_bm_qty, optimized_logic_qty, order_buf_day, due_days, full_lead_time, basis_days,
    target_apply_type_code, target_apply_type, one_time_user_qty, management_contact_name, manager, manager_id,
    purchase_requisition_qty, uom, item_cost, issue_flag, issue_qty, issue_count, parts_use_type_code,
    one_time_sp_status, org_code
) VALUES
(
    '28753', '3042180', 'QCAB17587',
    'Joint/Connector ** YTS-S-12-AL, YTS, Material:ALUMINUM, Length:163.5mm, Connection Method:, Remark:ROTARY JOINT(12PORTS), Application Tube Outside Diameter:, Spiral(Inch):',
    'YTS-S-12-AL', 'YTS', '4', '0', '4', '0',
    '4', '4', '20260731', '103', '90', '150',
    'OPTIMIZATION_NON_PERIOD', 'Optimized(Unplanned)', '13', '20260928_Nguyen Thi Hue', 'Nguyen Thi Hue', '613813',
    '13', 'EA', 2997.49, 'Y', '30', '19', 'N002',
    'Available', 'A13'
),
(
    '28753', '2271981', 'QCAD57452',
    'Vacuum Pad(except Robot) ** ZPT04USK6-04-A8, SMC CORPORATION, Shape:CIRCLE, Thickness:12mm, Material:SILICONE RUBBER',
    'ZPT04USK6-04-A8', 'SMC CORPORATION', '1', '0', '17', '0',
    '1', '1', '99999999', '0', '70', '150',
    'OPTIMIZATION_NON_PERIOD', 'Optimized(Unplanned)', '28', '20260922_Pham Duc Long', 'Pham Duc Long', '855123',
    '28', 'EA', 36.0, 'N', '0', '0', 'N001',
    'Available', 'A13'
);

-- 6. Item PO History
INSERT INTO item_po_history (organization_id, inventory_item_id, item, po_number, po_date, supplier, quantity, unit_price, status, requestor, department)
VALUES
('28753', '3042180', 'QCAB17587', 'PO-2026-9021', '2026-09-15', 'LGDVN_(주)와이티에스_KR017796', '13', '2985.55', 'APPROVED', 'Thi Ngoc Mai, Nguyen', 'NY PO M Technology CP/SG Part 1'),
('28753', '2271981', 'QCAD57452', 'PO-2026-4412', '2026-10-10', 'SMC CORPORATION', '28', '36.0', 'APPROVED', 'Pham Duc Long', 'PO Module Tech 2'),
('28753', '1934887', 'QCAD51163', 'PO-2026-3890', '2026-08-20', 'SMC CORPORATION', '5', '85.5', 'COMPLETED', 'Pham Duc Long', 'PO Module Tech 1');

-- 7. Common Codes (Extracted from t1.txt Index 21 and existing sets)
INSERT OR REPLACE INTO common_codes (group_code, com_code, com_code_desc, enabled_flag, data2_code, data3_code)
VALUES
-- Target Apply Type (from t1.txt ds_output0)
('retrieveTargetApplyType', 'OPTIMIZATION', 'Optimized(All)', 'Y', '', ''),
('retrieveTargetApplyType', 'OPTIMIZATION_NON_PERIOD', 'Optimized(Unplanned)', 'Y', '', ''),

-- Buy Item Type (from t1.txt ds_output1)
('retrieveBuyItemType', 'N001', 'Invidual Management', 'Y', '', ''),
('retrieveBuyItemType', 'N002', 'Total Management', 'Y', '', ''),
('retrieveBuyItemType', 'N004', 'Repair Parts Management', 'Y', '', ''),

-- Repair Category (from t1.txt ds_output2)
('retrieveRepairCategory', 'RT001', '자체 수리', 'Y', '1', ''),
('retrieveRepairCategory', 'RT002', '외주 수리', 'Y', '2', ''),

-- Organization IDs (from t1.txt ds_output3)
('retrieveOrganizationId', '101', 'A01(LG Display Korea Gumi Asset)', 'Y', 'A01', ''),
('retrieveOrganizationId', '132', 'A02(LG Display Korea Paju Asset)', 'Y', 'A02', ''),
('retrieveOrganizationId', '297', 'A03(LG Display Nanjing Asset)', 'Y', 'A03', ''),
('retrieveOrganizationId', '298', 'A04(LG Display Wroclaw Asset)', 'Y', 'A04', ''),
('retrieveOrganizationId', '299', 'A05(LG Display Guangzhou Asset)', 'Y', 'A05', ''),
('retrieveOrganizationId', '6254', 'A06(LG Display Yantai Asset)', 'Y', 'A06', ''),
('retrieveOrganizationId', '12705', 'A07(LG Display U.S.A Asset)', 'Y', 'A07', ''),
('retrieveOrganizationId', '12708', 'A08(LG Display Reynosa Asset)', 'Y', 'A08', ''),
('retrieveOrganizationId', '16812', 'A09(LG Display CA Asset)', 'Y', 'A09', ''),
('retrieveOrganizationId', '20312', 'A10(LG Display Yantai Asset(NY.Heesung))', 'Y', 'A10', ''),
('retrieveOrganizationId', '24853', 'A11(LG Display Korea Ochang Asset)', 'Y', 'A11', ''),
('retrieveOrganizationId', '28753', 'A13(LG Display Vietnam. Asset)', 'Y', 'A13', ''),
('retrieveOrganizationId', '32248', 'A14(LG Display CO Asset)', 'Y', 'A14', ''),
('retrieveOrganizationId', '58514', 'CA1(CSOT CA Asset)', 'Y', 'CA1', ''),
('retrieveOrganizationId', '58571', 'CA2(CSOT Guangzhou Asset)', 'Y', 'CA2', ''),

-- Legacy categories and statuses
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

-- 9. Translation Dictionary Seed Data (Dịch sang tiếng Anh cho đối tượng nhà cung cấp & thông số)
INSERT OR REPLACE INTO translations (domain, source_lang, target_lang, source_text, translated_text, description)
VALUES
('SUPPLIER', 'KO', 'EN', 'LGDVN_(주)와이티에스_KR017796', 'LGDVN YTS Co., Ltd. (KR017796)', 'Supplier YTS Vietnam'),
('SUPPLIER', 'KO', 'EN', 'LGDVN_(주) 서브원_KR017765', 'LGDVN Serveone Co., Ltd. (KR017765)', 'Supplier Serveone Vietnam'),
('BUY_ITEM_TYPE', 'KO', 'EN', '통합 관리', 'Total Management', 'Integrated parts management'),
('BUY_ITEM_TYPE', 'KO', 'EN', '개별 관리', 'Individual Management', 'Individual parts management'),
('PRICE_REG_STATUS', 'KO', 'EN', '단가 등록', 'Price Registered', 'Unit price registration status'),
('TARGET_APPLY_TYPE', 'KO', 'EN', '최적화(비계획)', 'Optimized (Unplanned)', 'Optimization application type'),
('TARGET_APPLY_TYPE', 'KO', 'EN', '최적화', 'Optimized (Planned)', 'Optimization application type'),
('TOOLTIP', 'KO', 'EN', '빨간색 : 구매 불가 Parts', 'Red: Non-purchasable Parts', 'Item tooltip meaning'),
('TOOLTIP', 'KO', 'EN', '고월령, 장기미사용 등을 고려하여 이관 가능하다고 판단되는 재고', 'Candidate for transfer (aged / long-term unused inventory)', 'Inventory tooltip meaning'),
('PO_TYPE', 'KO', 'EN', '원 법인 구매', 'Original Entity Purchase', 'Purchase order ownership');

