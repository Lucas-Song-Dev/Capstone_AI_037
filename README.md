# DDR5 Power Calculator

JEDEC-compliant DDR5 power modeling and calculation tool with Next.js frontend and FastAPI backend.

## Project Structure

```
.
├── core/                    # Python package (core calculations)
│   ├── src/                # Package source code
│   ├── tests/              # Unit tests
│   ├── verif/              # Verification tests
│   └── workloads/          # Test data
├── backend/                 # FastAPI API
│   ├── src/                # API source code
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

### Backend API

```bash
# Install core first
cd core && pip install -e . && cd ..

# Install backend dependencies
cd backend
pip install -r requirements.txt
uvicorn src.main:app --reload
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
- **Backend**: `cd backend && pytest tests/`
- **Frontend**: `cd frontend && npm test`
- **E2E**: `pytest tests/e2e/`

## Deployment

The project is configured for Vercel deployment from the `fullstack` branch.

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Development

### Core Package Development

Work directly in `core/src/`. The package can be installed with `pip install -e core/`.

### Backend Development

Work in `backend/src/`. The backend imports the core package.

### Frontend Development

Work in `frontend/src/`. The frontend calls backend API endpoints.

## GitHub Actions

- `core-test.yml` - Tests core package
- `backend-test.yml` - Tests backend API
- `frontend-test.yml` - Tests frontend
- `e2e-test.yml` - Tests full stack integration

## License

[Your License Here]
