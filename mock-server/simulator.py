#!/usr/bin/env python3
# Standalone LG Display EMS Mock Server (Python 3 zero-dependency)
# Serves the 8 core business data retrieval APIs against SQLite database (db/ems.db).

import os
import re
import sqlite3
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PORT = int(os.environ.get("PORT", 9000))
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "ems.db")

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
        
        # 1. Stock Status
        if path == "/emsspareparts/sp101/sp110Nav/RetStockStatusList.lgdn":
            item_filters = [r.get("item") for r in parsed["datasets"].get("ds_ItemInfo", []) if r.get("item")]
            sql = """
                SELECT i.item as itemName, inv.organization_id as organizationId, inv.inventory_item_id as inventoryItemId,
                       i.description as itemDescription, i.item_status as itemStatus, i.uom_code as uomCode, i.maker,
                       i.catalog_group_name as catalogGroupName, i.item_spec as itemSpec, i.model,
                       inv.onhand_quantity as onhandQuantity, inv.allocated_quantity as allocatedQuantity, inv.available_quantity as availableQuantity,
                       inv.planner_code as plannerCode, i.unit_price_new as unitPriceNew, i.unit_price_reb as unitPriceReb,
                       inv.stock_department as stockDepartment, inv.inventory_department_code as inventoryDepartmentCode, i.item_type_name as itemTypeName
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
            
        # 3. Item Detail Info
        elif path == "/emsspareparts/sp102/sp135Nav/retrieveItemInfoDetail.lgdn":
            inv_id = ""
            for r in parsed["datasets"].get("ds_Input", []):
                if r.get("inventoryItemId"):
                    inv_id = r.get("inventoryItemId")
                    break
            
            item = None
            if inv_id:
                cur.execute("""
                    SELECT i.*, inv.onhand_quantity, inv.allocated_quantity, inv.available_quantity 
                    FROM items i JOIN inventory inv ON i.item = inv.item 
                    WHERE inv.inventory_item_id = ?
                """, (inv_id,))
                item = cur.fetchone()
            if not item:
                cur.execute("""
                    SELECT i.*, inv.onhand_quantity, inv.allocated_quantity, inv.available_quantity 
                    FROM items i LEFT JOIN inventory inv ON i.item = inv.item 
                    LIMIT 1
                """)
                item = cur.fetchone()
                
            cur.execute("SELECT * FROM inventory WHERE item = ? LIMIT 1", (item["item"] if item else "",))
            inv = cur.fetchone()
            
            cur.execute("SELECT * FROM item_usage_summary WHERE item = ? LIMIT 1", (item["item"] if item else "",))
            summary = cur.fetchone()
            
            datasets["ds_Item"] = [{
                "item": item["item"], "description": item["description"], "uomCode": item["uom_code"],
                "maker": item["maker"], "catalogGroup": item["catalog_group"], "makerPart": item["model"],
                "onhandQuantity": str(item["onhand_quantity"] or 0), "allocatedQuantity": str(item["allocated_quantity"] or 0),
                "availableQuantity": str(item["available_quantity"] or 0), "vendorName": item["maker"],
                "unitPricePo": str(item["unit_price_po"] or 0), "itemStatus": item["item_status"] or "Active"
            }] if item else []
            
            datasets["ds_Inv"] = [{
                "buyItemType": inv["buy_item_type"], "priceRegStatus": inv["price_reg_status"],
                "reviewQty": inv["review_qty"], "targetQty": inv["target_qty"], "logicQty": inv["logic_qty"],
                "userQty": inv["user_qty"], "safetyStockQty": inv["safety_stock_qty"], "userFlag": inv["user_flag"],
                "onhandQty": inv["onhand_quantity"], "fullLeadTimeNew": inv["full_lead_time_new"],
                "optimizedLogicBmQty": inv["optimized_logic_bm_qty"], "optimizedLogicQty": inv["optimized_logic_qty"],
                "oneTimeUserQty": inv["one_time_user_qty"], "targetApplyType": inv["target_apply_type"]
            }] if inv else []
            
            datasets["ds_Summary"] = [{
                "monthAvgUsage2y": summary["month_avg_usage_2y"], "monthAvgUsage1y": summary["month_avg_usage_1y"],
                "monthAvgUsage3m": summary["month_avg_usage_3m"], "lastMonthIssueQty": summary["last_month_issue_qty"],
                "thisMonthIssueQty": summary["this_month_issue_qty"], "onceAvgIssueQty": summary["once_avg_issue_qty"]
            }] if summary else []
            
        # 4. Target Stock Optimization
        elif path == "/emsspareparts/sp302/sp335Nav/TargetStockSearchList.lgdn":
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
                "spRmi": "", "sprRmi": "", "insertFlag": "N", "item": r["item"], "itemDescription": r["item_description"],
                "model": r["model"], "maker": r["maker"], "targetQty": r["target_qty"], "safetyQty": r["safety_qty"],
                "logicQty": r["logic_qty"], "userQty": r["user_qty"], "optimizedLogicBmQty": r["optimized_logic_bm_qty"],
                "optimizedLogicQty": r["optimized_logic_qty"], "orderBufDay": r["order_buf_day"], "dueDays": r["due_days"],
                "fullLeadTime": r["full_lead_time"], "targetApplyTypeCode": r["target_apply_type_code"],
                "targetApplyType": r["target_apply_type"], "oneTimeUserQty": r["one_time_user_qty"],
                "managementContactName": r["management_contact_name"], "purchaseRequisitionQty": r["purchase_requisition_qty"]
            } for r in rows]
            
        # 5. Item Search Popup
        elif path == "/emscom/popupNav/retrieveItem.lgdn":
            s = (parsed["datasets"].get("ds_Search") or [{}])[0]
            sql = "SELECT item, description, model, maker, catalog_group as catalogGroup, uom_code as uomCode FROM items WHERE 1=1"
            params = []
            if s.get("item"):
                sql += " AND item LIKE ?"
                params.append(f"%{s['item']}%")
            if s.get("description"):
                sql += " AND description LIKE ?"
                params.append(f"%{s['description']}%")
            if s.get("maker"):
                sql += " AND maker LIKE ?"
                params.append(f"%{s['maker']}%")
            cur.execute(sql, params)
            datasets["ds_List"] = [dict(r) for r in cur.fetchall()]
            
        # 6. Item PO History Popup
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
            
        # 7. Common Code Dictionary
        elif path == "/emscom/codeNav/retComCodeList.lgdn":
            stmt = parsed["parameters"].get("statementName", "retrieveItemType:")
            stmts = [s.strip() for s in stmt.split(":") if s.strip()]
            for idx, s in enumerate(stmts):
                cur.execute("SELECT com_code as comCode, com_code_desc as comCodeDesc, enabled_flag as enabledFlag, data2_code as data2Code, data3_code as data3Code FROM common_codes WHERE group_code = ?", (s,))
                datasets[f"ds_output{idx}"] = [dict(r) for r in cur.fetchall()]
                
        # 8. Factory List
        elif path == "/emswonew/wn90/wn900Nav/retFactoryList.lgdn":
            cur.execute("SELECT com_code as comCode, com_code_desc as comCodeDesc, description, factory_type as factoryType, city, area_code as areaCode, organization_id as organizationId, seq_no as seqNo FROM factories ORDER BY seq_no ASC")
            datasets["ds_cbo_factory"] = [dict(r) for r in cur.fetchall()]
            
        else:
            self.send_error(404, "Endpoint not simulated or removed (only 8 core data APIs available)")
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
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ONLINE","runtime":"python","port":' + str(PORT).encode() + b',"apis":8}')
        else:
            self.send_error(404)

if __name__ == "__main__":
    print(f"[EMS Python Simulator] Listening on port {PORT}...")
    print(f"[EMS Python Simulator] 8 Core Data APIs Active, Database: {DB_PATH}")
    server = HTTPServer(("0.0.0.0", PORT), NexacroHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Simulator stopped.")
