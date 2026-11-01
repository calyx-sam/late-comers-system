"""Root WSGI entrypoint for Vercel Flask service."""

import os
import sys
import importlib.util

_backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Load backend/index.py directly to avoid circular import when this module is named 'index'
_backend_index_path = os.path.join(_backend_dir, "index.py")
_spec = importlib.util.spec_from_file_location("backend_index", _backend_index_path)
_backend_module = importlib.util.module_from_spec(_spec)
sys.modules["backend_index"] = _backend_module
_spec.loader.exec_module(_backend_module)

app = _backend_module.app

if __name__ == "__main__":
    app.run()
