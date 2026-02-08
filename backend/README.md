# Backend API - DDR5 Power Calculator

FastAPI backend for DDR5 power calculations.

## Structure

```
backend/
├── src/              # API source code
│   ├── main.py      # FastAPI application
│   └── index.py     # Vercel entry point
├── tests/            # API tests
└── requirements.txt  # Dependencies
```

## Local Development

```bash
# Install core package first
cd core
pip install -e .

# Install backend dependencies
cd ../backend
pip install -r requirements.txt

# Run FastAPI server
uvicorn src.main:app --reload --port 8000
```

## API Endpoints

- `GET /` - Health check
- `GET /health` - Health check
- `POST /api/calculate/core` - Calculate core power
- `POST /api/calculate/interface` - Calculate interface power
- `POST /api/calculate/all` - Calculate all power components
- `POST /api/calculate/dimm` - Calculate DIMM power

## Testing

```bash
# Run backend tests
cd backend
pytest tests/ -v
```

## Dependencies

- fastapi>=0.104.0
- uvicorn[standard]>=0.24.0
- pydantic>=2.0.0
- mangum>=0.17.0
- Core package (installed separately)

