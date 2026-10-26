const express = require('express');
const cors = require('cors');
const db = require('./db/database');
const { parseNexacroXml } = require('./utils/nexacro-parser');
const { buildNexacroResponse } = require('./utils/nexacro-builder');
const catalog = require('./utils/analyzed-catalog');

const app = express();
const PORT = process.env.PORT || 9000;

app.use(cors());
app.use(express.text({ type: ['*/xml', 'text/*', 'application/xml', 'application/octet-stream'], limit: '10mb' }));
app.use(express.json());

// Helper middleware for Nexacro endpoints
function nexacroHandler(dispatcher) {
  return (req, res) => {
    try {
      const raw = typeof req.body === 'string' ? req.body : '';
      const parsed = parseNexacroXml(raw);
      const resData = dispatcher(parsed, req);

      let datasets = resData;
      let parameters = parsed.parameters || {};

      if (resData && (resData.datasets !== undefined || resData.parameters !== undefined)) {
        datasets = resData.datasets || {};
        parameters = { ...parameters, ...(resData.parameters || {}) };
      }

      const xml = buildNexacroResponse({
        errorCode: 1,
        errorMsg: '',
        parameters: parameters,
        datasets: datasets || {}
      });

      res.setHeader('Content-Type', 'text/xml; charset=UTF-8');
      res.status(200).send(xml);
    } catch (e) {
      console.error(`[Error ${req.path}]`, e.message);
      const errXml = buildNexacroResponse({ errorCode: -1, errorMsg: e.message });
      res.setHeader('Content-Type', 'text/xml; charset=UTF-8');
      res.status(200).send(errXml);
    }
  };
}

// ==============================================================
// Core Business Data Retrieval Endpoints (Connected to SQLite)
// Calibrated from Real Production Capture Traces (t1.txt)
// ==============================================================

// 1. Stock Status (Tồn kho phụ tùng - RetStockStatusList.lgdn)
app.post('/emsspareparts/sp101/sp110Nav/RetStockStatusList.lgdn', nexacroHandler((req) => {
  const itemFilters = (req.datasets.ds_ItemInfo || []).map(r => r.item).filter(Boolean);
  let sql = `
    SELECT 
      i.item as itemName, 
      COALESCE(inv.organization_id, '28753') as organizationId, 
      COALESCE(inv.inventory_item_id, '3042180') as inventoryItemId,
      i.description as itemDescription, 
      COALESCE(i.item_status, 'Active') as itemStatus, 
      COALESCE(i.uom_code, 'EA') as uomCode, 
      i.maker,
      COALESCE(i.catalog_group_name, i.catalog_group) as catalogGroupName, 
      COALESCE(i.item_spec, i.description) as itemSpec, 
      i.model,
      COALESCE(i.supplier_id, '863437') as supplierId,
      COALESCE(i.supplier_name, 'LGDVN_(주)와이티에스_KR017796') as supplierName,
      COALESCE(inv.user_qty, '0') as tqUserQty,
      COALESCE(inv.safety_stock_qty, '0') as tqSafetyStockQty,
      COALESCE(inv.user_flag, 'N') as tqUserFlag,
      COALESCE(inv.disuse_flag, 'N') as disuseFlag,
      'Y' as publicFlag,
      'N' as periodicFlag,
      COALESCE(inv.inventory_department_code, '84788') as inventoryDepartmentCode,
      COALESCE(inv.stock_department, 'NY PO M Technology CP/SG Part 1') as stockDepartment,
      COALESCE(i.item_type_name, 'Total Management') as itemTypeName,
      COALESCE(inv.onhand_quantity, '0') as onhandQuantity, 
      COALESCE(inv.allocated_quantity, '0') as allocatedQuantity, 
      COALESCE(inv.available_quantity, '0') as availableQuantity,
      COALESCE(inv.planner_code, 'SP_UP_VH') as plannerCode, 
      CAST(COALESCE(i.unit_price_new, 0) AS TEXT) as unitPriceNew, 
      CAST(COALESCE(i.unit_price_reb, 0) AS TEXT) as unitPriceReb,
      CAST(COALESCE(i.unit_price_unl, 0) AS TEXT) as unitPriceUnl,
      COALESCE(i.fdm_url, '') as fdmUrl,
      COALESCE(i.fdm_flag, 'Y') as fdmFlag,
      COALESCE(i.timely_purchase_date, '20260731') as timelyPurchaseDate,
      COALESCE(inv.repair_request_qty, '0') as repairRequestQty,
      COALESCE(inv.wait_repair_qty, '0') as waitRepairQty,
      '빨간색 : 구매 불가 Parts' as itemToolTipText,
      '고월령, 장기미사용 등을 고려하여 이관 가능하다고 판단되는 재고' as invToolTipText,
      COALESCE(inv.red_flag, 'N') as redFlag,
      COALESCE(inv.available_transfer_qty_all, '0') as availableTransferQtyAll,
      COALESCE(inv.po_opt_target, 'N') as poOptTarget
    FROM items i LEFT JOIN inventory inv ON i.item = inv.item WHERE 1=1
  `;
  const params = [];
  if (itemFilters.length > 0) {
    sql += ` AND i.item IN (${itemFilters.map(() => '?').join(',')})`;
    params.push(...itemFilters);
  }
  const rows = db.query(sql, params);
  return { ds_result: rows };
}));

