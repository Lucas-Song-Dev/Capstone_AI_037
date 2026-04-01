# Deployment

## Vercel (frontend + API)

The project deploys to Vercel with:

- **Frontend:** Next.js app in [`frontend/`](frontend/). The root [`vercel.json`](vercel.json) sets `installCommand`, `buildCommand`, and `outputDirectory` so builds run **from the repository root** without a root-level `package.json`.
- **API:** Serverless functions from the root [`api/`](api/) folder. `vercel.json` rewrites `/api/(.*)` to `/api/index`; [`api/index.py`](api/index.py) wraps the FastAPI app (from [`api/main.py`](api/main.py)) with Mangum.
- **Core:** The API imports Python modules from [`core/src`](core/src). The repo root must be deployed so `core/` is available to the serverless bundle (Vercel includes the project tree under the configured root).

### Required: Vercel project root = repository root

| Setting | Value |
|--------|--------|
| **Root Directory** | `.` (repository root — the folder that contains `api/`, `core/`, and `frontend/`) |

If Root Directory is set to **`frontend`**, Vercel will not see the root [`api/`](api/) or [`core/`](core/) folders, Python routes will not deploy, and `/api/*` will 404 or hit the wrong target. In that case either:

- Point Root Directory at the **repo root** and rely on the root [`vercel.json`](vercel.json) build commands for Next.js, **or**
- Deploy the API elsewhere and set `NEXT_PUBLIC_API_URL` on the frontend to that API’s base URL (and adjust/remove the `/api` rewrite as needed).

**Production CORS:** Set the `CORS_ORIGINS` environment variable in Vercel to your frontend URL (e.g. `https://your-app.vercel.app`) so the API only accepts requests from your app.

**Separate frontend-only deploy:** If you only deploy [`frontend/`](frontend/), set `NEXT_PUBLIC_API_URL` to your FastAPI base URL (including scheme, no trailing slash). Same-origin `/api/...` calls will not reach Python unless you proxy or merge deployments.

## Running the API locally

From the repo root:

```bash
cd core && pip install -e . && cd ..
cd api && pip install -r requirements.txt && uvicorn main:app --reload
```

API docs: http://localhost:8000/docs and http://localhost:8000/redoc.

### Smoke test (deployed or local)

After deployment, or with `uvicorn` running locally:

```bash
# Windows PowerShell
$env:API_URL = "https://your-app.vercel.app"
python api/scripts/smoke_deploy.py

# Unix / Git Bash
export API_URL=https://your-app.vercel.app
python api/scripts/smoke_deploy.py
```

Omit `API_URL` to default to `http://127.0.0.1:8000`. The script calls `GET /api/health` (or `GET /health`) and `POST /api/calculate/core` with the same sample payload as [`api/tests/conftest.py`](api/tests/conftest.py).
