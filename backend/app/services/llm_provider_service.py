"""
Finly Multi-Provider LLM Service
Unified streaming orchestrator supporting local Ollama and Cloud AI providers:
- Local: Ollama
- Cloud: OpenAI, Anthropic Claude, Mistral AI, DeepSeek, and custom OpenAI-compatible endpoints.
"""

import os
import json
import logging
import platform
import subprocess
import tempfile
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any, List, Optional, Generator

from app.core.config import settings
from app.services.ollama_service import OllamaService

logger = logging.getLogger(__name__)

DEFAULT_MODELS: Dict[str, str] = {
    "ollama": "qwen2.5:1.5b",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-haiku-latest",
    "mistral": "mistral-small-latest",
    "deepseek": "deepseek-chat",
    "custom": "gpt-4o-mini",
}

DEFAULT_BASE_URLS: Dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com/v1",
    "mistral": "https://api.mistral.ai/v1",
    "deepseek": "https://api.deepseek.com/v1",
}


class LLMProviderService:
    @staticmethod
    def resolve_provider(provider: Optional[str]) -> str:
        prov = (provider or "ollama").lower().strip()
        if prov in ["ollama", "openai", "anthropic", "mistral", "deepseek", "custom"]:
            return prov
        return "ollama"

    @classmethod
    def resolve_model(cls, provider: str, requested_model: Optional[str]) -> str:
        if requested_model and requested_model.strip():
            return requested_model.strip()
        return DEFAULT_MODELS.get(provider, "qwen2.5:1.5b")

    @classmethod
    def resolve_base_url(cls, provider: str, custom_url: Optional[str]) -> str:
        if custom_url and custom_url.strip():
            return custom_url.strip().rstrip("/")
        if provider == "ollama":
            return OllamaService.get_base_url(custom_url)
        return DEFAULT_BASE_URLS.get(provider, "https://api.openai.com/v1").rstrip("/")

    @classmethod
    def test_provider_credentials(
        cls,
        provider: str,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes a rapid minimal verification to confirm credentials and model access.
        """
        prov = cls.resolve_provider(provider)
        target_model = cls.resolve_model(prov, model)
        target_url = cls.resolve_base_url(prov, base_url)

        if prov == "ollama":
            status = OllamaService.check_status(base_url=target_url)
            if not status.get("connected"):
                return {
                    "success": False,
                    "provider": "ollama",
                    "error": "Ollama is not running or not installed locally.",
                }
            return {
                "success": True,
                "provider": "ollama",
                "model": target_model,
                "message": "Local Ollama engine connected.",
            }

        if not api_key or not api_key.strip():
            return {
                "success": False,
                "provider": prov,
                "error": "API Key is required for this cloud provider.",
            }

        clean_key = api_key.strip()

        if prov == "anthropic":
            return cls._test_anthropic(clean_key, target_model, target_url)
        else:
            return cls._test_openai_compatible(prov, clean_key, target_model, target_url)

    @classmethod
    def _test_openai_compatible(
        cls, provider: str, api_key: str, model: str, base_url: str
    ) -> Dict[str, Any]:
        payload = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
        }).encode("utf-8")

        endpoint = f"{base_url}/chat/completions"
        req = urllib.request.Request(
            endpoint,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "Finly-Personal-Finance/1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=15.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if "choices" in data:
                    return {
                        "success": True,
                        "provider": provider,
                        "model": model,
                        "message": "API key successfully verified.",
                    }
                return {
                    "success": True,
                    "provider": provider,
                    "model": model,
                    "message": "Connected successfully.",
                }
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="ignore")
            err_msg = f"HTTP {exc.code}"
            try:
                parsed = json.loads(err_body)
                err_msg = parsed.get("error", {}).get("message", err_msg)
            except Exception:
                if err_body:
                    err_msg = f"HTTP {exc.code}: {err_body[:160]}"
            return {
                "success": False,
                "provider": provider,
                "error": err_msg,
                "status_code": exc.code,
            }
        except Exception as exc:
            return {
                "success": False,
                "provider": provider,
                "error": f"Connection error: {str(exc)}",
            }

    @classmethod
    def _test_anthropic(cls, api_key: str, model: str, base_url: str) -> Dict[str, Any]:
        payload = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
        }).encode("utf-8")

        endpoint = f"{base_url}/messages"
        req = urllib.request.Request(
            endpoint,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "User-Agent": "Finly-Personal-Finance/1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=15.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if "content" in data:
                    return {
                        "success": True,
                        "provider": "anthropic",
                        "model": model,
                        "message": "Anthropic API key successfully verified.",
                    }
                return {
                    "success": True,
                    "provider": "anthropic",
                    "model": model,
                    "message": "Connected successfully.",
                }
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="ignore")
            err_msg = f"HTTP {exc.code}"
            try:
                parsed = json.loads(err_body)
                err_msg = parsed.get("error", {}).get("message", err_msg)
            except Exception:
                if err_body:
                    err_msg = f"HTTP {exc.code}: {err_body[:160]}"
            return {
                "success": False,
                "provider": "anthropic",
                "error": err_msg,
                "status_code": exc.code,
            }
        except Exception as exc:
            return {
                "success": False,
                "provider": "anthropic",
                "error": f"Connection error: {str(exc)}",
            }

    @classmethod
    def stream_chat(
        cls,
        messages: List[Dict[str, str]],
        provider: str = "ollama",
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> Generator[str, None, None]:
        """
        Unified streaming generator across all AI providers.
        Yields token strings sequentially.
        """
        prov = cls.resolve_provider(provider)
        target_model = cls.resolve_model(prov, model)
        target_url = cls.resolve_base_url(prov, base_url)

        if prov == "ollama":
            for chunk in OllamaService.chat_stream(
                messages=messages, model=target_model, base_url=target_url
            ):
                yield chunk
        elif prov == "anthropic":
            for chunk in cls._stream_anthropic(
                messages=messages,
                model=target_model,
                api_key=api_key or "",
                base_url=target_url,
            ):
                yield chunk
        else:
            # openai, mistral, deepseek, custom
            for chunk in cls._stream_openai_compatible(
                messages=messages,
                model=target_model,
                api_key=api_key or "",
                base_url=target_url,
            ):
                yield chunk

    @classmethod
    def _stream_openai_compatible(
        cls,
        messages: List[Dict[str, str]],
        model: str,
        api_key: str,
        base_url: str,
    ) -> Generator[str, None, None]:
        payload = json.dumps({
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": 0.2,
        }).encode("utf-8")

        endpoint = f"{base_url}/chat/completions"
        req = urllib.request.Request(
            endpoint,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key.strip()}",
                "User-Agent": "Finly-Personal-Finance/1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=120.0) as resp:
                for line in resp:
                    line_str = line.decode("utf-8").strip()
                    if not line_str or line_str.startswith(":"):
                        continue
                    if line_str.startswith("data: "):
                        data_str = line_str[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            parsed = json.loads(data_str)
                            choices = parsed.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="ignore")
            logger.error(f"OpenAI-compatible stream HTTP error {exc.code}: {err_body}")
            yield f"\n[Erreur {exc.code} : {err_body[:200]}]"
        except Exception as exc:
            logger.error(f"OpenAI-compatible stream error: {exc}")
            yield f"\n[Erreur de connexion : {str(exc)}]"

    @classmethod
    def _stream_anthropic(
        cls,
        messages: List[Dict[str, str]],
        model: str,
        api_key: str,
        base_url: str,
    ) -> Generator[str, None, None]:
        system_content = ""
        user_assistant_messages = []
        for msg in messages:
            if msg.get("role") == "system":
                system_content = msg.get("content", "")
            else:
                user_assistant_messages.append({
                    "role": msg.get("role"),
                    "content": msg.get("content", ""),
                })

        payload_dict: Dict[str, Any] = {
            "model": model,
            "messages": user_assistant_messages,
            "max_tokens": 4096,
            "stream": True,
            "temperature": 0.2,
        }
        if system_content:
            payload_dict["system"] = system_content

        payload = json.dumps(payload_dict).encode("utf-8")
        endpoint = f"{base_url}/messages"
        req = urllib.request.Request(
            endpoint,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key.strip(),
                "anthropic-version": "2023-06-01",
                "User-Agent": "Finly-Personal-Finance/1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=120.0) as resp:
                for line in resp:
                    line_str = line.decode("utf-8").strip()
                    if not line_str or line_str.startswith(":"):
                        continue
                    if line_str.startswith("data: "):
                        data_str = line_str[6:].strip()
                        try:
                            parsed = json.loads(data_str)
                            event_type = parsed.get("type")
                            if event_type == "content_block_delta":
                                delta = parsed.get("delta", {})
                                if delta.get("type") == "text_delta":
                                    yield delta.get("text", "")
                            elif event_type == "message_stop":
                                break
                        except json.JSONDecodeError:
                            continue
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="ignore")
            logger.error(f"Anthropic stream HTTP error {exc.code}: {err_body}")
            yield f"\n[Erreur {exc.code} : {err_body[:200]}]"
        except Exception as exc:
            logger.error(f"Anthropic stream error: {exc}")
            yield f"\n[Erreur de connexion : {str(exc)}]"

    @classmethod
    def install_ollama_engine(cls) -> Dict[str, Any]:
        """
        Triggers host OS installation of Ollama.
        """
        sys_plat = platform.system().lower()
        if sys_plat.startswith("win"):
            # Windows: download OllamaSetup.exe to Temp and start process
            try:
                temp_dir = tempfile.gettempdir()
                installer_path = os.path.join(temp_dir, "OllamaSetup.exe")
                url = "https://ollama.com/download/OllamaSetup.exe"
                logger.info(f"Downloading OllamaSetup.exe from {url} to {installer_path}")
                urllib.request.urlretrieve(url, installer_path)
                subprocess.Popen([installer_path], shell=True)
                return {
                    "status": "launched",
                    "os": "windows",
                    "message": "Installeur Ollama lance. Suivez l'assistant d'installation.",
                }
            except Exception as exc:
                logger.error(f"Failed to launch Ollama setup: {exc}")
                return {
                    "status": "error",
                    "os": "windows",
                    "error": str(exc),
                    "manual_url": "https://ollama.com/download/windows",
                }
        elif "darwin" in sys_plat or "mac" in sys_plat:
            return {
                "status": "manual",
                "os": "darwin",
                "message": "Telechargez Ollama pour macOS depuis ollama.com",
                "manual_url": "https://ollama.com/download/mac",
            }
        else:
            return {
                "status": "manual",
                "os": "linux",
                "message": "Executez 'curl -fsSL https://ollama.com/install.sh | sh' dans votre terminal",
                "manual_url": "https://ollama.com/download/linux",
            }
