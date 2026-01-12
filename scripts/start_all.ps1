$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent (Resolve-Path "$PSScriptRoot\..")
Set-Location $root
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command",". .\.venv\Scripts\Activate.ps1; $env:COLLECT_SAMPLES='true'; python -m uvicorn api.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory $root
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command","npx pnpm@8.15.8 run dev" -WorkingDirectory $root

