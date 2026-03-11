$ErrorActionPreference = "SilentlyContinue"
$root = Resolve-Path "$PSScriptRoot\.." | Select-Object -ExpandProperty Path
Set-Location $root

Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host "   GSL INTERPRETER - UNIFIED PRODUCTION SERVER" -ForegroundColor Yellow
Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Starting Unified Backend (FastAPI + React Frontend)..." -ForegroundColor Gray
Write-Host "   Port: 8000" -ForegroundColor Gray
Write-Host "   Note: ML Models (Whisper) take ~30s to load." -ForegroundColor Yellow
Write-Host ""

Start-Process -FilePath "powershell" -ArgumentList "-NoExit","-NoProfile","-ExecutionPolicy","Bypass","-Command",". .\.venv2\Scripts\Activate.ps1; python -m uvicorn api.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory $root

Write-Host "2. Starting ngrok Tunnel..." -ForegroundColor Gray
Write-Host "   Tunneling Port 8000 for Mobile Access" -ForegroundColor Gray
Write-Host ""

$ngrokPath = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit","-NoProfile","-ExecutionPolicy","Bypass","-Command","& '$ngrokPath' start --all --config '$PSScriptRoot\tunnel.yml'" -WorkingDirectory $root

Write-Host "SUCCESS: Unified server and tunnel starting." -ForegroundColor Green
Write-Host "Please wait ~45 seconds for models to load before refreshing your phone." -ForegroundColor Yellow
Write-Host "----------------------------------------------------" -ForegroundColor Cyan
