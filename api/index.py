"""
Vercel serverless entry for FastAPI.

Loads ``api/main.py`` by file path so ``import main`` never resolves to ``core/src/main.py``
(regardless of ``sys.path`` order from editable installs, e2e conftest, or other imports).
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

_api_dir = Path(__file__).resolve().parent
_main_path = _api_dir / "main.py"
_spec = importlib.util.spec_from_file_location("_ddr5_api_main", _main_path)
if _spec is None or _spec.loader is None:
    raise RuntimeError(f"Cannot load FastAPI app from {_main_path}")
_main_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_main_mod)
app = _main_mod.app

__all__ = ["app"]
