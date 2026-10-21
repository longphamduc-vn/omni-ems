@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ========================================================================
echo 🚀 [Omni-EMS] BẮT ĐẦU CÀI ĐẶT MÔI TRƯỜNG DỰ ÁN TRÊN WINDOWS
echo ========================================================================

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

:: 1. Kiểm tra Node.js
echo.
echo 📦 1. Kiểm tra Node.js và cài đặt dependencies cho Mock Server...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Lỗi: Node.js chưa được cài đặt hoặc chưa thêm vào PATH!
    echo    Vui lòng tải và cài đặt Node.js từ: https://nodejs.org/ (Khuyến nghị bản LTS)
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo    ✓ Đã tìm thấy Node.js: %NODE_VER%

cd /d "%PROJECT_ROOT%mock-server"
if not exist "node_modules\" (
    echo    -> Đang chạy 'npm install' trong mock-server...
    call npm install
) else (
    echo    ✓ Thư mục node_modules đã tồn tại trong mock-server.
)

:: Khởi tạo CSDL nếu chưa có
if not exist "db\ems.db" (
    echo    -> Đang khởi tạo cơ sở dữ liệu SQLite mock-server\db\ems.db...
    node -e "require('./db/database').reset()"
)
echo    ✓ Cơ sở dữ liệu SQLite EMS đã sẵn sàng.

:: 2. Kiểm tra Python
echo.
echo 🐍 2. Kiểm tra Python và cài đặt dependencies cho Workflow Engine...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Lỗi: Python chưa được cài đặt hoặc chưa thêm vào PATH!
    echo    Vui lòng tải và cài đặt Python (>= 3.10) từ: https://www.python.org/
    echo    (Lưu ý: Tích chọn "Add python.exe to PATH" khi cài đặt)
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PY_VER=%%i
echo    ✓ Đã tìm thấy: %PY_VER%

cd /d "%PROJECT_ROOT%workflow-engine"
if not exist ".venv\" (
    echo    -> Đang tạo môi trường ảo Python (.venv)...
    python -m venv .venv
)

echo    -> Kích hoạt .venv và cài đặt thư viện từ requirements.txt...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo    ✓ Dependencies Python đã cài đặt thành công.

echo.
echo ========================================================================
echo ✅ [Omni-EMS] CÀI ĐẶT HOÀN TẤT THÀNH CÔNG TRÊN WINDOWS!
echo    Để khởi chạy toàn bộ hệ thống, hãy chạy: start_windows.bat
echo ========================================================================
pause