// 2. Estimate Requests (Báo giá RFQ)
app.post('/emsspareparts/sp101/sp120Nav/RetEstimateRequestList.lgdn', nexacroHandler((req) => {
  const itemFilters = (req.datasets.ds_ItemInfo || []).map(r => r.item).filter(Boolean);
  let sql = 'SELECT * FROM estimate_requests WHERE 1=1';
  const params = [];
  if (itemFilters.length > 0) {
    sql += ` AND item IN (${itemFilters.map(() => '?').join(',')})`;
    params.push(...itemFilters);
  }
  const rows = db.query(sql, params);
  const dsList = rows.map(r => ({
    checked: '0', prvNo: r.prv_no, filePrvNo: r.file_prv_no, estimateRequestDate: r.estimate_request_date,
    contact: r.contact, factory: r.factory, emNo: r.em_no, emNoDesc: r.em_no_desc, budgetDept: r.budget_dept,
    budgetDepartmentCode: r.budget_department_code, workOrder: r.work_order, woType: r.wo_type,
    requestComment: r.request_comment, item: r.item, itemDescription: r.item_description, supplier: r.supplier,
    requestQty: r.request_qty, estimateStatus: r.estimate_status, estimateCost: r.estimate_cost,
    prNo: r.pr_no, poNo: r.po_no
  }));
  return { ds_list: dsList };
}));

