#!/usr/bin/env python3
"""
EMS API Analyzer Server
-----------------------
Máy chủ web phục vụ giao diện trực quan hóa và API phân tích Endpoints EMS.
"""

import os
import sys
import json
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")
DATA_DIR = os.path.join(BASE_DIR, "data")

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

class EMSHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def end_headers(self):
        # Cho phép CORS và không cache API
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/data":
            self.send_json_file(os.path.join(DATA_DIR, "analyzed_apis.json"))
            return
        elif path == "/api/openapi":
            self.send_json_file(os.path.join(DATA_DIR, "openapi.json"))
            return
        elif path == "/api/postman":
            self.send_json_file(os.path.join(DATA_DIR, "postman_collection.json"))
            return
        elif path == "/api/health":
            self.send_json({"status": "ok", "app": "EMS API Analyzer"})
            return

        # Phục vụ file tĩnh từ web/
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/reanalyze":
            try:
                # Chạy lại analyzer.py
                analyzer_script = os.path.join(BASE_DIR, "analyzer.py")
                cmd = [sys.executable, analyzer_script]
                proc = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True)
                if proc.returncode != 0:
                    self.send_json({"success": False, "error": proc.stderr}, status=500)
                    return
                # Đọc lại dữ liệu mới nhất
                analyzed_path = os.path.join(DATA_DIR, "analyzed_apis.json")
                with open(analyzed_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.send_json({"success": True, "output": proc.stdout, "data": data})
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, status=500)
            return

        self.send_error(404, "API endpoint not found")

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json_file(self, filepath):
        if not os.path.exists(filepath):
            self.send_json({"error": "File not generated yet. Please run analyzer.py"}, status=404)
            return
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

def run(port=8765):
    # Đảm bảo dữ liệu đã được phân tích trước
    analyzed_path = os.path.join(DATA_DIR, "analyzed_apis.json")
    if not os.path.exists(analyzed_path):
        print("[*] Chưa có dữ liệu phân tích, đang tự động chạy analyzer.py...")
        subprocess.run([sys.executable, os.path.join(BASE_DIR, "analyzer.py")], cwd=BASE_DIR)

    server_address = ('0.0.0.0', port)
    httpd = ThreadedHTTPServer(server_address, EMSHandler)
    print(f"\n=======================================================")
    print(f"🚀 EMS API Studio & Analyzer đang chạy tại:")
    print(f"👉 http://localhost:{port}")
    print(f"👉 http://127.0.0.1:{port}")
    print(f"=======================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Đang tắt server...")
        httpd.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    run(port)
