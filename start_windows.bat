@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ========================================================================
echo ⚡ [Omni-EMS] KHỞI CHẠY HỆ THỐNG TOÀN DIỆN (WINDOWS)
echo ========================================================================

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

:: Kiểm tra nếu chưa cài đặt thì gọi setup_windows.bat
if not exist "mock-server\node_modules\" (
    echo ⚠️  Chưa phát hiện node_modules trong mock-server. Đang tự động chạy setup...
    call "%PROJECT_ROOT%setup_windows.bat"
)

if not exist "workflow-engine\.venv\" (
    echo ⚠️  Chưa phát hiện môi trường Python .venv. Đang tự động chạy setup...
    call "%PROJECT_ROOT%setup_windows.bat"
)

echo.
echo 🚀 [1/2] Đang khởi động Mock Server tại port 9000...
start "Omni-EMS Mock Server (Port 9000)" cmd /k "cd /d %PROJECT_ROOT%mock-server && title Omni-EMS Mock Server (Port 9000) && node server.js"

echo.
echo 🚀 [2/2] Đang khởi động FastAPI Workflow Engine tại port 8000...
start "Omni-EMS Workflow Engine (Port 8000)" cmd /k "cd /d %PROJECT_ROOT%workflow-engine && title Omni-EMS Workflow Engine (Port 8000) && call .venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo ⏳ Đang chờ các dịch vụ khởi động trong giây lát...
timeout /t 3 > nul

echo.
echo 🌐 Đang tự động mở trình duyệt tới Giao diện Demo 360°...
start http://localhost:8000/

echo.
echo ========================================================================
echo 🎉 HỆ THỐNG ĐÃ HOẠT ĐỘNG HOÀN TOÀN!
echo ------------------------------------------------------------------------
echo   🖥️  Giao diện Demo 360°:   http://localhost:8000/
echo   📖  API Swagger Docs:       http://localhost:8000/docs
echo   🏢  Legacy EMS Mock Server: http://localhost:9000/health
echo   📊  API Dịch Thuật DB:      http://localhost:9000/api/translations
echo ------------------------------------------------------------------------
echo   Hai cửa sổ Command Prompt riêng biệt đã được mở cho Mock Server & Engine.
echo   Để dừng hệ thống, bạn chỉ cần đóng 2 cửa sổ Command Prompt đó.
echo ========================================================================
pause
