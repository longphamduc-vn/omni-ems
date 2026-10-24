#!/usr/bin/env python3
"""
EMS API Analyzer
----------------
Đọc, phân tích, chuẩn hóa và nhóm các API endpoints từ file A1.txt (trích xuất từ EMS LG Display).
Tạo ra các tập dữ liệu JSON phân tích, OpenAPI 3.0 specification và Postman Collection.
"""

import os
import sys
import json
import re
import yaml
from urllib.parse import urlparse
from datetime import datetime

def find_input_file(specified_path=None):
    """Tìm file A1.txt trong thư mục hiện tại hoặc thư mục cha"""
    if specified_path and os.path.exists(specified_path):
        return os.path.abspath(specified_path)
    
    candidates = [
        "A1.txt",
        "../A1.txt",
        "/home/longp/projects/company/omni-ems/A1.txt",
        "t1.txt",
        "../t1.txt",
        "/home/longp/projects/company/omni-ems/t1.txt"
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return None

def sanitize_yaml_text(content):
    """Làm sạch và sửa lỗi chuỗi YAML bị cắt ngắn do giới hạn bộ nhớ DevTools"""
    cleaned = content.replace('\xa0', ' ')
    lines = cleaned.splitlines()
    # Kiểm tra dòng cuối cùng có bị unclosed quote không
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i].strip()
        if not line:
            continue
        if line.count("'") % 2 != 0:
            lines[i] = lines[i] + "'"
        break
    return '\n'.join(lines)

def determine_operation_category(action_name, method):
    """Phân loại nghiệp vụ dựa trên tên action"""
    act = action_name.lower()
    if 'log' in act:
        return "LOGGING"
    if 'auth' in act or 'priv' in act or 'permit' in act:
        return "SECURITY"
    if any(act.startswith(prefix) for prefix in ['insert', 'update', 'cre', 'save', 'del', 'modify']):
        return "MUTATE"
    if any(act.startswith(prefix) for prefix in ['ret', 'get', 'check', 'target', 'search', 'find']):
        return "QUERY"
    return "OTHER"

