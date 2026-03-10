"""
Vercel serverless function entry point for FastAPI.

Vercel expects a handler function that receives a request object.
"""

# Vercel serverless function entry point
import sys
from pathlib import Path

# Add core/src to path
project_root = Path(__file__).parent.parent
core_src_path = project_root / "core" / "src"
sys.path.insert(0, str(core_src_path))

# main.py is in the same directory (api/)
from main import app
from mangum import Mangum

# Wrap FastAPI app with Mangum for AWS Lambda/Vercel compatibility
handler = Mangum(app, lifespan="off")

