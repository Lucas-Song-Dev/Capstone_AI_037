"""
Vercel serverless entry for FastAPI.

The Python runtime invokes the ASGI ``app`` in this module (same pattern as Vercel’s FastAPI
template). The platform calls ASGI directly; no Lambda-style adapter is required.
"""

import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root / "core" / "src"))

from main import app  # noqa: E402

__all__ = ["app"]
