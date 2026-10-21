#!/usr/bin/env bash
# ==============================================================================
# Omni-EMS: Setup Script for Linux / WSL
# Cài đặt toàn bộ môi trường cho Mock Server (Node.js) & Workflow Engine (Python)
# ==============================================================================

set -e

# Chuyển về thư mục gốc của dự án
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "========================================================================"
echo "🚀 [Omni-EMS] BẮT ĐẦU CÀI ĐẶT MÔI TRƯỜNG DỰ ÁN (WSL / LINUX)"
echo "========================================================================"

# 1. Kiểm tra Node.js & npm cho Mock Server
echo ""
echo "📦 1. Kiểm tra Node.js & Cài đặt dependencies cho Mock Server..."
if ! command -v node &> /dev/null; then
    echo "❌ Lỗi: Node.js chưa được cài đặt. Vui lòng cài Node.js (khuyến nghị >= 20.x):"
    echo "   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    echo "   sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "   ✓ Node.js version: $NODE_VERSION"

cd "$PROJECT_ROOT/mock-server"
if [ ! -d "node_modules" ]; then
    echo "   -> Đang chạy 'npm install' trong mock-server/..."
    npm install
else
    echo "   ✓ node_modules đã tồn tại trong mock-server/."
fi

# Khởi tạo cơ sở dữ liệu nếu chưa có
if [ ! -f "db/ems.db" ]; then
    echo "   -> Đang khởi tạo cơ sở dữ liệu SQLite mock-server/db/ems.db..."
    node -e "require('./db/database').reset()"
fi
echo "   ✓ Cơ sở dữ liệu SQLite EMS đã sẵn sàng."

# 2. Kiểm tra Python & Cài đặt virtualenv cho Workflow Engine
echo ""
echo "🐍 2. Kiểm tra Python & Cài đặt dependencies cho Workflow Engine..."

PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Lỗi: Python chưa được cài đặt. Vui lòng cài Python (>= 3.10):"
    echo "   sudo apt update && sudo apt install -y python3 python3-venv python3-pip"
    exit 1
fi

PY_VERSION=$($PYTHON_CMD --version)
echo "   ✓ Python version: $PY_VERSION"

cd "$PROJECT_ROOT/workflow-engine"
if [ ! -d ".venv" ]; then
    echo "   -> Đang tạo môi trường ảo Python (.venv)..."
    $PYTHON_CMD -m venv .venv
fi

echo "   -> Kích hoạt .venv và cài đặt dependencies..."
source .venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo "   ✓ Dependencies Python đã cài đặt thành công."

echo ""
echo "========================================================================"
echo "✅ [Omni-EMS] CÀI ĐẶT HOÀN TẤT THÀNH CÔNG!"
echo "   Để khởi chạy toàn bộ hệ thống, hãy gõ lệnh:"
echo "   ./start.sh"
echo "========================================================================"
