"""
E2E-style contract tests: repository matches the unified Vercel (Next + Python) layout.

These do not call Vercel APIs; they assert local files and vercel.json stay aligned with DEPLOYMENT.md.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


@pytest.fixture
def vercel_json() -> dict:
    path = PROJECT_ROOT / "vercel.json"
    assert path.is_file(), "Root vercel.json required for unified deploy (see DEPLOYMENT.md)"
    return json.loads(path.read_text(encoding="utf-8"))


def test_vercel_json_nextjs_build_from_frontend(vercel_json: dict) -> None:
    assert vercel_json.get("framework") == "nextjs"
    assert vercel_json.get("outputDirectory") == "frontend/.next"
    install = vercel_json.get("installCommand", "")
    build = vercel_json.get("buildCommand", "")
    assert "frontend" in install and "npm" in install
    assert "frontend" in build and "npm run build" in build


def test_vercel_json_api_rewrite_to_serverless_index(vercel_json: dict) -> None:
    rewrites = vercel_json.get("rewrites") or []
    match = next(
        (
            r
            for r in rewrites
            if r.get("source") == "/api/(.*)" and r.get("destination") == "/api/index"
        ),
        None,
    )
    assert match is not None, "Expected rewrite /api/(.*) -> /api/index for FastAPI serverless entry"


def test_vercel_json_python_function_config(vercel_json: dict) -> None:
    functions = vercel_json.get("functions") or {}
    idx = functions.get("api/index.py")
    assert isinstance(idx, dict) and "maxDuration" in idx, "api/index.py should set maxDuration for long batched calls"


def test_api_serverless_entry_exposes_asgi_app() -> None:
    index_py = PROJECT_ROOT / "api" / "index.py"
    text = index_py.read_text(encoding="utf-8")
    assert "from main import app" in text
    assert "Mangum" not in text
    # Load like Vercel: must resolve api/main.py (FastAPI), not core/src/main.py (CLI).
    for key in list(sys.modules):
        if key in ("main", "index", "api.main", "api.index"):
            del sys.modules[key]
    spec = importlib.util.spec_from_file_location("_vercel_index_test", index_py)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert getattr(mod.app, "title", None) == "DDR5 Power Calculator API"


def test_api_index_imports_main_app() -> None:
    text = (PROJECT_ROOT / "api" / "index.py").read_text(encoding="utf-8")
    assert "from main import app" in text


def test_core_src_on_disk_for_api_bundle() -> None:
    assert (PROJECT_ROOT / "core" / "src" / "ddr5.py").is_file()
    assert (PROJECT_ROOT / "api" / "main.py").is_file()


def test_frontend_next_config_exists() -> None:
    cfg = PROJECT_ROOT / "frontend" / "next.config.js"
    assert cfg.is_file()
    body = cfg.read_text(encoding="utf-8")
    assert "rewrites" in body, "Dev proxy rewrites expected for local /api -> FastAPI"


def test_frontend_package_json() -> None:
    pkg = PROJECT_ROOT / "frontend" / "package.json"
    assert pkg.is_file()
    data = json.loads(pkg.read_text(encoding="utf-8"))
    assert "next" in (data.get("dependencies") or {})