// 3. Item Detail Info (Chi tiết kỹ thuật & định mức kho - retrieveItemInfoDetail.lgdn)
app.post('/emsspareparts/sp102/sp135Nav/retrieveItemInfoDetail.lgdn', nexacroHandler((req) => {
  const invItemId = req.datasets.ds_Input?.[0]?.inventoryItemId;
  let item = null;
  if (invItemId) {
    item = db.get('SELECT i.*, inv.onhand_quantity, inv.allocated_quantity, inv.available_quantity, inv.inventory_item_id, inv.organization_id FROM items i JOIN inventory inv ON i.item = inv.item WHERE inv.inventory_item_id = ?', [invItemId]);
  }
  if (!item) {
    item = db.get('SELECT i.*, inv.onhand_quantity, inv.allocated_quantity, inv.available_quantity, inv.inventory_item_id, inv.organization_id FROM items i LEFT JOIN inventory inv ON i.item = inv.item LIMIT 1');
  }

  const dsItem = item ? [{
    item: item.item,
    description: item.description,
    uomCode: item.uom_code || 'EA',
    maker: item.maker || '',
    catalogGroup: item.catalog_group || '',
    makerPart: item.maker_part || item.model || '',
    onhandQuantity: String(item.onhand_quantity || '0'),
    allocatedQuantity: String(item.allocated_quantity || '0'),
    availableQuantity: String(item.available_quantity || '0'),
    vendorName: item.supplier_name || item.maker || '',
    unitPricePo: String(item.unit_price_po || '0'),
    unitPriceSp: String(item.unit_price_new || '0'),
    unitPriceSpr: String(item.unit_price_reb || '0'),
    itemStatus: item.item_status || 'Active',
    fdmUrl: item.fdm_url || '',
    stopPo: '',
    stopPoDesc: '',
    stopPoRequestor: '',
    implementedDate: '20220630153906000',
    alterItem: '',
    minOrderQty: '',
    waitRepairQty: '0'
  }] : [];

  const inv = db.get('SELECT * FROM inventory WHERE item = ?', [item ? item.item : '']);
  const dsInv = inv ? [{
    buyItemType: inv.buy_item_type || '통합 관리',
    priceRegStatus: inv.price_reg_status || '단가 등록',
    reviewQty: inv.review_qty || '',
    targetQty: String(inv.target_qty || '4'),
    logicQty: String(inv.logic_qty || '4'),
    userQty: String(inv.user_qty || '0'),
    safetyStockQty: String(inv.safety_stock_qty || '0'),
    userFlag: inv.user_flag || 'N',
    requestQty: '',
    poWaitingQty: '0',
    notReceivingQty: String(inv.not_receiving_qty || '13'),
    overFlag: inv.over_flag || 'Y',
    overQty: String(inv.over_qty || '9'),
    onhandQty: String(inv.onhand_quantity || '0'),
    otherSiteOnHandQty: String(inv.other_site_onhand_qty || '4'),
    disuseFlag: inv.disuse_flag || 'N',
    mtbfDay: String(inv.mtbf_day || '36.4'),
    fullLeadTimeNew: String(inv.full_lead_time_new || '90'),
    optimizedLogicBmQty: String(inv.optimized_logic_bm_qty || '4'),
    optimizedLogicQty: String(inv.optimized_logic_qty || '4'),
    oneTimeUserQty: String(inv.one_time_user_qty || '13'),
    oneTimeTeamCode: '',
    oneTimeTeam: '',
    targetApplyTypeCode: inv.target_apply_type_code || 'OPTIMIZATION_NON_PERIOD',
    targetApplyType: inv.target_apply_type || '최적화(비계획)',
    type: 'Current',
    requestDate: '2026-10-21 15:40',
    userCheckFlag: 'N',
    repairTransferFlag: '',
    oneTimeSpStatus: 'Available',
    repairRequestQty: String(inv.repair_request_qty || '0'),
    oneTimeSprStatus: '',
    holdReasonContent: ''
  }] : [];

  const sum = db.get('SELECT * FROM item_usage_summary WHERE item = ?', [item ? item.item : '']);
  const dsSummary = sum ? [{
    monthAvgUsage2y: String(sum.month_avg_usage_2y || '1'),
    monthAvgUsage1y: String(sum.month_avg_usage_1y || '2'),
    monthAvgUsage3m: String(sum.month_avg_usage_3m || '1'),
    lastMonthIssueQty: String(sum.last_month_issue_qty || '0'),
    thisMonthIssueQty: String(sum.this_month_issue_qty || '0'),
    onceAvgIssueQty: String(sum.once_avg_issue_qty || '2'),
    onceMaxIssueQty: String(sum.once_max_issue_qty || '7'),
    onceMinIssueQty: String(sum.once_min_issue_qty || '1')
  }] : [];

  return { ds_Item: dsItem, ds_Inv: dsInv, ds_Summary: dsSummary };
}));