def get_program_id(api):
    """Trích xuất Screen / Program ID từ request params hoặc dataset nếu có"""
    req = api.get('request') or {}
    params = req.get('params') or {}
    if 'programId' in params and params['programId']:
        return params['programId']
    
    # Kiểm tra trong ds_search
    datasets = req.get('datasets') or {}
    for ds_name, ds_data in datasets.items():
        if isinstance(ds_data, dict):
            cols = ds_data.get('cols') or []
            rows = ds_data.get('rows') or []
            if 'programId' in cols and rows and len(rows) > 0:
                idx = cols.index('programId')
                if idx < len(rows[0]) and rows[0][idx]:
                    return rows[0][idx]
    
    # Đoán từ URL
    url = api.get('url', '')
    match = re.search(r'/(sp\d{3}|wo\d{3}|cm\d{3})', url, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    return "COMMON"

def analyze_ems_file(file_path):
    print(f"[*] Đang đọc file: {file_path}")
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()

    # Tìm mảng JSON chứa các ghi chú
    match = re.search(r'(\[\s*\{.*\}\s*\])', text, re.DOTALL)
    if not match:
        raise ValueError("Không tìm thấy cấu trúc mảng JSON các ghi chú trong file!")

    raw_json = match.group(1).strip()
    raw_json = re.sub(r'^VM\d+:\d+\s*', '', raw_json)
    notes = json.loads(raw_json)
    print(f"[+] Đã đọc thành công {len(notes)} ghi chú từ file.")

    raw_calls = []
    flow_sessions = []

    for note in notes:
        note_idx = note.get('index')
        note_title = note.get('title', f"Session #{note_idx}")
        content = note.get('content', '')
        edited_at = note.get('editedAt', '')

        if not content or content == '[Nội dung trống]':
            continue

        sanitized = sanitize_yaml_text(content)
        note_apis = []
        try:
            loaded = yaml.safe_load(sanitized)
            if isinstance(loaded, dict) and 'apis' in loaded:
                note_apis = loaded['apis']
        except Exception as e:
            print(f"[!] Lỗi parse ghi chú #{note_idx}: {e}")
            continue

        session_calls = []
        for api_item in note_apis:
            api_item['note_index'] = note_idx
            api_item['note_title'] = note_title
            raw_calls.append(api_item)
            session_calls.append({
                'api_index': api_item.get('index'),
                'url': api_item.get('url'),
                'method': api_item.get('method', 'POST'),
                'status': api_item.get('status', 200),
                'durationMs': api_item.get('durationMs', 0),
                'programId': get_program_id(api_item),
                'request_params': (api_item.get('request') or {}).get('params', {}),
                'request_datasets': list(((api_item.get('request') or {}).get('datasets') or {}).keys()),
                'response_params': (api_item.get('response') or {}).get('params', {}),
                'response_datasets': list(((api_item.get('response') or {}).get('datasets') or {}).keys())
            })

        flow_sessions.append({
            'note_index': note_idx,
            'title': note_title,
            'edited_at': edited_at,
            'total_calls': len(session_calls),
            'total_duration_ms': sum(c.get('durationMs', 0) for c in session_calls),
            'calls': session_calls
        })

    print(f"[+] Tổng số lượt gọi API được ghi nhận: {len(raw_calls)}")

    # Nhóm và phân tích theo từng Endpoint duy nhất
    endpoints_map = {}
    datasets_catalog = {}

    for call in raw_calls:
        url = call.get('url', '').strip()
        if not url:
            continue

        path = urlparse(url).path if '://' in url else url
        if path.startswith('/'):
            path = path[1:]

        parts = path.split('/')
        module = parts[0] if len(parts) > 0 else 'other'
        submodule = parts[1] if len(parts) > 1 else ''
        controller = parts[2] if len(parts) > 2 else ''
        action_with_ext = parts[-1]
        action_name = re.sub(r'\.(lgdn|document)$', '', action_with_ext)

        program_id = get_program_id(call)
        category = determine_operation_category(action_name, call.get('method', 'POST'))

        if url not in endpoints_map:
            endpoints_map[url] = {
                'id': re.sub(r'[^a-zA-Z0-9]', '_', path),
                'url': url,
                'path': path,
                'method': call.get('method', 'POST'),
                'module': module,
                'submodule': submodule,
                'controller': controller,
                'action': action_name,
                'category': category,
                'program_ids': set(),
                'total_calls': 0,
                'durations': [],
                'statuses': set(),
                'roles': set(),
                'sessions_appeared': set(),
                'request_params_schema': {},
                'response_params_schema': {},
                'request_datasets_schema': {},
                'response_datasets_schema': {},
                'sample_request': call.get('request'),
                'sample_response': call.get('response'),
            }

        ep = endpoints_map[url]
        ep['total_calls'] += 1
        ep['program_ids'].add(program_id)
        ep['statuses'].add(str(call.get('status', '200')))
        if call.get('role'):
            ep['roles'].add(call.get('role'))
        if call.get('durationMs'):
            ep['durations'].append(call.get('durationMs'))
        ep['sessions_appeared'].add(call.get('note_index'))

        # Phân tích tham số request
        req = call.get('request') or {}
        for k, v in (req.get('params') or {}).items():
            if k not in ep['request_params_schema']:
                ep['request_params_schema'][k] = {'sample_value': v, 'type': type(v).__name__}

        # Phân tích datasets request
        for ds_name, ds_info in (req.get('datasets') or {}).items():
            if not isinstance(ds_info, dict):
                continue
            cols = ds_info.get('cols') or []
            rows = ds_info.get('rows') or []
            if ds_name not in ep['request_datasets_schema']:
                ep['request_datasets_schema'][ds_name] = {
                    'name': ds_name,
                    'cols': cols,
                    'sample_count': ds_info.get('count', len(rows)),
                    'sample_row': rows[0] if rows else []
                }
            # Catalog toàn hệ thống
            if ds_name not in datasets_catalog:
                datasets_catalog[ds_name] = {'type': 'REQUEST', 'cols': set(cols), 'used_in_endpoints': set()}
            datasets_catalog[ds_name]['used_in_endpoints'].add(path)
            datasets_catalog[ds_name]['cols'].update(cols)

        # Phân tích tham số response
        res = call.get('response') or {}
        for k, v in (res.get('params') or {}).items():
            if k not in ep['response_params_schema']:
                ep['response_params_schema'][k] = {'sample_value': v, 'type': type(v).__name__}

        # Phân tích datasets response
        for ds_name, ds_info in (res.get('datasets') or {}).items():
            if not isinstance(ds_info, dict):
                continue
            cols = ds_info.get('cols') or []
            rows = ds_info.get('rows') or []
            if ds_name not in ep['response_datasets_schema']:
                ep['response_datasets_schema'][ds_name] = {
                    'name': ds_name,
                    'cols': cols,
                    'sample_count': ds_info.get('count', len(rows)),
                    'sample_row': rows[0] if rows else []
                }
            # Catalog toàn hệ thống
            if ds_name not in datasets_catalog:
                datasets_catalog[ds_name] = {'type': 'RESPONSE', 'cols': set(cols), 'used_in_endpoints': set()}
            datasets_catalog[ds_name]['used_in_endpoints'].add(path)
            datasets_catalog[ds_name]['cols'].update(cols)

    # Chuyển đổi các set thành list để serialize JSON
    endpoints_list = []
    modules_grouping = {}
    programs_grouping = {}
    categories_grouping = {"QUERY": [], "MUTATE": [], "LOGGING": [], "SECURITY": [], "OTHER": []}

    for ep in endpoints_map.values():
        durations = ep['durations']
        avg_duration = round(sum(durations) / len(durations), 1) if durations else 0
        min_duration = min(durations) if durations else 0
        max_duration = max(durations) if durations else 0

        ep_serialized = {
            'id': ep['id'],
            'url': ep['url'],
            'path': ep['path'],
            'method': ep['method'],
            'module': ep['module'],
            'submodule': ep['submodule'],
            'controller': ep['controller'],
            'action': ep['action'],
            'category': ep['category'],
            'program_ids': sorted(list(ep['program_ids'])),
            'total_calls': ep['total_calls'],
            'avg_duration_ms': avg_duration,
            'min_duration_ms': min_duration,
            'max_duration_ms': max_duration,
            'statuses': sorted(list(ep['statuses'])),
            'roles': sorted(list(ep['roles'])),
            'sessions_count': len(ep['sessions_appeared']),
            'sessions_appeared': sorted(list(ep['sessions_appeared'])),
            'request_params': ep['request_params_schema'],
            'response_params': ep['response_params_schema'],
            'request_datasets': ep['request_datasets_schema'],
            'response_datasets': ep['response_datasets_schema'],
            'sample_request': ep['sample_request'],
            'sample_response': ep['sample_response']
        }
        endpoints_list.append(ep_serialized)

        # Nhóm theo Module
        m = ep['module']
        if m not in modules_grouping:
            modules_grouping[m] = []
        modules_grouping[m].append(ep['id'])

        # Nhóm theo Program ID
        for prog in ep['program_ids']:
            if prog not in programs_grouping:
                programs_grouping[prog] = []
            programs_grouping[prog].append(ep['id'])

        # Nhóm theo Category
        cat = ep['category']
        if cat in categories_grouping:
            categories_grouping[cat].append(ep['id'])

    # Sắp xếp endpoint theo số lượng gọi giảm dần
    endpoints_list.sort(key=lambda x: x['total_calls'], reverse=True)

    # Chuyển datasets catalog thành list
    datasets_list = []
    for ds_name, ds_meta in datasets_catalog.items():
        datasets_list.append({
            'name': ds_name,
            'type': ds_meta['type'],
            'columns_count': len(ds_meta['cols']),
            'columns': sorted(list(ds_meta['cols'])),
            'endpoints_count': len(ds_meta['used_in_endpoints']),
            'used_in_endpoints': sorted(list(ds_meta['used_in_endpoints']))
        })
    datasets_list.sort(key=lambda x: x['endpoints_count'], reverse=True)

    result_data = {
        'metadata': {
            'analyzed_at': datetime.now().isoformat(),
            'source_file': os.path.basename(file_path),
            'source_path': file_path,
            'total_notes_scanned': len(notes),
            'total_api_calls_recorded': len(raw_calls),
            'total_unique_endpoints': len(endpoints_list),
            'total_unique_datasets': len(datasets_list),
            'modules_count': len(modules_grouping),
            'overall_avg_duration_ms': round(sum(ep['avg_duration_ms'] * ep['total_calls'] for ep in endpoints_list) / len(raw_calls), 1) if raw_calls else 0
        },
        'groups': {
            'by_module': {m: len(eps) for m, eps in modules_grouping.items()},
            'by_category': {c: len(eps) for c, eps in categories_grouping.items()},
            'by_program': {p: len(eps) for p, eps in programs_grouping.items()}
        },
        'modules': modules_grouping,
        'programs': programs_grouping,
        'categories': categories_grouping,
        'endpoints': endpoints_list,
        'datasets': datasets_list,
        'flow_sessions': flow_sessions
    }

    return result_data

def generate_openapi_spec(analyzed_data):
    """Tạo OpenAPI 3.0.0 Specification cho các endpoint EMS"""
    paths = {}
    for ep in analyzed_data['endpoints']:
        path_key = "/" + ep['path']
        method = ep['method'].lower()
        
        # Mô tả request body
        req_properties = {
            "params": {
                "type": "object",
                "properties": {k: {"type": v.get("type", "string"), "example": v.get("sample_value")} for k, v in ep['request_params'].items()}
            },
            "datasets": {
                "type": "object",
                "properties": {ds_name: {
                    "type": "object",
                    "properties": {
                        "cols": {"type": "array", "items": {"type": "string"}, "example": ds.get("cols", [])},
                        "count": {"type": "integer", "example": ds.get("sample_count", 0)},
                        "rows": {"type": "array", "items": {"type": "array", "items": {"type": "string"}}}
                    }
                } for ds_name, ds in ep['request_datasets'].items()}
            }
        }

        # Mô tả response body
        res_properties = {
            "params": {
                "type": "object",
                "properties": {k: {"type": v.get("type", "string"), "example": v.get("sample_value")} for k, v in ep['response_params'].items()}
            },
            "datasets": {
                "type": "object",
                "properties": {ds_name: {
                    "type": "object",
                    "properties": {
                        "cols": {"type": "array", "items": {"type": "string"}, "example": ds.get("cols", [])},
                        "count": {"type": "integer", "example": ds.get("sample_count", 0)},
                        "rows": {"type": "array", "items": {"type": "array", "items": {"type": "string"}}}
                    }
                } for ds_name, ds in ep['response_datasets'].items()}
            }
        }

        paths[path_key] = {
            method: {
                "summary": f"{ep['action']} ({ep['module']})",
                "description": f"EMS Endpoint {ep['path']}. Thuộc phân hệ {ep['module']}, phân loại {ep['category']}. Đã ghi nhận {ep['total_calls']} cuộc gọi thực tế.",
                "tags": [ep['module'].upper()],
                "parameters": [
                    {
                        "name": "_ems_userId",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"}
                    }
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": req_properties
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Thành công từ EMS Server",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": res_properties
                                }
                            }
                        }
                    }
                }
            }
        }

    return {
        "openapi": "3.0.0",
        "info": {
            "title": "LG Display EMS Endpoints API Specification",
            "version": "1.0.0",
            "description": "Tự động trích xuất và chuẩn hóa từ log EMS qua file A1.txt"
        },
        "servers": [
            {"url": "http://ems.lgdisplay.com:9000", "description": "EMS Production Server (Internal)"},
            {"url": "http://localhost:8000", "description": "Local Mock Server"}
        ],
        "paths": paths
    }

