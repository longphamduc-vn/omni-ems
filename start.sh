#!/usr/bin/env bash
# ==============================================================================
# Omni-EMS: Run Script for Linux / WSL
# Khởi chạy đồng thời Mock Server (:9000) và FastAPI Workflow Engine (:8000)
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "========================================================================"
echo "⚡ [Omni-EMS] KHỞI CHẠY HỆ THỐNG TOÀN DIỆN (WSL / LINUX)"
echo "========================================================================"

# Tự động chạy setup nếu chưa cài đặt
if [ ! -d "$PROJECT_ROOT/mock-server/node_modules" ] || [ ! -d "$PROJECT_ROOT/workflow-engine/.venv" ]; then
    echo "⚠️  Chưa phát hiện môi trường đầy đủ. Đang tự động gọi ./setup.sh..."
    bash "$PROJECT_ROOT/setup.sh"
fi

# Hàm dọn dẹp khi nhấn Ctrl+C
cleanup() {
    echo ""
    echo "🛑 Đang tắt toàn bộ tiến trình Omni-EMS..."
    if [ -n "$MOCK_PID" ] && kill -0 "$MOCK_PID" 2>/dev/null; then
        kill "$MOCK_PID" 2>/dev/null || true
    fi
    if [ -n "$ENGINE_PID" ] && kill -0 "$ENGINE_PID" 2>/dev/null; then
        kill "$ENGINE_PID" 2>/dev/null || true
    fi
    wait 2>/dev/null || true
    echo "✅ Đã giải phóng toàn bộ port (:9000 & :8000). Tạm biệt!"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Khởi động Mock Server (:9000)
echo ""
echo "🚀 [1/2] Đang khởi động Mock Server tại port 9000..."
cd "$PROJECT_ROOT/mock-server"
node server.js &
MOCK_PID=$!

# Chờ Mock Server sẵn sàng
echo "   -> Đang kiểm tra kết nối Mock Server..."
for i in {1..15}; do
    if curl -s http://127.0.0.1:9000/health > /dev/null 2>&1; then
        echo "   ✓ Mock Server đã sẵn sàng tại http://127.0.0.1:9000"
        break
    fi
    sleep 1
done

# 2. Khởi động Workflow Engine (:8000)
echo ""
echo "🚀 [2/2] Đang khởi động FastAPI Workflow Engine tại port 8000..."
cd "$PROJECT_ROOT/workflow-engine"

# Kích hoạt venv nếu có, hoặc dùng conda/python hệ thống
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
ENGINE_PID=$!

echo ""
echo "========================================================================"
echo "🎉 HỆ THỐNG ĐÃ HOẠT ĐỘNG HOÀN TOÀN!"
echo "------------------------------------------------------------------------"
echo "  🖥️  Giao diện Demo 360°:   http://localhost:8000/"
echo "  📖  API Swagger Docs:       http://localhost:8000/docs"
echo "  🏢  Legacy EMS Mock Server: http://localhost:9000/health"
echo "  📊  API Dịch Thuật DB:      http://localhost:9000/api/translations"
echo "------------------------------------------------------------------------"
echo "  (Nhấn Ctrl+C để dừng toàn bộ hệ thống)"
echo "========================================================================"

wait $ENGINE_PID $MOCK_PID