// 4. Target Stock Optimization Search (Supports both sp330Nav and sp335Nav endpoints from t1.txt)
const targetStockHandler = nexacroHandler((req) => {
  const itemFilters = (req.datasets.ds_ItemInfo || []).map(r => r.item).filter(Boolean);
  let sql = 'SELECT * FROM target_stock WHERE 1=1';
  const params = [];
  if (itemFilters.length > 0) {
    sql += ` AND item IN (${itemFilters.map(() => '?').join(',')})`;
    params.push(...itemFilters);
  }
  const rows = db.query(sql, params);
  const dsStock = rows.map(r => ({
    spRmi: '',
    sprRmi: '',
    spUrl: '',
    sprUrl: '',
    insertFlag: 'N',
    item: r.item,
    itemDescription: r.item_description,
    model: r.model,
    maker: r.maker,
    issueTeam: '0',
    itemCost: String(r.item_cost || '2997.49'),
    issueFlag: r.issue_flag || 'Y',
    issueQty: String(r.issue_qty || '30'),
    issueCount: String(r.issue_count || '19'),
    onhandQty: '',
    targetQty: String(r.target_qty || '4'),
    optimizedLogicBmQty: String(r.optimized_logic_bm_qty || '4'),
    optimizedLogicQty: String(r.optimized_logic_qty || '4'),
    optimizedLogicRpBmQty: '1',
    optimizedLogicRpQty: '1',
    orderBufDay: r.order_buf_day || '20260731',
    orderBufBmDay: '20260731',
    orderBufRpDay: '99999999',
    orderBufRpBmDay: '20260731',
    logicQty: String(r.logic_qty || '4'),
    userQty: String(r.user_qty || '0'),
    userQtyOrg: '0',
    targetApplyTypeCode: r.target_apply_type_code || 'OPTIMIZATION_NON_PERIOD',
    targetApplyType: r.target_apply_type || 'Optimized(Unplanned)',
    oneTimeUserQty: String(r.one_time_user_qty || '13'),
    oneTimeUserQtyOrg: String(r.one_time_user_qty || '13'),
    oneTimeTeamCode: '',
    oneTimeTeam: '',
    disuseFlag: 'N',
    disuseSprFlag: '',
    minOrderQty: '',
    manager: r.manager || 'Nguyen Thi Hue',
    publicFlag: 'Y',
    firstAssignFlag: 'Y',
    periodicFlag: 'N',
    changeComment: '',
    managerId: r.manager_id || '613813',
    fullLeadTime: String(r.full_lead_time || '90'),
    basisDays: String(r.basis_days || '150'),
    registFlag: 'N',
    registDate: '20220630153907000',
    uom: r.uom || 'EA',
    amount: '',
    fullLeadTimeFlag: 'Y',
    itemStatus: 'Active',
    creationDate: '20220630160047000',
    lastUpdateDate: '20260928154201000',
    lastUpdatedBy: r.manager || 'Nguyen Thi Hue',
    organizationId: r.organization_id || '28753',
    inventoryItemId: r.inventory_item_id || '3042180',
    safetryStockQty: '0',
    userFlag: 'N',
    userFlagOrg: 'N',
    managementContactName: r.management_contact_name || '20260928_Nguyen Thi Hue',
    chk: '',
    privFlag: 'N',
    optimizeFlag: 'Y',
    safetyQty: String(r.safety_qty || '0'),
    safetyQtyOrg: '0',
    userCheckFlag: 'N',
    requestorName: '',
    partsUseTypeCode: r.parts_use_type_code || 'N002',
    purchaseRequisitionQty: String(r.purchase_requisition_qty || '13'),
    oneTimeSpStatus: r.one_time_sp_status || 'Available',
    repairRequestQtyOrg: '',
    repairRequestQty: '',
    oneTimeSprStatus: '',
    repairTransferFlag: '',
    dueDays: String(r.due_days || '103'),
    dueBasisDays: '0',
    interlockFlag: '',
    targetDept: '',
    targetDeptDesc: '',
    outputQuantity: '',
    alarmBasisQty: '',
    alarmFlag: '',
    minFlag: '',
    userEnteredFlag: 'N',
    bufferStockFlag: '',
    holdReasonContent: '',
    repairTypeShortName: '',
    inventoryQty: '',
    orgCode: r.org_code || 'A13',
    excludeFlag: '',
    exceptionTypeName: '',
    exceptionFlag: '',
    exceptionReasonDesc: ''
  }));
  return { ds_StockInfomation: dsStock };
});

app.post('/emsspareparts/sp302/sp330Nav/TargetStockSearchList.lgdn', targetStockHandler);
app.post('/emsspareparts/sp302/sp335Nav/TargetStockSearchList.lgdn', targetStockHandler);

// 5. Target Stock Optimization Info (GetOptimizeInfo.lgdn - trace 16 in t1.txt)
app.post('/emsspareparts/sp302/sp330Nav/GetOptimizeInfo.lgdn', nexacroHandler((req) => {
  return {
    ds_rtn: [
      { optimizeFlag: 'Y', optimizedApplyDate: '20210316' }
    ]
  };
}));

