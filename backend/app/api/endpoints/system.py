import os
import sys
import time
import tempfile
import threading
import subprocess
import httpx
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()

# In-memory release cache to avoid GitHub rate-limiting
_release_cache: Dict[str, Any] = {
    "timestamp": 0,
    "data": None,
}
CACHE_TTL_SECONDS = 300  # 5 minutes

# Background download state tracker
_download_state: Dict[str, Any] = {
    "status": "idle",  # "idle" | "downloading" | "ready" | "error"
    "progress_percent": 0,
    "downloaded_bytes": 0,
    "total_bytes": 0,
    "error_message": None,
    "file_path": None,
    "version": None,
}


class VersionCheckResponse(BaseModel):
    current_version: str
    latest_version: str
    has_update: bool
    release_title: Optional[str] = None
    release_notes: Optional[str] = None
    release_url: Optional[str] = None
    published_at: Optional[str] = None
    download_url: Optional[str] = None
    platform: str
    is_desktop: bool
    is_container: bool
    container_update_cmd: str = "docker compose pull && docker compose up -d"


class UpdateDownloadStatusResponse(BaseModel):
    status: str
    progress_percent: int
    downloaded_bytes: int
    total_bytes: int
    error_message: Optional[str] = None
    version: Optional[str] = None


def parse_version_tuple(version_str: str) -> tuple:
    """Parse version string into integer tuple for robust comparison."""
    clean = version_str.strip().lstrip("v").lstrip("V")
    parts = []
    for segment in clean.split("."):
        numeric = ""
        for char in segment:
            if char.isdigit():
                numeric += char
            else:
                break
        parts.append(int(numeric) if numeric else 0)
    return tuple(parts) if parts else (0, 0, 0)


def is_running_in_container() -> bool:
    """Detect if running inside a Docker or OCI container."""
    if os.environ.get("IS_DOCKER") or os.environ.get("CONTAINER"):
        return True
    if os.path.exists("/.dockerenv"):
        return True
    try:
        if os.path.exists("/proc/1/cgroup"):
            with open("/proc/1/cgroup", "rt") as f:
                content = f.read()
                if "docker" in content or "kubepods" in content or "containerd" in content:
                    return True
    except Exception:
        pass
    return False


def is_running_in_desktop() -> bool:
    """Detect if running as native pywebview desktop application."""
    if os.environ.get("FINLY_DESKTOP_MODE") == "1":
        return True
    if "desktop.py" in sys.argv[0] or hasattr(sys, "_MEIPASS"):
        return True
    return False


def select_best_download_url(assets: List[Dict[str, Any]], current_platform: str) -> Optional[str]:
    """Select appropriate installer asset according to operating system."""
    if not assets:
        return None

    if current_platform == "win32":
        # Prefer Inno Setup installer, fallback to portable
        for asset in assets:
            name = asset.get("name", "").lower()
            if "setup" in name and name.endswith(".exe"):
                return asset.get("browser_download_url")
        for asset in assets:
            name = asset.get("name", "").lower()
            if name.endswith(".exe"):
                return asset.get("browser_download_url")

    elif current_platform == "darwin":
        # Prefer DMG installer, fallback to zip
        for asset in assets:
            name = asset.get("name", "").lower()
            if name.endswith(".dmg"):
                return asset.get("browser_download_url")
        for asset in assets:
            name = asset.get("name", "").lower()
            if "macos" in name and name.endswith(".zip"):
                return asset.get("browser_download_url")

    else:  # linux
        # Prefer DEB package, fallback to tarball
        for asset in assets:
            name = asset.get("name", "").lower()
            if name.endswith(".deb"):
                return asset.get("browser_download_url")
        for asset in assets:
            name = asset.get("name", "").lower()
            if "linux" in name and (name.endswith(".tar.gz") or name.endswith(".tgz")):
                return asset.get("browser_download_url")

    return assets[0].get("browser_download_url") if assets else None


async def get_latest_github_release() -> Optional[Dict[str, Any]]:
    """Fetch or return cached GitHub release metadata."""
    now = time.time()
    if _release_cache["data"] and (now - _release_cache["timestamp"] < CACHE_TTL_SECONDS):
        return _release_cache["data"]

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            headers = {
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "Finly-Update-Checker",
            }
            res = await client.get(
                "https://api.github.com/repos/louislefo/Finly/releases/latest",
                headers=headers,
            )
            if res.status_code == 200:
                data = res.json()
                _release_cache["data"] = data
                _release_cache["timestamp"] = now
                return data
    except Exception:
        pass
    return _release_cache.get("data")