def generate_postman_collection(analyzed_data):
    """Tạo Postman Collection v2.1 để người dùng import test ngay lập tức"""
    items = []
    # Nhóm theo module
    module_items = {}
    for ep in analyzed_data['endpoints']:
        m = ep['module'].upper()
        if m not in module_items:
            module_items[m] = []

        item = {
            "name": f"[{ep['category']}] {ep['action']}",
            "request": {
                "method": ep['method'],
                "header": [
                    {"key": "Content-Type", "value": "application/json", "type": "text"}
                ],
                "body": {
                    "mode": "raw",
                    "raw": json.dumps(ep['sample_request'] or {}, indent=2, ensure_ascii=False)
                },
                "url": {
                    "raw": "{{baseUrl}}/" + ep['path'],
                    "host": ["{{baseUrl}}"],
                    "path": ep['path'].split('/')
                },
                "description": f"Endpoint: {ep['url']}\nCategory: {ep['category']}\nTotal calls: {ep['total_calls']}"
            }
        }
        module_items[m].append(item)

    folders = []
    for mod_name, ep_items in module_items.items():
        folders.append({
            "name": mod_name,
            "item": ep_items
        })

    return {
        "info": {
            "name": "EMS API Endpoints Collection",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "variable": [
            {"key": "baseUrl", "value": "http://ems.lgdisplay.com:9000", "type": "string"}
        ],
        "item": folders
    }

def main():
    specified_file = sys.argv[1] if len(sys.argv) > 1 else None
    target_file = find_input_file(specified_file)

    if not target_file:
        print("[X] Lỗi: Không tìm thấy file A1.txt hoặc t1.txt!")
        print("    Vui lòng đặt file A1.txt vào thư mục làm việc hoặc truyền đường dẫn file vào tham số.")
        sys.exit(1)

    output_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(output_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    result = analyze_ems_file(target_file)

    # Ghi file analyzed_apis.json
    analyzed_path = os.path.join(data_dir, "analyzed_apis.json")
    with open(analyzed_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"[+] Đã lưu phân tích chi tiết vào: {analyzed_path}")

    # Ghi file OpenAPI 3.0
    openapi_spec = generate_openapi_spec(result)
    openapi_path = os.path.join(data_dir, "openapi.json")
    with open(openapi_path, "w", encoding="utf-8") as f:
        json.dump(openapi_spec, f, indent=2, ensure_ascii=False)
    print(f"[+] Đã lưu OpenAPI 3.0 Specification vào: {openapi_path}")

    # Ghi file Postman Collection
    postman_col = generate_postman_collection(result)
    postman_path = os.path.join(data_dir, "postman_collection.json")
    with open(postman_path, "w", encoding="utf-8") as f:
        json.dump(postman_col, f, indent=2, ensure_ascii=False)
    print(f"[+] Đã lưu Postman Collection vào: {postman_path}")

    # Tóm tắt
    meta = result['metadata']
    print("\n" + "="*50)
    print("           KẾT QUẢ PHÂN TÍCH API EMS")
    print("="*50)
    print(f"File nguồn              : {meta['source_file']}")
    print(f"Tổng ghi chú quét       : {meta['total_notes_scanned']}")
    print(f"Tổng số API calls       : {meta['total_api_calls_recorded']}")
    print(f"Số Endpoints duy nhất   : {meta['total_unique_endpoints']}")
    print(f"Số Datasets định danh   : {meta['total_unique_datasets']}")
    print(f"Thời gian phản hồi TB   : {meta['overall_avg_duration_ms']} ms")
    print("-" * 50)
    print("Phân bố theo Phân hệ (Modules):")
    for mod, count in result['groups']['by_module'].items():
        print(f"  • {mod:<20}: {count:2d} endpoints")
    print("-" * 50)
    print("Phân bố theo Nghiệp vụ (Category):")
    for cat, count in result['groups']['by_category'].items():
        print(f"  • {cat:<20}: {count:2d} endpoints")
    print("="*50)

if __name__ == "__main__":
    main()