// 6. Item Search Popup (retrieveItem.lgdn - trace 5 in t1.txt)
app.post('/emscom/popupNav/retrieveItem.lgdn', nexacroHandler((req) => {
  const s = req.datasets.ds_Search?.[0] || {};
  let sql = `
    SELECT 
      i.item, i.description as itemDescription, i.model as modelName, i.maker as makerName, 
      i.catalog_group as catalogGroup, i.uom_code as primaryUomCode,
      i.unit_price_po as itemCost, i.buyer_name as buyerName, i.buyer_id as buyerId,
      i.item_status as itemStatus, i.item_spec as specification,
      i.po_type as poType, i.po_type_code as poTypeCode,
      i.item_category_code as itemCategoryCode, i.item_category_desc as itemCategoryDesc,
      i.item_catalog_group_id as itemCatalogGroupId,
      i.fdm_url as fdmUrl, i.fdm_flag as fdmFlag,
      i.timely_purchase_date as timelyPurchaseDate,
      inv.organization_id as organizationId, inv.inventory_item_id as inventoryItemId,
      inv.buy_item_type as buyItemType, inv.buy_item_type_code as buyItemTypeCode,
      inv.onhand_quantity as onhandQuantity, inv.available_quantity as availableQuantity,
      inv.not_receiving_qty as notReceivingQty, inv.wait_repair_qty as waitRepairQty,
      inv.available_transfer_qty_all as availableTransferQtyAll
    FROM items i LEFT JOIN inventory inv ON i.item = inv.item WHERE 1=1
  `;
  const params = [];
  if (s.item) { sql += ' AND i.item LIKE ?'; params.push(`%${s.item}%`); }
  if (s.itemDescription) { sql += ' AND i.description LIKE ?'; params.push(`%${s.itemDescription}%`); }
  if (s.maker) { sql += ' AND i.maker LIKE ?'; params.push(`%${s.maker}%`); }
  const rows = db.query(sql, params);
  
  const dsList = rows.map((r, idx) => ({
    uniqueNo: String(idx + 1).padStart(3, '0'),
    itemType: 'SP',
    item: r.item,
    itemDescription: r.itemDescription,
    primaryUomCode: r.primaryUomCode || 'EA',
    itemCost: String(r.itemCost || '2985.55'),
    buyerName: r.buyerName || 'Thi Ngoc Mai, Nguyen',
    itemStatus: r.itemStatus || 'Active',
    catalogGroup: r.catalogGroup || 'Q4.Joint/Connector',
    specification: r.specification || r.itemDescription,
    unificationFlag: 'N',
    poOwnership: 'LGD',
    rebSnFlag: 'N',
    buyItemType: r.buyItemType || '통합 관리',
    buyItemTypeCode: r.buyItemTypeCode || 'N002',
    inventoryItemId: String(r.inventoryItemId || '3042180'),
    organizationId: String(r.organizationId || '28753'),
    buyerId: String(r.buyerId || '877778'),
    onhandQuantity: String(r.onhandQuantity || '0'),
    availableQuantity: String(r.availableQuantity || '0'),
    commonFlag: 'Y',
    chkFlag: '',
    timelyPurchaseDate: r.timelyPurchaseDate || '20260731',
    onhandQty: String(r.onhandQuantity || '0'),
    poWaitingQty: '0',
    waitRepairQty: String(r.waitRepairQty || '0'),
    availableTransferQtyAll: String(r.availableTransferQtyAll || '0'),
    poInterlockFlag: 'N',
    notReceivingQty: String(r.notReceivingQty || '13'),
    poOptTargetFlag: 'N',
    orgMaskCnt: '0',
    waitRepairFlag: 'N',
    qltyMgtTargetFlag: 'N',
    poType: r.poType || '원 법인 구매',
    poTypeCode: r.poTypeCode || 'PT003',
    itemCategoryCode: r.itemCategoryCode || 'QCAB1301',
    itemCategoryDesc: r.itemCategoryDesc || 'Q4.Joint/Connector',
    itemCatalogGroupId: String(r.itemCatalogGroupId || '504'),
    modelName: r.modelName || '',
    makerName: r.makerName || '',
    fdmUrl: r.fdmUrl || '',
    fdmFlag: r.fdmFlag || 'Y'
  }));

  return { ds_List: dsList };
}));

// 7. Item PO History Popup
app.post('/emscom/popupNav/retrieveItemPoStatusList.lgdn', nexacroHandler((req) => {
  const s = req.datasets.ds_Search?.[0] || {};
  let sql = 'SELECT po_number as poNumber, po_date as poDate, supplier, item, quantity, unit_price as unitPrice, status, requestor, department FROM item_po_history WHERE 1=1';
  const params = [];
  if (s.item) { sql += ' AND item = ?'; params.push(s.item); }
  else if (s.inventoryItemId) { sql += ' AND inventory_item_id = ?'; params.push(s.inventoryItemId); }
  const rows = db.query(sql, params);
  return { ds_Rtn: rows };
}));

