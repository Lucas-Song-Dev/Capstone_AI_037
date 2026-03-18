# Deployment

## Vercel (frontend + API)

The project deploys to Vercel with:

- **Frontend:** Next.js app (from `frontend/` or project root, depending on Vercel "Root Directory").
- **API:** Serverless functions from the root `api/` folder. `vercel.json` rewrites `/api/(.*)` to `/api/index`; `api/index.py` wraps the FastAPI app (from `api/main.py`) with Mangum.

**Important:** For the API to be deployed, the Vercel project root must include the `api/` folder. If "Root Directory" is set to `frontend`, the root `api/` is not deployed and `/api/*` will 404. In that case either:

- Set Root Directory to the repo root so both frontend and `api/` are included, or
- Deploy the API elsewhere (e.g. separate service) and remove the `/api` rewrite from `vercel.json`.

**Production CORS:** Set the `CORS_ORIGINS` environment variable in Vercel to your frontend URL (e.g. `https://your-app.vercel.app`) so the API only accepts requests from your app.

## Running the API locally

From the repo root:

```bash
cd core && pip install -e . && cd ..
cd api && pip install -r requirements.txt && uvicorn main:app --reload
```

API docs: http://localhost:8000/docs and http://localhost:8000/redoc.
