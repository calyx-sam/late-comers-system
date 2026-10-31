"""Root WSGI entrypoint for Vercel Flask service."""

from backend.index import app

if __name__ == "__main__":
    app.run()
