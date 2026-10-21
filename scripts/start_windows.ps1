# ==============================================================================
# Omni-EMS: Run Script for Windows PowerShell
# ==============================================================================

$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = Get-Location }

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "⚡ [Omni-EMS] KHỞI CHẠY HỆ THỐNG TOÀN DIỆN (POWERSHELL)" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# 1. Khởi động Mock Server
Write-Host "`n🚀 [1/2] Đang khởi động Mock Server tại port 9000..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "cd /d `"$ProjectRoot\mock-server`" && title Omni-EMS Mock Server (Port 9000) && node server.js"

# 2. Khởi động Workflow Engine
Write-Host "`n🚀 [2/2] Đang khởi động FastAPI Workflow Engine tại port 8000..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "cd /d `"$ProjectRoot\workflow-engine`" && title Omni-EMS Workflow Engine (Port 8000) && call .venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

Start-Sleep -Seconds 3

# 3. Mở trình duyệt
Start-Process "http://localhost:8000/"

Write-Host "`n========================================================================" -ForegroundColor Green
Write-Host "🎉 HỆ THỐNG ĐÃ HOẠT ĐỘNG HOÀN TOÀN!" -ForegroundColor Green
Write-Host "------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  🖥️  Giao diện Demo 360°:   http://localhost:8000/" -ForegroundColor Cyan
Write-Host "  📖  API Swagger Docs:       http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "  🏢  Legacy EMS Mock Server: http://localhost:9000/health" -ForegroundColor Cyan
Write-Host "  📊  API Dịch Thuật DB:      http://localhost:9000/api/translations" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  Đã mở 2 cửa sổ chạy nền. Đóng 2 cửa sổ để dừng hệ thống." -ForegroundColor Yellow
Write-Host "========================================================================" -ForegroundColor Green