// 8. Common Code Dictionary (retComCodeList.lgdn - trace 21 in t1.txt)
app.post('/emscom/codeNav/retComCodeList.lgdn', nexacroHandler((req) => {
  const stmt = req.parameters.statementName || 'retrieveTargetApplyType:retrieveBuyItemType:retrieveRepairCategory:retrieveOrganizationId:';
  const stmts = stmt.split(':').map(s => s.trim()).filter(Boolean);
  const datasets = {};
  stmts.forEach((s, idx) => {
    let rows = [];
    if (s === 'retrieveOrganizationId') {
      rows = [
        { comCode: '', comCodeDesc: '-Select-', orgCode: '' },
        ...db.query('SELECT com_code as comCode, com_code_desc as comCodeDesc, data2_code as orgCode FROM common_codes WHERE group_code = ?', [s])
      ];
    } else {
      rows = [
        { comCode: '', comCodeDesc: '-Select-', data2Code: '', data3Code: '' },
        ...db.query('SELECT com_code as comCode, com_code_desc as comCodeDesc, enabled_flag as enabledFlag, data2_code as data2Code, data3_code as data3Code FROM common_codes WHERE group_code = ?', [s])
      ];
    }
    datasets[`ds_output${idx}`] = rows;
  });

  // Include translations from database table
  try {
    const transRows = db.query('SELECT domain, source_text as sourceText, translated_text as translatedText FROM translations');
    datasets['ds_translations'] = transRows;
  } catch (e) {}

  return datasets;
}));

// Dedicated translations endpoint
app.post('/emscom/codeNav/retTranslations.lgdn', nexacroHandler(() => {
  const transRows = db.query('SELECT domain, source_text as sourceText, translated_text as translatedText FROM translations');
  return { ds_translations: transRows };
}));

// 9. Factory List
app.post('/emswonew/wn90/wn900Nav/retFactoryList.lgdn', nexacroHandler(() => {
  const rows = db.query('SELECT com_code as comCode, com_code_desc as comCodeDesc, description, factory_type as factoryType, city, area_code as areaCode, organization_id as organizationId, seq_no as seqNo FROM factories ORDER BY seq_no ASC');
  return { ds_cbo_factory: rows };
}));

// ==============================================================
// Additional Business & Operational Endpoints Calibrated from A1.txt / ems-api-analyzer
// ==============================================================

// 10. Purchase Request Creation (MUTATE - CreInsertItemPrvRequest.lgdn)
app.post('/emsspareparts/sp101/sp110Nav/CreInsertItemPrvRequest.lgdn', nexacroHandler((req) => {
  const s = req.datasets.ds_search?.[0] || {};
  const txnGroupId = s.txnGroupId || String(Date.now());
  const inventoryItemId = s.inventoryItemId || '3890752';
  const orgId = s.organizationId || '28753';
  const prvType = s.prvType || 'NEW';
  const userId = s.userId || '658359';
  const prvNo = s.prvNo || `Q2610-${Math.floor(1000000 + Math.random() * 9000000)}`;

  try {
    db.run(
      'INSERT INTO prv_requests (txn_group_id, inventory_item_id, organization_id, prv_type, prv_no, user_id, status, err_code, err_msg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [txnGroupId, inventoryItemId, orgId, prvType, prvNo, userId, 'OK', '0', '']
    );
  } catch (e) {
    console.warn('[CreInsertItemPrvRequest] Note:', e.message);
  }

  return {
    ds_list: [
      { result: 'OK', errCode: '0', errMsg: '' }
    ]
  };
}));

// 11. Repair Interlock Check (retWaitRepairItemInterlock.lgdn)
app.post('/emsspareparts/sp102/sp131Nav/retWaitRepairItemInterlock.lgdn', nexacroHandler(() => {
  return { ds_result: [{ applyFlag: 'N' }] };
}));

// 12. Engineering Change Flag (retEcFlag.lgdn)
app.post('/emsspareparts/sp102/sp137Nav/retEcFlag.lgdn', nexacroHandler(() => {
  return { ds_ec: [{ ecCode: 'EC001', ecCodeDesc: 'EC 대상' }] };
}));

// 13. Work Order Save Init (WO230WoSaveInit.lgdn)
app.post('/emsworkorder/wo20/wo230Nav/WO230WoSaveInit.lgdn', nexacroHandler((req) => {
  const info = req.datasets.ds_info?.[0] || {};
  const wipId = info.wipEntityId || '314805734';
  const wo = db.get('SELECT * FROM work_orders WHERE wip_entity_id = ?', [wipId]) || {
    wip_entity_id: wipId, organization_id: '28753', asset_number: 'M1412-4844558', instance_number: 'HWBMTL21BP0101'
  };

  return {
    ds_init: [{ safetyFlag: 'N', emrgIssueFlag: 'N', useAllocationFlag: 'N', useQCodeFlag: 'Y', checkMessage: '', activityTotManCnt: '', wipEntityId: wo.wip_entity_id, organizationId: wo.organization_id }],
    ds_oplist: [{ operationSeqNum: '10', wipEntityId: wo.wip_entity_id, organizationId: wo.organization_id, standardOperationId: '', standardOperationCode: '', departmentId: '1201617', departmentCode: '87254', description: 'Operation 10' }],
    ds_mtlist: [{ wipEntityId: wo.wip_entity_id, organizationId: wo.organization_id, operationSeqNum: '10', operationDesc: '', opDept: '87254', itemType: '1', inventoryItemId: '3772493', directItemSeqId: '', itemName: 'QCAC23840', itemDesc: 'Needle Valve ** MARCO SYSTEMANALYSE', quantity: '0', uom: 'EA', onHandQty: '20', availableQty: '20', commonFlag: 'Y' }],
    ds_poChangeFlag: [{ poChangeFlag: 'N' }],
    ds_poInfoFlag: [{ poInfoFlag: 'N' }],
    ds_spAttachFile: [{ attachFileCnt: '0' }]
  };
}));

