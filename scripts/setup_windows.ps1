# ==============================================================================
# Omni-EMS: Setup Script for Windows PowerShell
# ==============================================================================

$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = Get-Location }

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "🚀 [Omni-EMS] BẮT ĐẦU CÀI ĐẶT MÔI TRƯỜNG DỰ ÁN (POWERSHELL)" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# 1. Kiểm tra Node.js
Write-Host "`n📦 1. Kiểm tra Node.js & Cài đặt dependencies cho Mock Server..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Lỗi: Node.js chưa được cài đặt. Vui lòng tải từ https://nodejs.org/" -ForegroundColor Red
    Exit 1
}

$NodeVer = node -v
Write-Host "   ✓ Node.js version: $NodeVer" -ForegroundColor Green

Set-Location "$ProjectRoot\mock-server"
if (-not (Test-Path "node_modules")) {
    Write-Host "   -> Đang chạy 'npm install' trong mock-server..."
    npm install
} else {
    Write-Host "   ✓ node_modules đã tồn tại trong mock-server." -ForegroundColor Green
}

if (-not (Test-Path "db\ems.db")) {
    Write-Host "   -> Đang khởi tạo cơ sở dữ liệu SQLite..."
    node -e "require('./db/database').reset()"
}
Write-Host "   ✓ Cơ sở dữ liệu SQLite EMS đã sẵn sàng." -ForegroundColor Green

# 2. Kiểm tra Python
Write-Host "`n🐍 2. Kiểm tra Python & Cài đặt dependencies cho Workflow Engine..." -ForegroundColor Yellow
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Lỗi: Python chưa được cài đặt. Vui lòng tải từ https://www.python.org/" -ForegroundColor Red
    Exit 1
}

$PyVer = python --version
Write-Host "   ✓ Python version: $PyVer" -ForegroundColor Green

Set-Location "$ProjectRoot\workflow-engine"
if (-not (Test-Path ".venv")) {
    Write-Host "   -> Đang tạo môi trường ảo Python (.venv)..."
    python -m venv .venv
}

Write-Host "   -> Kích hoạt .venv và cài đặt dependencies..."
& ".\.venv\Scripts\Activate.ps1"
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
Write-Host "   ✓ Dependencies Python đã cài đặt thành công." -ForegroundColor Green

Set-Location $ProjectRoot
Write-Host "`n========================================================================" -ForegroundColor Green
Write-Host "✅ [Omni-EMS] CÀI ĐẶT HOÀN TẤT THÀNH CÔNG!" -ForegroundColor Green
Write-Host "   Để khởi chạy: .\scripts\start_windows.ps1 hoặc .\start_windows.bat" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Green
