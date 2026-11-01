"""Vercel serverless function entrypoint for /api routes."""

import sys
import os

# Ensure backend directory is in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from index import app

if __name__ == "__main__":
    app.run()
