"""Vercel serverless function entrypoint for /api routes."""

import sys
import os

# Ensure project root is in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.index import app

if __name__ == "__main__":
    app.run()
