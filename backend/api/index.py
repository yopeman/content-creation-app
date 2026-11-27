import sys
from pathlib import Path

# Ensure the backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app as fastapi_app


async def app(scope, receive, send):
    """ASGI wrapper for Vercel Serverless Functions.

    When Vercel rewrites requests from '/(.*)' to '/api/index.py', the original
    URL requested by the client is stored in the 'x-matched-path' or 'x-forwarded-uri' header,
    while scope['path'] is rewritten to '/api/index.py'.
    This wrapper restores scope['path'] to the original path so FastAPI's router
    matches routes correctly instead of returning 404.
    """
    if scope.get("type") in ("http", "websocket"):
        headers = dict(scope.get("headers", []))

        # Check for original path headers populated by Vercel edge proxy
        matched_path = headers.get(b"x-matched-path", b"").decode("utf-8")
        forwarded_uri = headers.get(b"x-forwarded-uri", b"").decode("utf-8")

        target_path = matched_path or forwarded_uri
        current_path = scope.get("path", "")

        # If scope['path'] was rewritten to the file destination
        if current_path in ("/api/index.py", "/api/index", "/api", "/api/"):
            if target_path and target_path not in ("/api/index.py", "/api/index"):
                clean_path = target_path.split("?")[0]
                scope["path"] = clean_path
                if "raw_path" in scope:
                    scope["raw_path"] = clean_path.encode("utf-8")
            else:
                scope["path"] = "/"
                if "raw_path" in scope:
                    scope["raw_path"] = b"/"
        elif target_path and target_path != current_path:
            clean_path = target_path.split("?")[0]
            if clean_path:
                scope["path"] = clean_path
                if "raw_path" in scope:
                    scope["raw_path"] = clean_path.encode("utf-8")

    await fastapi_app(scope, receive, send)
