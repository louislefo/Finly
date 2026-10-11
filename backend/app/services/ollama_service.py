"""
Finly Ollama Client & Lifecycle Service
Handles connectivity check, model installation/pulling, streaming responses, and OS installer guidance.
"""

import os
import sys
import json
import platform
import logging
import urllib.request
import urllib.error
import http.client
from typing import Dict, Any, List, Optional, Generator

from app.core.config import settings

logger = logging.getLogger(__name__)


class OllamaService:
    @staticmethod
    def get_base_url(custom_url: Optional[str] = None) -> str:
        url = custom_url or settings.OLLAMA_BASE_URL or "http://127.0.0.1:11434"
        return url.rstrip("/")

    @classmethod
    def is_installed_locally(cls) -> bool:
        """
        Checks if ollama binary is installed and discoverable on the operating system.
        """
        import shutil
        if shutil.which("ollama"):
            return True
        if platform.system().lower().startswith("win"):
            local_appdata = os.environ.get("LOCALAPPDATA", "")
            if local_appdata and os.path.exists(os.path.join(local_appdata, "Programs", "Ollama", "ollama.exe")):
                return True
        elif "darwin" in platform.system().lower() or "mac" in platform.system().lower():
            for p in ["/usr/local/bin/ollama", "/opt/homebrew/bin/ollama", "/Applications/Ollama.app"]:
                if os.path.exists(p):
                    return True
        elif "linux" in platform.system().lower():
            for p in ["/usr/bin/ollama", "/usr/local/bin/ollama"]:
                if os.path.exists(p):
                    return True
        return False

    @classmethod
    def start_daemon(cls) -> Dict[str, Any]:
        """
        Attempts to start the Ollama daemon process in background if installed.
        """
        import shutil
        import subprocess
        import time

        status = cls.check_status()
        if status.get("connected"):
            return {"status": "success", "message": "already_running", "ollama": status}

        ollama_bin = shutil.which("ollama")
        if not ollama_bin and platform.system().lower().startswith("win"):
            local_appdata = os.environ.get("LOCALAPPDATA", "")
            cand = os.path.join(local_appdata, "Programs", "Ollama", "ollama.exe")
            if os.path.exists(cand):
                ollama_bin = cand
        elif not ollama_bin and ("darwin" in platform.system().lower() or "mac" in platform.system().lower()):
            for p in ["/usr/local/bin/ollama", "/opt/homebrew/bin/ollama"]:
                if os.path.exists(p):
                    ollama_bin = p
                    break
        elif not ollama_bin and "linux" in platform.system().lower():
            for p in ["/usr/bin/ollama", "/usr/local/bin/ollama"]:
                if os.path.exists(p):
                    ollama_bin = p
                    break

        if not ollama_bin:
            return {"status": "error", "message": "binary_not_found"}

        try:
            creationflags = 0
            if platform.system().lower().startswith("win"):
                creationflags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0x08000000

            subprocess.Popen(
                [ollama_bin, "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=creationflags,
                start_new_session=True if not platform.system().lower().startswith("win") else False,
            )

            # Wait up to 3 seconds for server to become responsive
            for _ in range(6):
                time.sleep(0.5)
                st = cls.check_status()
                if st.get("connected"):
                    return {"status": "success", "message": "started", "ollama": st}

            return {"status": "starting", "message": "process_spawned"}
        except Exception as exc:
            logger.error(f"Failed to auto-start Ollama: {exc}")
            return {"status": "error", "message": str(exc)}

    @classmethod
    def check_status(cls, base_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Check if Ollama server daemon is reachable and list downloaded local models.
        """
        url = cls.get_base_url(base_url)
        current_os = platform.system().lower()
        default_model = settings.OLLAMA_DEFAULT_MODEL
        fallback_model = settings.OLLAMA_FALLBACK_MODEL
        is_installed = cls.is_installed_locally()

        res: Dict[str, Any] = {
            "connected": False,
            "base_url": url,
            "version": None,
            "models": [],
            "default_model": default_model,
            "fallback_model": fallback_model,
            "is_model_available": False,
            "is_installed_locally": is_installed,
            "os": current_os,
        }

        try:
            # 1. Check version
            req_version = urllib.request.Request(f"{url}/api/version", method="GET")
            with urllib.request.urlopen(req_version, timeout=3.0) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    res["version"] = data.get("version")
                    res["connected"] = True

            # 2. Check installed models
            if res["connected"]:
                req_tags = urllib.request.Request(f"{url}/api/tags", method="GET")
                with urllib.request.urlopen(req_tags, timeout=3.0) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode("utf-8"))
                        raw_models = data.get("models", [])
                        model_names = [m.get("name") for m in raw_models if m.get("name")]
                        res["models"] = model_names
                        res["active_model"] = cls._select_best_model(model_names, default_model, fallback_model)
                        res["is_model_available"] = bool(res["active_model"])
        except Exception as exc:
            logger.debug(f"Ollama status check failed: {exc}")
            res["connected"] = False

        return res

    @classmethod
    def _select_best_model(
        cls,
        available_models: List[str],
        default_model: str,
        fallback_model: str,
        requested_model: Optional[str] = None,
    ) -> Optional[str]:
        if not available_models:
            return None

        def match_name(target: str) -> Optional[str]:
            if not target:
                return None
            t_clean = target.strip().lower()
            t_base = t_clean.split(":")[0]
            for a in available_models:
                a_lower = a.lower()
                if a_lower == t_clean or a_lower.startswith(f"{t_base}:") or a_lower == t_base:
                    return a
            return None

        # 1. Requested model
        if requested_model:
            matched = match_name(requested_model)
            if matched:
                return matched

        # 2. Default model (e.g. qwen2.5:1.5b)
        matched_def = match_name(default_model)
        if matched_def:
            return matched_def

        # 3. Fallback model (e.g. llama3.2:1b)
        matched_fb = match_name(fallback_model)
        if matched_fb:
            return matched_fb

        # 4. Any lightweight or completion model available (excluding embedding-only models)
        for a in available_models:
            if not any(k in a.lower() for k in ["embed", "nomic-embed", "bge-", "all-minilm"]):
                return a

        return available_models[0]

    @classmethod
    def resolve_active_model(
        cls,
        requested_model: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> str:
        status = cls.check_status(base_url=base_url)
        available = status.get("models", [])
        best = cls._select_best_model(
            available,
            settings.OLLAMA_DEFAULT_MODEL,
            settings.OLLAMA_FALLBACK_MODEL,
            requested_model=requested_model,
        )
        return best or requested_model or settings.OLLAMA_DEFAULT_MODEL

    @classmethod
    def get_install_guide(cls, os_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Returns OS-tailored install instructions and official download links.
        """
        current_os = (os_name or platform.system()).lower()

        guides = {
            "windows": {
                "os": "windows",
                "title": "Installation Ollama pour Windows",
                "download_url": "https://ollama.com/download/OllamaSetup.exe",
                "command": "winget install Ollama.Ollama",
                "instructions": "Téléchargez et exécutez l'installeur officiel Ollama pour Windows, puis démarrez l'application.",
            },
            "darwin": {
                "os": "darwin",
                "title": "Installation Ollama pour macOS",
                "download_url": "https://ollama.com/download/Ollama-darwin.zip",
                "command": "brew install ollama && brew services start ollama",
                "instructions": "Téléchargez l'archive macOS ou installez directement via Homebrew.",
            },
            "linux": {
                "os": "linux",
                "title": "Installation Ollama pour Linux",
                "download_url": "https://ollama.com/download/linux",
                "command": "curl -fsSL https://ollama.com/install.sh | sh",
                "instructions": "Exécutez la commande d'installation officielle dans votre terminal Linux.",
            },
            "docker": {
                "os": "docker",
                "title": "Connexion Ollama pour Docker",
                "download_url": "https://ollama.com/",
                "command": "export OLLAMA_BASE_URL=http://host.docker.internal:11434",
                "instructions": "Liez Finly à l'instance Ollama tournant sur la machine hôte via host.docker.internal.",
            }
        }

        if current_os.startswith("win") or "windows" in current_os:
            return guides["windows"]
        elif "darwin" in current_os or "mac" in current_os:
            return guides["darwin"]
        elif "linux" in current_os:
            return guides["linux"]
        elif "docker" in current_os:
            return guides["docker"]
        return guides["windows"]

    @classmethod
    def pull_model_stream(
        cls,
        model_name: str,
        base_url: Optional[str] = None,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Pull / download a model via Ollama API streaming progress.
        """
        url = cls.get_base_url(base_url)
        payload = json.dumps({"name": model_name, "stream": True}).encode("utf-8")
        req = urllib.request.Request(
            f"{url}/api/pull",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=600.0) as resp:
                for line in resp:
                    line_str = line.decode("utf-8").strip()
                    if not line_str:
                        continue
                    try:
                        data = json.loads(line_str)
                        completed = data.get("completed", 0)
                        total = data.get("total", 0)
                        percent = round((completed / total) * 100, 1) if total > 0 else 0.0

                        yield {
                            "status": data.get("status", "pulling"),
                            "completed": completed,
                            "total": total,
                            "percent": percent,
                            "done": data.get("status") == "success" or percent >= 100.0,
                        }
                    except json.JSONDecodeError:
                        continue
        except Exception as exc:
            logger.error(f"Error pulling model {model_name}: {exc}")
            yield {
                "status": f"error: {str(exc)}",
                "completed": 0,
                "total": 0,
                "percent": 0.0,
                "done": True,
                "error": str(exc),
            }

    @classmethod
    def chat_stream(
        cls,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> Generator[str, None, None]:
        """
        Stream chat response from Ollama token by token.
        """
        url = cls.get_base_url(base_url)
        target_model = cls.resolve_active_model(requested_model=model, base_url=base_url)

        payload = json.dumps({
            "model": target_model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": 0.2,
                "top_p": 0.9,
            }
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{url}/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=120.0) as resp:
                for line in resp:
                    line_str = line.decode("utf-8").strip()
                    if not line_str:
                        continue
                    try:
                        data = json.loads(line_str)
                        msg = data.get("message", {})
                        content = msg.get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue
        except urllib.error.HTTPError as http_exc:
            error_detail = ""
            try:
                raw_err = http_exc.read().decode("utf-8")
                err_json = json.loads(raw_err)
                error_detail = err_json.get("error", raw_err)
            except Exception:
                error_detail = str(http_exc)
            logger.error(f"HTTP error streaming chat from Ollama ({target_model}): {error_detail}")
            yield f"\n[Erreur Ollama ({target_model}): {error_detail}]"
        except Exception as exc:
            logger.error(f"Error streaming chat from Ollama ({target_model}): {exc}")
            yield f"\n[Erreur de communication avec l'assistant local: {str(exc)}]"

    @classmethod
    def generate_embeddings(
        cls,
        text: str,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> Optional[List[float]]:
        """
        Generate embedding vector via Ollama embeddings endpoint if supported.
        """
        url = cls.get_base_url(base_url)
        target_model = model or settings.OLLAMA_DEFAULT_MODEL

        payload = json.dumps({
            "model": target_model,
            "prompt": text,
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{url}/api/embeddings",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    return data.get("embedding")
        except Exception:
            return None
        return None
