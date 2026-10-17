const express = require('express');
const cors = require('cors');
const db = require('./db/database');
const { parseNexacroXml } = require('./utils/nexacro-parser');
const { buildNexacroResponse } = require('./utils/nexacro-builder');

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
      const datasets = dispatcher(parsed);

      const xml = buildNexacroResponse({
        errorCode: 1,
        errorMsg: '',
        parameters: parsed.parameters || {},
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
// 8 Core Business Data Retrieval Endpoints (Connected to SQLite)
// ==============================================================

// 1. Stock Status (Tồn kho phụ tùng)
app.post('/emsspareparts/sp101/sp110Nav/RetStockStatusList.lgdn', nexacroHandler((req) => {
  const itemFilters = (req.datasets.ds_ItemInfo || []).map(r => r.item).filter(Boolean);
  let sql = `
    SELECT 
      i.item as itemName, inv.organization_id as organizationId, inv.inventory_item_id as inventoryItemId,
      i.description as itemDescription, i.item_status as itemStatus, i.uom_code as uomCode, i.maker,
      i.catalog_group_name as catalogGroupName, i.item_spec as itemSpec, i.model,
      inv.onhand_quantity as onhandQuantity, inv.allocated_quantity as allocatedQuantity, inv.available_quantity as availableQuantity,
      inv.planner_code as plannerCode, i.unit_price_new as unitPriceNew, i.unit_price_reb as unitPriceReb,
      inv.stock_department as stockDepartment, inv.inventory_department_code as inventoryDepartmentCode, i.item_type_name as itemTypeName
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

// 3. Item Detail Info (Chi tiết kỹ thuật & định mức kho)
app.post('/emsspareparts/sp102/sp135Nav/retrieveItemInfoDetail.lgdn', nexacroHandler((req) => {
  const invItemId = req.datasets.ds_Input?.[0]?.inventoryItemId;
  let item = null;
  if (invItemId) {
    item = db.get('SELECT i.*, inv.onhand_quantity, inv.allocated_quantity, inv.available_quantity FROM items i JOIN inventory inv ON i.item = inv.item WHERE inv.inventory_item_id = ?', [invItemId]);
  }
  if (!item) {
    item = db.get('SELECT i.*, inv.onhand_quantity, inv.allocated_quantity, inv.available_quantity FROM items i LEFT JOIN inventory inv ON i.item = inv.item LIMIT 1');
  }

  const dsItem = item ? [{
    item: item.item, description: item.description, uomCode: item.uom_code, maker: item.maker,
    catalogGroup: item.catalog_group, makerPart: item.maker_part || item.model,
    onhandQuantity: String(item.onhand_quantity || '0'), allocatedQuantity: String(item.allocated_quantity || '0'),
    availableQuantity: String(item.available_quantity || '0'), vendorName: item.maker,
    unitPricePo: String(item.unit_price_po || '0'), itemStatus: item.item_status || 'Active'
  }] : [];

  const inv = db.get('SELECT * FROM inventory WHERE item = ?', [item ? item.item : '']);
  const dsInv = inv ? [{
    buyItemType: inv.buy_item_type, priceRegStatus: inv.price_reg_status, reviewQty: inv.review_qty,
    targetQty: inv.target_qty, logicQty: inv.logic_qty, userQty: inv.user_qty, safetyStockQty: inv.safety_stock_qty,
    userFlag: inv.user_flag, onhandQty: inv.onhand_quantity, fullLeadTimeNew: inv.full_lead_time_new,
    optimizedLogicBmQty: inv.optimized_logic_bm_qty, optimizedLogicQty: inv.optimized_logic_qty,
    oneTimeUserQty: inv.one_time_user_qty, targetApplyType: inv.target_apply_type
  }] : [];

  const sum = db.get('SELECT * FROM item_usage_summary WHERE item = ?', [item ? item.item : '']);
  const dsSummary = sum ? [{
    monthAvgUsage2y: sum.month_avg_usage_2y, monthAvgUsage1y: sum.month_avg_usage_1y, monthAvgUsage3m: sum.month_avg_usage_3m,
    lastMonthIssueQty: sum.last_month_issue_qty, thisMonthIssueQty: sum.this_month_issue_qty, onceAvgIssueQty: sum.once_avg_issue_qty
  }] : [];

  return { ds_Item: dsItem, ds_Inv: dsInv, ds_Summary: dsSummary };
}));

// 4. Target Stock Optimization (93 fields)
app.post('/emsspareparts/sp302/sp335Nav/TargetStockSearchList.lgdn', nexacroHandler((req) => {
  const itemFilters = (req.datasets.ds_ItemInfo || []).map(r => r.item).filter(Boolean);
  let sql = 'SELECT * FROM target_stock WHERE 1=1';
  const params = [];
  if (itemFilters.length > 0) {
    sql += ` AND item IN (${itemFilters.map(() => '?').join(',')})`;
    params.push(...itemFilters);
  }
  const rows = db.query(sql, params);
  const dsStock = rows.map(r => ({
    spRmi: '', sprRmi: '', insertFlag: 'N', item: r.item, itemDescription: r.item_description,
    model: r.model, maker: r.maker, targetQty: r.target_qty, safetyQty: r.safety_qty, logicQty: r.logic_qty,
    userQty: r.user_qty, optimizedLogicBmQty: r.optimized_logic_bm_qty, optimizedLogicQty: r.optimized_logic_qty,
    orderBufDay: r.order_buf_day, dueDays: r.due_days, fullLeadTime: r.full_lead_time,
    targetApplyTypeCode: r.target_apply_type_code, targetApplyType: r.target_apply_type,
    oneTimeUserQty: r.one_time_user_qty, managementContactName: r.management_contact_name,
    purchaseRequisitionQty: r.purchase_requisition_qty
  }));
  return { ds_StockInfomation: dsStock };
}));

// 5. Item Search Popup
app.post('/emscom/popupNav/retrieveItem.lgdn', nexacroHandler((req) => {
  const s = req.datasets.ds_Search?.[0] || {};
  let sql = 'SELECT item, description, model, maker, catalog_group as catalogGroup, uom_code as uomCode FROM items WHERE 1=1';
  const params = [];
  if (s.item) { sql += ' AND item LIKE ?'; params.push(`%${s.item}%`); }
  if (s.description) { sql += ' AND description LIKE ?'; params.push(`%${s.description}%`); }
  if (s.maker) { sql += ' AND maker LIKE ?'; params.push(`%${s.maker}%`); }
  const rows = db.query(sql, params);
  return { ds_List: rows };
}));

// 6. Item PO History Popup
app.post('/emscom/popupNav/retrieveItemPoStatusList.lgdn', nexacroHandler((req) => {
  const s = req.datasets.ds_Search?.[0] || {};
  let sql = 'SELECT po_number as poNumber, po_date as poDate, supplier, item, quantity, unit_price as unitPrice, status, requestor, department FROM item_po_history WHERE 1=1';
  const params = [];
  if (s.item) { sql += ' AND item = ?'; params.push(s.item); }
  else if (s.inventoryItemId) { sql += ' AND inventory_item_id = ?'; params.push(s.inventoryItemId); }
  const rows = db.query(sql, params);
  return { ds_Rtn: rows };
}));

// 7. Common Code Dictionary
app.post('/emscom/codeNav/retComCodeList.lgdn', nexacroHandler((req) => {
  const stmt = req.parameters.statementName || 'retrieveItemType:';
  const stmts = stmt.split(':').map(s => s.trim()).filter(Boolean);
  const datasets = {};
  stmts.forEach((s, idx) => {
    const rows = db.query('SELECT com_code as comCode, com_code_desc as comCodeDesc, enabled_flag as enabledFlag, data2_code as data2Code, data3_code as data3Code FROM common_codes WHERE group_code = ?', [s]);
    datasets[`ds_output${idx}`] = rows;
  });
  return datasets;
}));

// 8. Factory List
app.post('/emswonew/wn90/wn900Nav/retFactoryList.lgdn', nexacroHandler(() => {
  const rows = db.query('SELECT com_code as comCode, com_code_desc as comCodeDesc, description, factory_type as factoryType, city, area_code as areaCode, organization_id as organizationId, seq_no as seqNo FROM factories ORDER BY seq_no ASC');
  return { ds_cbo_factory: rows };
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ONLINE', service: 'LG Display EMS Core Data Mock Server', port: PORT });
});

app.listen(PORT, () => {
  console.log(`[EMS Mock Server] Listening on http://localhost:${PORT}`);
  console.log(`[EMS Mock Server] 8 Core Data APIs Active, Database: db/ems.db`);
});
