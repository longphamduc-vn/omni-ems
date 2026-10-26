#!/usr/bin/env python3
# Standalone LG Display EMS Mock Server (Python 3 zero-dependency)
# Serves core business data retrieval APIs against SQLite database (db/ems.db).
# Universal 50-Endpoint Engine synchronized with ems-api-analyzer

import os
import re
import json
import sqlite3
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PORT = int(os.environ.get("PORT", 9000))
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "ems.db")

CATALOG_CANDIDATES = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ems-api-analyzer", "data", "analyzed_apis.json"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "analyzed_apis.json"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "analyzed_apis.json")
]
CATALOG = {}

def load_catalog():
    for p in CATALOG_CANDIDATES:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for ep in data.get("endpoints", []):
                        path_val = ep.get("path", "").strip().strip("/")
                        sample_res = ep.get("sample_response") or {}
                        raw_ds = sample_res.get("datasets") or {}
                        fmt_ds = {}
                        for ds_name, ds_info in raw_ds.items():
                            cols = ds_info.get("cols") or []
                            rows = ds_info.get("rows") or []
                            fmt_rows = []
                            for r in rows:
                                if isinstance(r, list):
                                    fmt_rows.append({cols[i]: str(r[i]) if i < len(r) and r[i] is not None else "" for i in range(len(cols))})
                                elif isinstance(r, dict):
                                    fmt_rows.append(r)
                            fmt_ds[ds_name] = fmt_rows
                        entry = {
                            "id": ep.get("id"),
                            "path": path_val,
                            "action": ep.get("action"),
                            "category": ep.get("category"),
                            "program_ids": ep.get("program_ids", []),
                            "total_calls": ep.get("total_calls", 0),
                            "parameters": sample_res.get("params") or {"errorCode": "1", "errorMsg": ""},
                            "datasets": fmt_ds
                        }
                        CATALOG[path_val] = entry
                        if ep.get("action"):
                            CATALOG[f"action:{ep.get('action')}"] = entry
                    print(f"[EMS Simulator] Loaded {len(CATALOG)//2} analyzed endpoints from {os.path.basename(p)}")
                    return
            except Exception as e:
                print(f"[EMS Simulator] Error loading catalog: {e}")

load_catalog()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def parse_xml_to_dict(xml_str):
    params = {}
    datasets = {}
    for m in re.finditer(r'<Parameter id="([^"]+)"[^>]*>(.*?)</Parameter>', xml_str, re.DOTALL):
        params[m.group(1)] = m.group(2).strip()
        
    for ds_m in re.finditer(r'<Dataset id="([^"]+)">(.*?)</Dataset>', xml_str, re.DOTALL):
        ds_id = ds_m.group(1)
        ds_body = ds_m.group(2)
        rows = []
        for r_m in re.finditer(r'<Row>(.*?)</Row>', ds_body, re.DOTALL):
            r_dict = dict(re.findall(r'<Col id="([^"]+)">(.*?)</Col>', r_m.group(1), re.DOTALL))
            rows.append(r_dict)
        datasets[ds_id] = rows
    return {"parameters": params, "datasets": datasets}

def build_nexacro_xml(error_code=1, error_msg="", parameters=None, datasets=None):
    parameters = parameters or {}
    datasets = datasets or {}
    
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<Root xmlns="http://www.nexacroplatform.com/platform/dataset">\n'
    xml += '\t<Parameters>\n'
    xml += f'\t\t<Parameter id="errorCode" type="int">{error_code}</Parameter>\n'
    xml += f'\t\t<Parameter id="errorMsg" type="string">{error_msg}</Parameter>\n'
    for k, v in parameters.items():
        if k not in ("errorCode", "errorMsg"):
            xml += f'\t\t<Parameter id="{k}">{v}</Parameter>\n'
    xml += '\t</Parameters>\n'
    
    for ds_id, rows in datasets.items():
        xml += f'\t<Dataset id="{ds_id}">\n'
        cols = []
        col_set = set()
        for r in rows:
            for k in r.keys():
                if k not in col_set:
                    col_set.add(k)
                    cols.append(k)
        xml += '\t\t<ColumnInfo>\n'
        for c in cols:
            xml += f'\t\t\t<Column id="{c}" type="string" size="32"/>\n'
        xml += '\t\t</ColumnInfo>\n'
        xml += '\t\t<Rows>\n'
        for r in rows:
            xml += '\t\t\t<Row>\n'
            for c in cols:
                val = r.get(c, "")
                xml += f'\t\t\t\t<Col id="{c}">{val}</Col>\n'
            xml += '\t\t\t</Row>\n'
        xml += '\t\t</Rows>\n'
        xml += '\t</Dataset>\n'
    xml += '</Root>\n'
    return xml

class NexacroHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_len).decode("utf-8", errors="ignore")
        parsed = parse_xml_to_dict(post_data)
        
        path = urlparse(self.path).path
        conn = get_db()
        cur = conn.cursor()
        
        datasets = {}
        parameters = {}
        
        # 1. Stock Status (RetStockStatusList.lgdn)
        if path == "/emsspareparts/sp101/sp110Nav/RetStockStatusList.lgdn":
            item_filters = [r.get("item") for r in parsed["datasets"].get("ds_ItemInfo", []) if r.get("item")]
            sql = """
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
            """
            params = []
            if item_filters:
                placeholders = ",".join("?" for _ in item_filters)
                sql += f" AND i.item IN ({placeholders})"
                params.extend(item_filters)
            cur.execute(sql, params)
            datasets["ds_result"] = [dict(r) for r in cur.fetchall()]
            
        # 2. Estimate Requests (RFQ)
        elif path == "/emsspareparts/sp101/sp120Nav/RetEstimateRequestList.lgdn":
            item_filters = [r.get("item") for r in parsed["datasets"].get("ds_ItemInfo", []) if r.get("item")]
            sql = "SELECT * FROM estimate_requests WHERE 1=1"
            params = []
            if item_filters:
                placeholders = ",".join("?" for _ in item_filters)
                sql += f" AND item IN ({placeholders})"
                params.extend(item_filters)
            cur.execute(sql, params)
            rows = cur.fetchall()
            datasets["ds_list"] = [{
                "checked": "0", "prvNo": r["prv_no"], "filePrvNo": r["file_prv_no"], "estimateRequestDate": r["estimate_request_date"],
                "contact": r["contact"], "factory": r["factory"], "emNo": r["em_no"], "emNoDesc": r["em_no_desc"],
                "budgetDept": r["budget_dept"], "budgetDepartmentCode": r["budget_department_code"], "workOrder": r["work_order"],
                "woType": r["wo_type"], "requestComment": r["request_comment"], "item": r["item"],
                "itemDescription": r["item_description"], "supplier": r["supplier"],
                "requestQty": r["request_qty"], "estimateStatus": r["estimate_status"], "estimateCost": r["estimate_cost"],
                "prNo": r["pr_no"], "poNo": r["po_no"]
            } for r in rows]
            
        # 3. Item Detail Info (retrieveItemInfoDetail.lgdn)
        elif path == "/emsspareparts/sp102/sp135Nav/retrieveItemInfoDetail.lgdn":
            inv_id = ""
            for r in parsed["datasets"].get("ds_Input", []):
                if r.get("inventoryItemId"):
                    inv_id = r.get("inventoryItemId")
                    break
            
            item = None
            if inv_id:
                cur.execute("""
                    SELECT i.*, inv.onhand_quantity, inv.allocated_quantity, inv.available_quantity, inv.inventory_item_id, inv.organization_id 
                    FROM items i JOIN inventory inv ON i.item = inv.item 
                    WHERE inv.inventory_item_id = ?
                """, (inv_id,))
                item = cur.fetchone()
            if not item:
                cur.execute("""
                    SELECT i.*, inv.onhand_quantity, inv.allocated_quantity, inv.available_quantity, inv.inventory_item_id, inv.organization_id 
                    FROM items i LEFT JOIN inventory inv ON i.item = inv.item 
                    LIMIT 1
                """)
                item = cur.fetchone()
                
            cur.execute("SELECT * FROM inventory WHERE item = ? LIMIT 1", (item["item"] if item else "",))
            inv = cur.fetchone()
            
            cur.execute("SELECT * FROM item_usage_summary WHERE item = ? LIMIT 1", (item["item"] if item else "",))
            summary = cur.fetchone()
            
            datasets["ds_Item"] = [{
                "item": item["item"], "description": item["description"], "uomCode": item["uom_code"] or "EA",
                "maker": item["maker"] or "", "catalogGroup": item["catalog_group"] or "", "makerPart": item["maker_part"] or item["model"] or "",
                "onhandQuantity": str(item["onhand_quantity"] or 0), "allocatedQuantity": str(item["allocated_quantity"] or 0),
                "availableQuantity": str(item["available_quantity"] or 0), "vendorName": item["supplier_name"] or item["maker"] or "",
                "unitPricePo": str(item["unit_price_po"] or 0), "unitPriceSp": str(item["unit_price_new"] or 0),
                "unitPriceSpr": str(item["unit_price_reb"] or 0), "itemStatus": item["item_status"] or "Active",
                "fdmUrl": item["fdm_url"] or "", "stopPo": "", "stopPoDesc": "", "stopPoRequestor": "",
                "implementedDate": "20220630153906000", "alterItem": "", "minOrderQty": "", "waitRepairQty": "0"
            }] if item else []
            
            datasets["ds_Inv"] = [{
                "buyItemType": inv["buy_item_type"] if inv else "통합 관리",
                "priceRegStatus": inv["price_reg_status"] if inv else "단가 등록",
                "reviewQty": inv["review_qty"] if inv else "",
                "targetQty": str(inv["target_qty"] or 4) if inv else "4",
                "logicQty": str(inv["logic_qty"] or 4) if inv else "4",
                "userQty": str(inv["user_qty"] or 0) if inv else "0",
                "safetyStockQty": str(inv["safety_stock_qty"] or 0) if inv else "0",
                "userFlag": inv["user_flag"] if inv else "N",
                "requestQty": "", "poWaitingQty": "0",
                "notReceivingQty": str(inv["not_receiving_qty"] or 13) if inv else "13",
                "overFlag": inv["over_flag"] if inv else "Y",
                "overQty": str(inv["over_qty"] or 9) if inv else "9",
                "onhandQty": str(inv["onhand_quantity"] or 0) if inv else "0",
                "otherSiteOnHandQty": str(inv["other_site_onhand_qty"] or 4) if inv else "4",
                "disuseFlag": inv["disuse_flag"] if inv else "N",
                "mtbfDay": str(inv["mtbf_day"] or 36.4) if inv else "36.4",
                "fullLeadTimeNew": str(inv["full_lead_time_new"] or 90) if inv else "90",
                "optimizedLogicBmQty": str(inv["optimized_logic_bm_qty"] or 4) if inv else "4",
                "optimizedLogicQty": str(inv["optimized_logic_qty"] or 4) if inv else "4",
                "oneTimeUserQty": str(inv["one_time_user_qty"] or 13) if inv else "13",
                "oneTimeTeamCode": "", "oneTimeTeam": "",
                "targetApplyTypeCode": inv["target_apply_type_code"] if inv else "OPTIMIZATION_NON_PERIOD",
                "targetApplyType": inv["target_apply_type"] if inv else "최적화(비계획)",
                "type": "Current", "requestDate": "2026-10-21 15:40", "userCheckFlag": "N",
                "repairTransferFlag": "", "oneTimeSpStatus": "Available",
                "repairRequestQty": str(inv["repair_request_qty"] or 0) if inv else "0",
                "oneTimeSprStatus": "", "holdReasonContent": ""
            }] if inv else []
            
            datasets["ds_Summary"] = [{
                "monthAvgUsage2y": str(summary["month_avg_usage_2y"] or 1) if summary else "1",
                "monthAvgUsage1y": str(summary["month_avg_usage_1y"] or 2) if summary else "2",
                "monthAvgUsage3m": str(summary["month_avg_usage_3m"] or 1) if summary else "1",
                "lastMonthIssueQty": str(summary["last_month_issue_qty"] or 0) if summary else "0",
                "thisMonthIssueQty": str(summary["this_month_issue_qty"] or 0) if summary else "0",
                "onceAvgIssueQty": str(summary["once_avg_issue_qty"] or 2) if summary else "2",
                "onceMaxIssueQty": str(summary["once_max_issue_qty"] or 7) if summary else "7",
                "onceMinIssueQty": str(summary["once_min_issue_qty"] or 1) if summary else "1"
            }] if summary else []
            
        # 4. Target Stock Optimization Search (sp330Nav & sp335Nav)
        elif path in ("/emsspareparts/sp302/sp330Nav/TargetStockSearchList.lgdn", "/emsspareparts/sp302/sp335Nav/TargetStockSearchList.lgdn"):
            item_filters = [r.get("item") for r in parsed["datasets"].get("ds_ItemInfo", []) if r.get("item")]
            sql = "SELECT * FROM target_stock WHERE 1=1"
            params = []
            if item_filters:
                placeholders = ",".join("?" for _ in item_filters)
                sql += f" AND item IN ({placeholders})"
                params.extend(item_filters)
            cur.execute(sql, params)
            rows = cur.fetchall()
            datasets["ds_StockInfomation"] = [{
                "spRmi": "", "sprRmi": "", "spUrl": "", "sprUrl": "", "insertFlag": "N",
                "item": r["item"], "itemDescription": r["item_description"], "model": r["model"], "maker": r["maker"],
                "issueTeam": "0", "itemCost": str(r["item_cost"] or "2997.49"), "issueFlag": r["issue_flag"] or "Y",
                "issueQty": str(r["issue_qty"] or "30"), "issueCount": str(r["issue_count"] or "19"), "onhandQty": "",
                "targetQty": str(r["target_qty"] or "4"), "optimizedLogicBmQty": str(r["optimized_logic_bm_qty"] or "4"),
                "optimizedLogicQty": str(r["optimized_logic_qty"] or "4"), "optimizedLogicRpBmQty": "1", "optimizedLogicRpQty": "1",
                "orderBufDay": r["order_buf_day"] or "20260731", "orderBufBmDay": "20260731", "orderBufRpDay": "99999999", "orderBufRpBmDay": "20260731",
                "logicQty": str(r["logic_qty"] or "4"), "userQty": str(r["user_qty"] or "0"), "userQtyOrg": "0",
                "targetApplyTypeCode": r["target_apply_type_code"] or "OPTIMIZATION_NON_PERIOD",
                "targetApplyType": r["target_apply_type"] or "Optimized(Unplanned)",
                "oneTimeUserQty": str(r["one_time_user_qty"] or "13"), "oneTimeUserQtyOrg": str(r["one_time_user_qty"] or "13"),
                "oneTimeTeamCode": "", "oneTimeTeam": "", "disuseFlag": "N", "disuseSprFlag": "", "minOrderQty": "",
                "manager": r["manager"] or "Nguyen Thi Hue", "publicFlag": "Y", "firstAssignFlag": "Y", "periodicFlag": "N",
                "changeComment": "", "managerId": r["manager_id"] or "613813", "fullLeadTime": str(r["full_lead_time"] or "90"),
                "basisDays": str(r["basis_days"] or "150"), "registFlag": "N", "registDate": "20220630153907000",
                "uom": r["uom"] or "EA", "amount": "", "fullLeadTimeFlag": "Y", "itemStatus": "Active",
                "creationDate": "20220630160047000", "lastUpdateDate": "20260928154201000",
                "lastUpdatedBy": r["manager"] or "Nguyen Thi Hue", "organizationId": r["organization_id"] or "28753",
                "inventoryItemId": r["inventory_item_id"] or "3042180", "safetryStockQty": "0", "userFlag": "N",
                "userFlagOrg": "N", "managementContactName": r["management_contact_name"] or "20260928_Nguyen Thi Hue",
                "chk": "", "privFlag": "N", "optimizeFlag": "Y", "safetyQty": str(r["safety_qty"] or "0"), "safetyQtyOrg": "0",
                "userCheckFlag": "N", "requestorName": "", "partsUseTypeCode": r["parts_use_type_code"] or "N002",
                "purchaseRequisitionQty": str(r["purchase_requisition_qty"] or "13"),
                "oneTimeSpStatus": r["one_time_sp_status"] or "Available", "repairRequestQtyOrg": "", "repairRequestQty": "",
                "oneTimeSprStatus": "", "repairTransferFlag": "", "dueDays": str(r["due_days"] or "103"), "dueBasisDays": "0",
                "interlockFlag": "", "targetDept": "", "targetDeptDesc": "", "outputQuantity": "", "alarmBasisQty": "",
                "alarmFlag": "", "minFlag": "", "userEnteredFlag": "N", "bufferStockFlag": "", "holdReasonContent": "",
                "repairTypeShortName": "", "inventoryQty": "", "orgCode": r["org_code"] or "A13", "excludeFlag": "",
                "exceptionTypeName": "", "exceptionFlag": "", "exceptionReasonDesc": ""
            } for r in rows]
            
        # 5. Target Stock Optimization Flag (GetOptimizeInfo.lgdn)
        elif path == "/emsspareparts/sp302/sp330Nav/GetOptimizeInfo.lgdn":
            datasets["ds_rtn"] = [
                {"optimizeFlag": "Y", "optimizedApplyDate": "20210316"}
            ]

        # 6. Item Search Popup (retrieveItem.lgdn)
        elif path == "/emscom/popupNav/retrieveItem.lgdn":
            s = (parsed["datasets"].get("ds_Search") or [{}])[0]
            sql = """
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
            """
            params = []
            if s.get("item"):
                sql += " AND i.item LIKE ?"
                params.append(f"%{s['item']}%")
            if s.get("itemDescription"):
                sql += " AND i.description LIKE ?"
                params.append(f"%{s['itemDescription']}%")
            if s.get("maker"):
                sql += " AND i.maker LIKE ?"
                params.append(f"%{s['maker']}%")
            cur.execute(sql, params)
            rows = cur.fetchall()
            datasets["ds_List"] = [{
                "uniqueNo": str(idx + 1).zfill(3), "itemType": "SP", "item": r["item"],
                "itemDescription": r["itemDescription"], "primaryUomCode": r["primaryUomCode"] or "EA",
                "itemCost": str(r["itemCost"] or "2985.55"), "buyerName": r["buyerName"] or "Thi Ngoc Mai, Nguyen",
                "itemStatus": r["itemStatus"] or "Active", "catalogGroup": r["catalogGroup"] or "Q4.Joint/Connector",
                "specification": r["specification"] or r["itemDescription"], "unificationFlag": "N",
                "poOwnership": "LGD", "rebSnFlag": "N", "buyItemType": r["buyItemType"] or "통합 관리",
                "buyItemTypeCode": r["buyItemTypeCode"] or "N002", "inventoryItemId": str(r["inventoryItemId"] or "3042180"),
                "organizationId": str(r["organizationId"] or "28753"), "buyerId": str(r["buyerId"] or "877778"),
                "onhandQuantity": str(r["onhandQuantity"] or "0"), "availableQuantity": str(r["availableQuantity"] or "0"),
                "commonFlag": "Y", "chkFlag": "", "timelyPurchaseDate": r["timelyPurchaseDate"] or "20260731",
                "onhandQty": str(r["onhandQuantity"] or "0"), "poWaitingQty": "0",
                "waitRepairQty": str(r["waitRepairQty"] or "0"),
                "availableTransferQtyAll": str(r["availableTransferQtyAll"] or "0"),
                "poInterlockFlag": "N", "notReceivingQty": str(r["notReceivingQty"] or "13"),
                "poOptTargetFlag": "N", "orgMaskCnt": "0", "waitRepairFlag": "N", "qltyMgtTargetFlag": "N",
                "poType": r["poType"] or "원 법인 구매", "poTypeCode": r["poTypeCode"] or "PT003",
                "itemCategoryCode": r["itemCategoryCode"] or "QCAB1301",
                "itemCategoryDesc": r["itemCategoryDesc"] or "Q4.Joint/Connector",
                "itemCatalogGroupId": str(r["itemCatalogGroupId"] or "504"),
                "modelName": r["modelName"] or "", "makerName": r["makerName"] or "",
                "fdmUrl": r["fdmUrl"] or "", "fdmFlag": r["fdmFlag"] or "Y"
            } for idx, r in enumerate(rows)]
            
        # 7. Item PO History Popup
        elif path == "/emscom/popupNav/retrieveItemPoStatusList.lgdn":
            s = (parsed["datasets"].get("ds_Search") or [{}])[0]
            sql = "SELECT po_number as poNumber, po_date as poDate, supplier, item, quantity, unit_price as unitPrice, status, requestor, department FROM item_po_history WHERE 1=1"
            params = []
            if s.get("item"):
                sql += " AND item = ?"
                params.append(s["item"])
            elif s.get("inventoryItemId"):
                sql += " AND inventory_item_id = ?"
                params.append(s["inventoryItemId"])
            cur.execute(sql, params)
            datasets["ds_Rtn"] = [dict(r) for r in cur.fetchall()]
            
        # 8. Common Code Dictionary
        elif path == "/emscom/codeNav/retComCodeList.lgdn":
            stmt = parsed["parameters"].get("statementName", "retrieveTargetApplyType:retrieveBuyItemType:retrieveRepairCategory:retrieveOrganizationId:")
            stmts = [s.strip() for s in stmt.split(":") if s.strip()]
            for idx, s in enumerate(stmts):
                if s == "retrieveOrganizationId":
                    cur.execute("SELECT com_code as comCode, com_code_desc as comCodeDesc, data2_code as orgCode FROM common_codes WHERE group_code = ?", (s,))
                    rows = [{"comCode": "", "comCodeDesc": "-Select-", "orgCode": ""}] + [dict(r) for r in cur.fetchall()]
                else:
                    cur.execute("SELECT com_code as comCode, com_code_desc as comCodeDesc, enabled_flag as enabledFlag, data2_code as data2Code, data3_code as data3Code FROM common_codes WHERE group_code = ?", (s,))
                    rows = [{"comCode": "", "comCodeDesc": "-Select-", "data2Code": "", "data3Code": ""}] + [dict(r) for r in cur.fetchall()]
                datasets[f"ds_output{idx}"] = rows
                
        # 9. Factory List
        elif path == "/emswonew/wn90/wn900Nav/retFactoryList.lgdn":
            cur.execute("SELECT com_code as comCode, com_code_desc as comCodeDesc, description, factory_type as factoryType, city, area_code as areaCode, organization_id as organizationId, seq_no as seqNo FROM factories ORDER BY seq_no ASC")
            datasets["ds_cbo_factory"] = [dict(r) for r in cur.fetchall()]

        # 10. Purchase Request Creation (MUTATE - CreInsertItemPrvRequest.lgdn)
        elif path == "/emsspareparts/sp101/sp110Nav/CreInsertItemPrvRequest.lgdn":
            s = (parsed["datasets"].get("ds_search") or [{}])[0]
            txn_group_id = s.get("txnGroupId", "421996047")
            inv_item_id = s.get("inventoryItemId", "3890752")
            org_id = s.get("organizationId", "28753")
            prv_type = s.get("prvType", "NEW")
            user_id = s.get("userId", "658359")
            prv_no = s.get("prvNo") or "Q2610-3890752"
            try:
                cur.execute(
                    "INSERT INTO prv_requests (txn_group_id, inventory_item_id, organization_id, prv_type, prv_no, user_id, status, err_code, err_msg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (txn_group_id, inv_item_id, org_id, prv_type, prv_no, user_id, "OK", "0", "")
                )
                conn.commit()
            except Exception as e:
                pass
            datasets["ds_list"] = [{"result": "OK", "errCode": "0", "errMsg": ""}]

        # 11. Repair Interlock Check (retWaitRepairItemInterlock.lgdn)
        elif path == "/emsspareparts/sp102/sp131Nav/retWaitRepairItemInterlock.lgdn":
            datasets["ds_result"] = [{"applyFlag": "N"}]

        # 12. Engineering Change Flag (retEcFlag.lgdn)
        elif path == "/emsspareparts/sp102/sp137Nav/retEcFlag.lgdn":
            datasets["ds_ec"] = [{"ecCode": "EC001", "ecCodeDesc": "EC 대상"}]

        # 13. Work Order Save Init (WO230WoSaveInit.lgdn)
        elif path == "/emsworkorder/wo20/wo230Nav/WO230WoSaveInit.lgdn":
            info = (parsed["datasets"].get("ds_info") or [{}])[0]
            wip_id = info.get("wipEntityId", "314805734")
            cur.execute("SELECT * FROM work_orders WHERE wip_entity_id = ?", (wip_id,))
            wo = cur.fetchone()
            wip_entity_id = wo["wip_entity_id"] if wo else wip_id
            org_id = wo["organization_id"] if wo else "28753"
            datasets["ds_init"] = [{"safetyFlag": "N", "emrgIssueFlag": "N", "useAllocationFlag": "N", "useQCodeFlag": "Y", "checkMessage": "", "activityTotManCnt": "", "wipEntityId": wip_entity_id, "organizationId": org_id}]
            datasets["ds_oplist"] = [{"operationSeqNum": "10", "wipEntityId": wip_entity_id, "organizationId": org_id, "standardOperationId": "", "standardOperationCode": "", "departmentId": "1201617", "departmentCode": "87254", "description": "Operation 10"}]
            datasets["ds_mtlist"] = [{"wipEntityId": wip_entity_id, "organizationId": org_id, "operationSeqNum": "10", "operationDesc": "", "opDept": "87254", "itemType": "1", "inventoryItemId": "3772493", "directItemSeqId": "", "itemName": "QCAC23840", "itemDesc": "Needle Valve ** MARCO SYSTEMANALYSE", "quantity": "0", "uom": "EA", "onHandQty": "20", "availableQty": "20", "commonFlag": "Y"}]
            datasets["ds_poChangeFlag"] = [{"poChangeFlag": "N"}]
            datasets["ds_poInfoFlag"] = [{"poInfoFlag": "N"}]
            datasets["ds_spAttachFile"] = [{"attachFileCnt": "0"}]

        # 14. Work Order Status History (statusHistory.lgdn)
        elif path == "/emsworkorder/wo50/wo580Nav/statusHistory.lgdn":
            info = (parsed["datasets"].get("ds_info") or [{}])[0]
            wip_id = info.get("wipEntityId", "314805734")
            datasets["ds_list"] = [
                {"wipEntityId": wip_id, "historyId": "139544072", "organizationId": "28753", "commentText": "PR Return에 따른 WO 취소 처리", "createdBy": "1102", "creationDate": "20250915130713000"},
                {"wipEntityId": wip_id, "historyId": "147566170", "organizationId": "28753", "commentText": "WO Khởi tạo ban đầu", "createdBy": "VH081996", "creationDate": "20250915110713000"}
            ]
            datasets["ds_input"] = [{"historyId": "147566170"}]

        # 15. Realtime Spareparts Status (retSparepartsStatus.lgdn)
        elif path == "/emsspareparts/sp201/sp220Nav/retSparepartsStatus.lgdn":
            datasets["ds_RealtimeReviewreq"] = [{"recordCount": "3", "amount": "2"}]
            datasets["ds_RealReviewreqConfirm"] = [{"recordCount": "0", "amount": "0"}]
            datasets["ds_RealPRreq"] = [{"recordCount": "0", "amount": "0"}]
            datasets["ds_RealPOStandby"] = [{"recordCount": "0", "amount": "0"}]
            datasets["ds_RealSupplierUncheck"] = [{"recordCount": "0", "amount": "0"}]
            datasets["ds_RealPORemainQty"] = [{"recordCount": "2", "amount": "1"}]
            datasets["ds_CumDeliveryInfo"] = [{"recordCount": "0", "amount": "0"}]

        # 16. Security & UI Grid Formats
        elif path == "/emsspareparts/sp302/sp330Nav/CheckMasterAuth.lgdn":
            datasets["ds_auth"] = [{"masterYn": "N"}]
        elif path == "/emsspareparts/sp302/sp330Nav/GetSpPrivFlag.lgdn":
            datasets["ds_result"] = [{"privFlag": "N"}]
        elif path == "/emscom/authButtonNav/getAuthButton.lgdn":
            datasets["ds_auth"] = [{"authSearch": "Y", "authSave": "Y", "authDelete": "N", "authPrint": "Y"}]
        elif path == "/emscom/gridFormatNav/retrieveGridFormat.lgdn":
            datasets["ds_list"] = []
        elif path in ("/emscom/connLogNav/insertStartLog.lgdn", "/emscom/connLogNav/updateEndLog.lgdn", "/Servlet/MenuPermit.document"):
            pass

        # Universal Catalog Dispatcher Fallback
        else:
            clean_path = path.strip("/")
            cat_entry = CATALOG.get(clean_path) or CATALOG.get(f"action:{clean_path.split('/')[-1].replace('.lgdn','').replace('.document','')}")
            if cat_entry:
                datasets = cat_entry.get("datasets", {})
                parameters.update(cat_entry.get("parameters", {}))
            elif path.endswith(".lgdn") or path.endswith(".document"):
                datasets = {}
            else:
                self.send_error(404, "Endpoint not simulated or removed")
                conn.close()
                return
            
        conn.close()
        
        xml_resp = build_nexacro_xml(error_code=1, error_msg="", parameters=parameters, datasets=datasets)
        resp_bytes = xml_resp.encode("utf-8")
        
        self.send_response(200)
        self.send_header("Content-Type", "text/xml; charset=UTF-8")
        self.send_header("Content-Length", str(len(resp_bytes)))
        self.send_header("Server", "LG Display EMS Python Simulator")
        self.end_headers()
        self.wfile.write(resp_bytes)

    def do_GET(self):
        if self.path == "/api/health":
            conn = get_db()
            cur = conn.cursor()
            cur.execute("SELECT count(*) as c FROM items")
            item_cnt = cur.fetchone()["c"]
            cur.execute("SELECT count(*) as c FROM work_orders")
            wo_cnt = cur.fetchone()["c"]
            conn.close()
            payload = json.dumps({
                "status": "ONLINE",
                "runtime": "python",
                "port": PORT,
                "endpoints_supported": len(CATALOG) // 2,
                "database": {"items": item_cnt, "work_orders": wo_cnt}
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        elif self.path == "/api/translations":
            conn = get_db()
            cur = conn.cursor()
            cur.execute("SELECT * FROM translations")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            payload = json.dumps(rows).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        elif self.path == "/api/endpoints":
            endpoints_list = []
            seen = set()
            for k, ep in CATALOG.items():
                if not k.startswith("action:") and ep["id"] not in seen:
                    seen.add(ep["id"])
                    endpoints_list.append({
                        "id": ep["id"],
                        "path": ep["path"],
                        "action": ep["action"],
                        "category": ep["category"],
                        "total_calls": ep["total_calls"],
                        "datasets": list(ep.get("datasets", {}).keys())
                    })
            payload = json.dumps({"total": len(endpoints_list), "endpoints": endpoints_list}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        else:
            self.send_error(404)

if __name__ == "__main__":
    print(f"[EMS Python Simulator] Listening on port {PORT}...")
    print(f"[EMS Python Simulator] Core Data APIs Active, Database: {DB_PATH}")
    server = HTTPServer(("0.0.0.0", PORT), NexacroHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Simulator stopped.")
