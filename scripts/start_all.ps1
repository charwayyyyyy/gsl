$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent (Resolve-Path "$PSScriptRoot\..")
Set-Location $root
Start-Process -FilePath "powershell" -ArgumentList "-NoExit","-NoProfile","-ExecutionPolicy","Bypass","-Command",". .\.venv2\Scripts\Activate.ps1; `$env:COLLECT_SAMPLES='true'; python -m uvicorn api.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory $root
Start-Process -FilePath "powershell" -ArgumentList "-NoExit","-NoProfile","-ExecutionPolicy","Bypass","-Command","npx pnpm@8.15.8 run dev" -WorkingDirectory $root
