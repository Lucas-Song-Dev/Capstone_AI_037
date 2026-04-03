"""
Vercel serverless entry for FastAPI.

The Python runtime invokes the ASGI ``app`` in this module. ``api/main.py`` must be imported
before ``core/src`` is on ``sys.path`` — otherwise ``from main import app`` resolves to
``core/src/main.py`` (wrong module).
"""

import sys
from pathlib import Path

_api_dir = Path(__file__).resolve().parent
if str(_api_dir) not in sys.path:
    sys.path.insert(0, str(_api_dir))

from main import app  # noqa: E402 — api/main.py; adds core/src and builds FastAPI app

__all__ = ["app"]
