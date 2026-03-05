# GSL Interpreter — Mobile Tunnel Script
# Run this AFTER start_all.ps1 has both servers running (ports 5173 + 8000)
#
# FIRST TIME SETUP:
#   1. Sign up free at https://ngrok.com
#   2. Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken
#   3. Run once: ngrok config add-authtoken YOUR_TOKEN_HERE
#
# Then just run this script:

$ngrokPath = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"

Write-Host "Starting ngrok tunnel for GSL Interpreter..." -ForegroundColor Cyan
Write-Host "Frontend and Backend are now UNIFIED on port 8000!" -ForegroundColor Gray
Write-Host ""
Write-Host "Open the single HTTPS URL below on your phone." -ForegroundColor Green
Write-Host "Camera access (WebRTC) is supported natively!" -ForegroundColor Green
Write-Host ""

& $ngrokPath start --all --config "$PSScriptRoot\tunnel.yml"