@router.get("/version-check", response_model=VersionCheckResponse)
async def check_app_version() -> VersionCheckResponse:
    """Check latest release tag from GitHub and determine if an update is available."""
    current_ver = settings.VERSION
    current_platform = sys.platform
    in_container = is_running_in_container()
    in_desktop = is_running_in_desktop()

    release_data = await get_latest_github_release()

    latest_tag = (release_data.get("tag_name") if release_data else None) or current_ver
    release_title = release_data.get("name") if release_data else None
    release_notes = release_data.get("body") if release_data else None
    release_url = release_data.get("html_url") if release_data else "https://github.com/louislefo/Finly/releases/latest"
    published_at = release_data.get("published_at") if release_data else None
    assets = release_data.get("assets", []) if release_data else []

    download_url = select_best_download_url(assets, current_platform)

    # Version comparison
    current_tuple = parse_version_tuple(current_ver)
    latest_tuple = parse_version_tuple(latest_tag)

    has_update = latest_tuple > current_tuple

    return VersionCheckResponse(
        current_version=current_ver,
        latest_version=latest_tag,
        has_update=has_update,
        release_title=release_title,
        release_notes=release_notes,
        release_url=release_url,
        published_at=published_at,
        download_url=download_url,
        platform=current_platform,
        is_desktop=in_desktop,
        is_container=in_container,
    )


def _background_download_worker(url: str, target_path: str, version: str):
    """Download installer file in background thread while reporting progress."""
    global _download_state
    try:
        _download_state["status"] = "downloading"
        _download_state["progress_percent"] = 0
        _download_state["downloaded_bytes"] = 0
        _download_state["version"] = version
        _download_state["error_message"] = None

        with httpx.Client(timeout=120.0, follow_redirects=True) as client:
            with client.stream("GET", url) as response:
                response.raise_for_status()
                total = int(response.headers.get("content-length", 0))
                _download_state["total_bytes"] = total

                downloaded = 0
                with open(target_path, "wb") as f:
                    for chunk in response.iter_bytes(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            _download_state["downloaded_bytes"] = downloaded
                            if total > 0:
                                percent = min(100, int((downloaded / total) * 100))
                                _download_state["progress_percent"] = percent

        _download_state["status"] = "ready"
        _download_state["progress_percent"] = 100
        _download_state["file_path"] = target_path

    except Exception as e:
        _download_state["status"] = "error"
        _download_state["error_message"] = str(e)


@router.post("/update/download", response_model=UpdateDownloadStatusResponse)
async def start_update_download():
    """Start background download of the latest installer binary."""
    global _download_state

    # If already downloading, return current status
    if _download_state["status"] == "downloading":
        return UpdateDownloadStatusResponse(
            status=_download_state["status"],
            progress_percent=_download_state["progress_percent"],
            downloaded_bytes=_download_state["downloaded_bytes"],
            total_bytes=_download_state["total_bytes"],
            version=_download_state.get("version"),
        )

    version_info = await check_app_version()
    if not version_info.download_url:
        raise HTTPException(status_code=400, detail="Aucun fichier d'installation trouvé pour votre système.")

    target_ext = ".exe" if sys.platform == "win32" else (".dmg" if sys.platform == "darwin" else ".deb")
    temp_dir = tempfile.gettempdir()
    target_path = os.path.join(temp_dir, f"Finly-Update-{version_info.latest_version}{target_ext}")

    # Start download in background thread
    t = threading.Thread(
        target=_background_download_worker,
        args=(version_info.download_url, target_path, version_info.latest_version),
        daemon=True,
    )
    t.start()

    return UpdateDownloadStatusResponse(
        status="downloading",
        progress_percent=0,
        downloaded_bytes=0,
        total_bytes=0,
        version=version_info.latest_version,
    )


@router.get("/update/status", response_model=UpdateDownloadStatusResponse)
async def get_update_download_status():
    """Get current background download progress."""
    return UpdateDownloadStatusResponse(
        status=_download_state["status"],
        progress_percent=_download_state["progress_percent"],
        downloaded_bytes=_download_state["downloaded_bytes"],
        total_bytes=_download_state["total_bytes"],
        error_message=_download_state.get("error_message"),
        version=_download_state.get("version"),
    )


@router.post("/update/apply")
async def apply_update():
    """Launch the downloaded installer in silent/background mode and restart application."""
    global _download_state
    file_path = _download_state.get("file_path")

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Le fichier de mise à jour n'a pas encore été téléchargé.")

    if sys.platform == "win32":
        # Launch Inno Setup installer silently and restart application
        cmd = [file_path, "/SILENT", "/CLOSEAPPLICATIONS", "/RESTARTAPPLICATIONS"]
        DETACHED_PROCESS = 0x00000008
        subprocess.Popen(cmd, creationflags=DETACHED_PROCESS, close_fds=True)

        # Give 800ms for child process to spawn then exit
        def delayed_exit():
            time.sleep(0.8)
            os._exit(0)

        threading.Thread(target=delayed_exit, daemon=True).start()
        return {"status": "success", "message": "Installation en cours, Finly va redémarrer..."}

    elif sys.platform == "darwin":
        # Open macOS disk image installer
        subprocess.Popen(["open", file_path])
        return {"status": "success", "message": "Programme d'installation ouvert."}

    else:  # Linux
        subprocess.Popen(["xdg-open", file_path])
        return {"status": "success", "message": "Paquet d'installation ouvert."}