// 14. Work Order Status History (statusHistory.lgdn)
app.post('/emsworkorder/wo50/wo580Nav/statusHistory.lgdn', nexacroHandler((req) => {
  const info = req.datasets.ds_info?.[0] || {};
  const wipId = info.wipEntityId || '314805734';
  return {
    ds_list: [
      { wipEntityId: wipId, historyId: '139544072', organizationId: '28753', commentText: 'PR Return에 따른 WO 취소 처리', createdBy: '1102', creationDate: '20250915130713000' },
      { wipEntityId: wipId, historyId: '147566170', organizationId: '28753', commentText: 'WO Khởi tạo ban đầu', createdBy: 'VH081996', creationDate: '20250915110713000' }
    ],
    ds_input: [{ historyId: '147566170' }]
  };
}));

// 15. Purchase Request Items List (retrievePurchaseRequest.lgdn)
app.post('/emsspareparts/sp102/sp134Nav/retrievePurchaseRequest.lgdn', nexacroHandler(() => {
  const ep = catalog.getEndpoint('/emsspareparts/sp102/sp134Nav/retrievePurchaseRequest.lgdn');
  if (ep && ep.datasets && ep.datasets.ds_Item) {
    return { ds_Item: ep.datasets.ds_Item };
  }
  return { ds_Item: [] };
}));

// 16. Item Request Detail (retrieveItemRequestDetail.lgdn)
app.post('/emsspareparts/sp102/sp132Nav/retrieveItemRequestDetail.lgdn', nexacroHandler(() => {
  const ep = catalog.getEndpoint('/emsspareparts/sp102/sp132Nav/retrieveItemRequestDetail.lgdn');
  if (ep && ep.datasets && ep.datasets.ds_Item) {
    return { ds_Item: ep.datasets.ds_Item };
  }
  return { ds_Item: [] };
}));

// 17. Realtime Spareparts Status (retSparepartsStatus.lgdn)
app.post('/emsspareparts/sp201/sp220Nav/retSparepartsStatus.lgdn', nexacroHandler(() => {
  return {
    ds_RealtimeReviewreq: [{ recordCount: '3', amount: '2' }],
    ds_RealReviewreqConfirm: [{ recordCount: '0', amount: '0' }],
    ds_RealPRreq: [{ recordCount: '0', amount: '0' }],
    ds_RealPOStandby: [{ recordCount: '0', amount: '0' }],
    ds_RealSupplierUncheck: [{ recordCount: '0', amount: '0' }],
    ds_RealPORemainQty: [{ recordCount: '2', amount: '1' }],
    ds_CumDeliveryInfo: [{ recordCount: '0', amount: '0' }]
  };
}));

// 18. Approval Line & Request (retApprovalLine.lgdn & retApprovalRequest.lgdn)
app.post('/emscom/approvalNav/retApprovalLine.lgdn', nexacroHandler(() => {
  return {
    ds_requestActor: [{ actor: 'REQUESTOR', statusCode: '40', managerTypeRender: '' }],
    ds_approvalInsert: [],
    ds_approvalList: [
      { organizationId: '28753', requestMasterId: '18026951', approvalOrdinalSeq: '1st', approvalSeqNo: '1', systemCode: 'EMS', approverName: 'Pham Duc Long', approvalStatus: 'APPROVED' },
      { organizationId: '28753', requestMasterId: '18026951', approvalOrdinalSeq: '2nd', approvalSeqNo: '2', systemCode: 'EMS', approverName: 'Nguyen Thi Hue', approvalStatus: 'PENDING' }
    ],
    ds_copyToList: [],
    ds_inspectionList: [],
    ds_transferList: [],
    ds_settingReferenceAuto: []
  };
}));

