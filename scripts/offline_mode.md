Offline Fallback

- Backend switches to offline when env var OFFLINE_MODE=1
- Embeddings and JSON chunks are loaded from local data/ directory
- No cloud sync attempted

Usage

Windows PowerShell:

```powershell
$env:OFFLINE_MODE = "1"
python scripts/init_sqlite.py
powershell -File scripts/start_backend.ps1
```

