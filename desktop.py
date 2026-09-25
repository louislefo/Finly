import os
import sys

def get_resource_path(relative_path: str) -> str:
    """Get absolute path to resource, works for dev and for PyInstaller."""
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

# Ensure backend directory is in sys.path before any backend imports
backend_dir = get_resource_path("backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import io

# Setup persistent application logging
def get_log_file_path() -> str:
    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        log_dir = os.path.join(base, "Finly")
    elif sys.platform == "darwin":
        log_dir = os.path.expanduser("~/Library/Application Support/Finly")
    else:
        log_dir = os.path.expanduser("~/.local/share/finly")
    try:
        os.makedirs(log_dir, exist_ok=True)
    except Exception:
        pass
    return os.path.join(log_dir, "finly.log")

class DualLogger:
    def __init__(self, log_path: str):
        self.terminal = sys.stdout
        self._encoding = getattr(self.terminal, "encoding", "utf-8") or "utf-8"
        try:
            self.log_file = open(log_path, "a", encoding="utf-8", buffering=1)
        except Exception:
            self.log_file = None

    @property
    def encoding(self):
        return self._encoding

    def isatty(self) -> bool:
        if self.terminal and hasattr(self.terminal, "isatty"):
            try:
                return self.terminal.isatty()
            except Exception:
                return False
        return False

    def write(self, message):
        if self.terminal and hasattr(self.terminal, "write"):
            try:
                self.terminal.write(message)
            except Exception:
                pass
        if self.log_file:
            try:
                self.log_file.write(message)
                self.log_file.flush()
            except Exception:
                pass
        return len(message) if isinstance(message, str) else 0

    def flush(self):
        if self.terminal and hasattr(self.terminal, "flush"):
            try:
                self.terminal.flush()
            except Exception:
                pass
        if self.log_file:
            try:
                self.log_file.flush()
            except Exception:
                pass

log_file_path = get_log_file_path()
dual_logger = DualLogger(log_file_path)
sys.stdout = dual_logger
sys.stderr = dual_logger

import socket
import threading
import time
import uvicorn
import webview
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

# Import backend FastAPI app at top level for PyInstaller AST dependency tracing
from app.main import app as fastapi_app

# Identify frontend static files directory
frontend_dist_dir = get_resource_path(os.path.join("finly-app", "out"))
if not os.path.exists(frontend_dist_dir):
    frontend_dist_dir = get_resource_path("out")


def find_free_port(start_port: int = 8000, max_port: int = 65535) -> int:
    """Find an available TCP port starting from start_port to prevent port collisions."""
    for port in range(start_port, max_port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            result = sock.connect_ex(("127.0.0.1", port))
            if result != 0:
                return port
    return start_port


def wait_for_server(host: str, port: int, timeout: float = 10.0) -> bool:
    """Poll TCP port until server is ready."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                return True
        except (OSError, ConnectionRefusedError):
            time.sleep(0.1)
    return False


def setup_spa_mount(app: FastAPI, static_dir: str):
    """Mount Next.js static export with SPA routing and asset serving."""
    if not os.path.exists(static_dir):
        return

    # Mount _next static assets if folder exists
    next_static_dir = os.path.join(static_dir, "_next")
    if os.path.exists(next_static_dir):
        app.mount("/_next", StaticFiles(directory=next_static_dir), name="next_static")

    @app.get("/{full_path:path}")
    async def serve_static_or_spa(full_path: str):
        # Ignore API routes to allow FastAPI 404 handler
        if full_path.startswith("api/") or full_path == "api" or full_path.startswith("docs") or full_path == "openapi.json":
            raise StarletteHTTPException(status_code=404, detail="Not Found")

        # 1. Direct file match
        clean_rel = full_path.strip("/")
        target_path = os.path.join(static_dir, clean_rel.replace("/", os.sep))

        if os.path.isfile(target_path):
            return FileResponse(target_path)

        # 2. Directory with index.html (Next.js trailingSlash: true)
        dir_index = os.path.join(target_path, "index.html")
        if os.path.isfile(dir_index):
            return FileResponse(dir_index)

        # 3. Path + .html
        html_candidate = f"{target_path}.html"
        if os.path.isfile(html_candidate):
            return FileResponse(html_candidate)

        # 4. Root index fallback (SPA)
        root_index = os.path.join(static_dir, "index.html")
        if os.path.isfile(root_index):
            return FileResponse(root_index)

        raise StarletteHTTPException(status_code=404, detail="File Not Found")


def run_uvicorn(server: uvicorn.Server):
    """Run uvicorn server in a dedicated background daemon thread."""
    server.run()


def main():
    # Mount frontend static files onto FastAPI app
    setup_spa_mount(fastapi_app, frontend_dist_dir)

    # Find an open port (avoids collision if 8000 is in use)
    selected_port = find_free_port(8000)

    # Configure Uvicorn server
    config = uvicorn.Config(
        app=fastapi_app,
        host="127.0.0.1",
        port=selected_port,
        log_level="warning",
        access_log=False,
        use_colors=False,
    )
    server = uvicorn.Server(config)

    # Start server in background thread
    server_thread = threading.Thread(target=run_uvicorn, args=(server,), daemon=True)
    server_thread.start()

    # Wait for server to be responsive
    wait_for_server("127.0.0.1", selected_port)

    # Create PyWebView window pointing to the combined FastAPI + Frontend port
    app_url = f"http://127.0.0.1:{selected_port}"
    window = webview.create_window(
        title="Finly",
        url=app_url,
        width=1320,
        height=880,
        min_size=(960, 640),
        text_select=False,
        confirm_close=False,
    )

    def on_window_closed():
        server.should_exit = True

    window.events.closed += on_window_closed

    # Determine GUI engine: Cocoa for macOS, GTK for Linux, EdgeChromium for Windows
    gui_engine = "cocoa" if sys.platform == "darwin" else ("gtk" if sys.platform.startswith("linux") else "edgechromium")
    try:
        webview.start(gui=gui_engine, debug=False)
    except Exception:
        # Fallback to default engine auto-detection if specific engine fails
        webview.start(debug=False)

    # Clean shutdown
    server.should_exit = True
    sys.exit(0)


if __name__ == "__main__":
    main()
