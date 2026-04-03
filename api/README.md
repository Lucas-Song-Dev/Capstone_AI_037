# API (FastAPI + Vercel serverless)

This folder contains the DDR5 Power Calculator API and its **Vercel serverless entry**.

- **`main.py`** — FastAPI app (routes, CORS, core integration).
- **`index.py`** — Vercel serverless entry: imports `app` from **`main.py` in this folder** (it must not put `core/src` on `sys.path` first, or `main` resolves to `core/src/main.py` by mistake).

Run locally: `uvicorn main:app --reload` from the `api/` directory (with `core` installed).

**Docs:** When the API is running, OpenAPI docs are at `/docs` and ReDoc at `/redoc`.

**CORS:** Set `CORS_ORIGINS` to your frontend origin(s) in production (e.g. `https://your-app.vercel.app`); default is `*` for development.
