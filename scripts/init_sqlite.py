import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))
from api.database.database import init_db

if __name__ == "__main__":
    init_db()
    print("SQLite initialized")

