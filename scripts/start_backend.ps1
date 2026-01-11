param(
  [string]$Host = "0.0.0.0",
  [int]$Port = 8000
)
pip install -r requirements.txt
pip install -r api/requirements.txt
python -c "from api.database.database import init_db; init_db()"
uvicorn api.main:app --host $Host --port $Port --reload

