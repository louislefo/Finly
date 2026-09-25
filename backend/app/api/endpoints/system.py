import os
import sys
import time
import httpx
from typing import Optional, Dict, Any, List
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()

# In-memory release cache to avoid GitHub rate-limiting
_release_cache: Dict[str, Any] = {
    "timestamp": 0,
    "data": None,
}
CACHE_TTL_SECONDS = 300  # 5 minutes


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


def parse_version_tuple(version_str: str) -> tuple:
    """Parse version string into integer tuple for robust comparison."""
    clean = version_str.strip().lstrip("v").lstrip("V")
    parts = []
    for segment in clean.split("."):
        # Extract numeric part
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

    # Fallback to first available asset
    return assets[0].get("browser_download_url") if assets else None


@router.get("/version-check", response_model=VersionCheckResponse)
async def check_app_version() -> VersionCheckResponse:
    """Check latest release tag from GitHub and determine if an update is available."""
    current_ver = settings.VERSION
    current_platform = sys.platform
    in_container = is_running_in_container()
    in_desktop = is_running_in_desktop()

    now = time.time()
    release_data = None

    if _release_cache["data"] and (now - _release_cache["timestamp"] < CACHE_TTL_SECONDS):
        release_data = _release_cache["data"]
    else:
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
                    release_data = res.json()
                    _release_cache["data"] = release_data
                    _release_cache["timestamp"] = now
        except Exception:
            # Offline or GitHub API unreachable; keep existing cache if any
            release_data = _release_cache.get("data")

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
