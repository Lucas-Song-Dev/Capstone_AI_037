# DDR5 Power Calculator

JEDEC-compliant DDR5 power modeling and calculation tool with Next.js frontend and FastAPI API.

## Project Structure

```
.
├── core/                    # Python package (core calculations)
│   ├── src/                # Package source code
│   ├── tests/              # Unit tests
│   ├── verif/              # Verification tests
│   └── workloads/          # Test data
├── api/                     # FastAPI API + Vercel serverless entry
│   ├── main.py             # API application
│   ├── index.py            # Vercel serverless handler (Mangum)
│   └── tests/              # API tests
├── frontend/                # Next.js frontend
│   ├── src/                # Frontend source
│   └── tests/              # Frontend tests
└── tests/                   # End-to-end tests
    └── e2e/                 # Full stack integration tests
```

## Quick Start

### Core Package

```bash
cd core
pip install -e .
python test_regression.py
```

### API

```bash
# Install core first
cd core && pip install -e . && cd ..

# Install API dependencies
cd api
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Testing

Each component has its own test suite:

- **Core**: `cd core && pytest tests/`
- **API**: `cd api && pytest tests/`
- **Frontend**: `cd frontend && npm test`
- **E2E**: `pytest tests/e2e/`

## Deployment

The project is configured for Vercel deployment from the `fullstack` branch.

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Development

### Core Package Development

Work directly in `core/src/`. The package can be installed with `pip install -e core/`.

### API Development

Work in `api/`. The API imports the core package.

### Frontend Development

Work in `frontend/src/`. The frontend runs power calculations client-side by default; the API is available for optional or programmatic use (e.g. when `NEXT_PUBLIC_USE_API` or API URL is set).

## GitHub Actions

- `core-test.yml` - Tests core package
- `backend-test.yml` - Tests API (api/)
- `frontend-test.yml` - Tests frontend
- `e2e-test.yml` - Tests full stack integration

## License

[Your License Here]
