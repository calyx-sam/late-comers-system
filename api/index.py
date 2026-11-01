"""Vercel serverless function entrypoint for /api routes."""

import sys
import os
import importlib.util

# Ensure backend directory is in sys.path for internal imports
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Load backend/index.py directly to avoid circular import when this module is named 'index'
backend_index_path = os.path.join(backend_dir, "index.py")
spec = importlib.util.spec_from_file_location("backend_index", backend_index_path)
backend_module = importlib.util.module_from_spec(spec)
sys.modules["backend_index"] = backend_module
spec.loader.exec_module(backend_module)

app = backend_module.app

if __name__ == "__main__":
    app.run()
