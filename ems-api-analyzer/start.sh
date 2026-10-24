#!/usr/bin/env bash
# Khởi động EMS API Studio & Analyzer

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PORT="${1:-8765}"

echo "=========================================================="
echo "          ⚡ KHỞI ĐỘNG EMS API STUDIO & ANALYZER          "
echo "=========================================================="

# Kiểm tra file A1.txt
if [ -f "$DIR/../A1.txt" ]; then
    INPUT_FILE="$DIR/../A1.txt"
elif [ -f "$DIR/A1.txt" ]; then
    INPUT_FILE="$DIR/A1.txt"
else
    echo "[!] Không tìm thấy A1.txt, tìm kiếm t1.txt..."
    if [ -f "$DIR/../t1.txt" ]; then
        cp "$DIR/../t1.txt" "$DIR/../A1.txt"
        INPUT_FILE="$DIR/../A1.txt"
        echo "[+] Đã tạo A1.txt từ t1.txt"
    else
        echo "[X] Lỗi: Không tìm thấy file A1.txt!"
        exit 1
    fi
fi

echo "[*] File dữ liệu nguồn: $INPUT_FILE"

# Chạy phân tích
echo "[*] Đang phân tích và trích xuất cấu trúc API..."
python3 "$DIR/analyzer.py" "$INPUT_FILE"

# Khởi động server
echo ""
echo "[*] Đang khởi động web server tại cổng $PORT..."
python3 "$DIR/server.py" "$PORT"