app.post('/emscom/approvalNav/retApprovalRequest.lgdn', nexacroHandler(() => {
  return {
    ds_requestActor: [{ actor: 'REQUESTOR', statusCode: '40', managerTypeRender: '' }],
    ds_requestInformation: [{ requestMasterId: '18026951', requestCode: 'PRV', status: 'In-Progress' }]
  };
}));

// 19. Security, Auth, Logging & UI Grid Format
app.post('/emsspareparts/sp302/sp330Nav/CheckMasterAuth.lgdn', nexacroHandler(() => ({ ds_auth: [{ masterYn: 'N' }] })));
app.post('/emsspareparts/sp302/sp330Nav/GetSpPrivFlag.lgdn', nexacroHandler(() => ({ ds_result: [{ privFlag: 'N' }] })));
app.post('/emscom/authButtonNav/getAuthButton.lgdn', nexacroHandler(() => ({ ds_auth: [{ authSearch: 'Y', authSave: 'Y', authDelete: 'N', authPrint: 'Y' }] })));
app.post('/emscom/gridFormatNav/retrieveGridFormat.lgdn', nexacroHandler(() => ({ ds_list: [] })));
app.post('/emscom/connLogNav/insertStartLog.lgdn', nexacroHandler(() => ({})));
app.post('/emscom/connLogNav/updateEndLog.lgdn', nexacroHandler(() => ({})));
app.all('/Servlet/MenuPermit.document', nexacroHandler(() => ({})));

// ==============================================================
// Universal Dynamic Dispatcher for ALL 50 Analyzed Endpoints
// Automatically captures and responds with authentic Nexacro XML
// ==============================================================
app.all('*', (req, res, next) => {
  const pathname = req.path;
  if (!pathname.endsWith('.lgdn') && !pathname.endsWith('.document')) {
    return next();
  }

  const ep = catalog.getEndpoint(pathname);
  if (ep) {
    try {
      const raw = typeof req.body === 'string' ? req.body : '';
      const parsed = parseNexacroXml(raw);
      const params = { ...parsed.parameters, ...(ep.parameters || {}) };
      const xml = buildNexacroResponse({
        errorCode: 1,
        errorMsg: '',
        parameters: params,
        datasets: ep.datasets || {}
      });
      res.setHeader('Content-Type', 'text/xml; charset=UTF-8');
      return res.status(200).send(xml);
    } catch (e) {
      console.error(`[Catalog Dispatcher Error ${pathname}]`, e.message);
    }
  }

  // Generic fallback if unknown Nexacro endpoint requested
  const xml = buildNexacroResponse({ errorCode: 1, errorMsg: '', parameters: {}, datasets: {} });
  res.setHeader('Content-Type', 'text/xml; charset=UTF-8');
  return res.status(200).send(xml);
});

// ==============================================================
// Management REST APIs
// ==============================================================

// REST API for translations lookup
app.get('/api/translations', (req, res) => {
  try {
    const rows = db.query('SELECT * FROM translations');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// REST API for all 50 analyzed endpoints
app.get('/api/endpoints', (req, res) => {
  try {
    const all = catalog.getAllEndpoints();
    res.json({
      total: all.length,
      endpoints: all.map(e => ({
        id: e.id,
        path: e.path,
        action: e.action,
        category: e.category,
        programIds: e.programIds,
        totalCalls: e.totalCalls,
        datasets: Object.keys(e.datasets || {})
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/endpoints/:action', (req, res) => {
  const ep = catalog.getEndpoint(`action:${req.params.action}`);
  if (!ep) return res.status(404).json({ error: 'Endpoint not found in catalog' });
  res.json(ep);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const all = catalog.getAllEndpoints();
  const itemCount = db.get('SELECT count(*) as count FROM items')?.count || 0;
  const woCount = db.get('SELECT count(*) as count FROM work_orders')?.count || 0;
  res.json({
    status: 'ONLINE',
    service: 'LG Display EMS Core Data Mock Server (50 Endpoints Universal Engine)',
    port: PORT,
    analyzedEndpointsCount: all.length,
    database: {
      items: itemCount,
      workOrders: woCount
    }
  });
});

app.listen(PORT, () => {
  console.log(`[EMS Mock Server] Listening on http://localhost:${PORT}`);
  console.log(`[EMS Mock Server] Universal Nexacro Engine Active: 50/50 Endpoints Supported from ems-api-analyzer`);
});
