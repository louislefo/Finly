"""
Unit and Integration Tests for Multi-Provider LLM Service (Ollama, OpenAI, Anthropic, Mistral, DeepSeek)
"""

import io
import json
import uuid
import pytest
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.core.database import SessionLocal
from app.models.user import User
from app.services.llm_provider_service import LLMProviderService, DEFAULT_MODELS, DEFAULT_BASE_URLS


@pytest.fixture
def auth_client():
    client = TestClient(app)
    db = SessionLocal()
    test_uid = uuid.uuid4().hex[:8]
    user = User(
        id=f"usr_llm_{test_uid}",
        email=f"llm_tester_{test_uid}@finly.local",
        hashed_password="test_hashed_password",
        full_name="LLM Provider Tester",
        role="member",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()

    token = create_access_token(data={"sub": user.id, "email": user.email})
    client.headers = {"Authorization": f"Bearer {token}"}
    return client, user


def test_provider_resolution_and_defaults():
    assert LLMProviderService.resolve_provider("ollama") == "ollama"
    assert LLMProviderService.resolve_provider("OPENAI") == "openai"
    assert LLMProviderService.resolve_provider("anthropic") == "anthropic"
    assert LLMProviderService.resolve_provider("mistral") == "mistral"
    assert LLMProviderService.resolve_provider("deepseek") == "deepseek"
    assert LLMProviderService.resolve_provider("custom") == "custom"
    assert LLMProviderService.resolve_provider("unknown_provider") == "ollama"

    assert LLMProviderService.resolve_model("openai", None) == DEFAULT_MODELS["openai"]
    assert LLMProviderService.resolve_model("anthropic", None) == DEFAULT_MODELS["anthropic"]
    assert LLMProviderService.resolve_model("mistral", None) == DEFAULT_MODELS["mistral"]
    assert LLMProviderService.resolve_model("openai", "gpt-4o") == "gpt-4o"

    assert LLMProviderService.resolve_base_url("openai", None) == DEFAULT_BASE_URLS["openai"]
    assert LLMProviderService.resolve_base_url("custom", "https://openrouter.ai/api/v1") == "https://openrouter.ai/api/v1"


def test_test_provider_credentials_missing_key():
    res = LLMProviderService.test_provider_credentials(provider="openai", api_key="")
    assert res["success"] is False
    assert "required" in res["error"].lower()


@patch("urllib.request.urlopen")
def test_test_provider_credentials_openai_success(mock_urlopen):
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps({
        "choices": [{"message": {"role": "assistant", "content": "pong"}}]
    }).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp
    mock_urlopen.return_value = mock_resp

    res = LLMProviderService.test_provider_credentials(
        provider="openai",
        api_key="sk-test-valid-key",
        model="gpt-4o-mini",
    )
    assert res["success"] is True
    assert res["provider"] == "openai"


@patch("urllib.request.urlopen")
def test_test_provider_credentials_anthropic_success(mock_urlopen):
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps({
        "content": [{"type": "text", "text": "pong"}]
    }).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp
    mock_urlopen.return_value = mock_resp

    res = LLMProviderService.test_provider_credentials(
        provider="anthropic",
        api_key="sk-ant-test-key",
        model="claude-3-5-haiku-latest",
    )
    assert res["success"] is True
    assert res["provider"] == "anthropic"


@patch("urllib.request.urlopen")
def test_stream_openai_compatible(mock_urlopen):
    stream_lines = [
        b'data: {"choices": [{"delta": {"content": "Solde "}}]}\n\n',
        b'data: {"choices": [{"delta": {"content": "actuel: 1200 EUR"}}]}\n\n',
        b'data: [DONE]\n\n',
    ]
    mock_resp = MagicMock()
    mock_resp.__iter__.return_value = iter(stream_lines)
    mock_resp.__enter__.return_value = mock_resp
    mock_urlopen.return_value = mock_resp

    chunks = list(LLMProviderService.stream_chat(
        messages=[{"role": "user", "content": "Solde ?"}],
        provider="openai",
        model="gpt-4o-mini",
        api_key="sk-test",
    ))
    assert "".join(chunks) == "Solde actuel: 1200 EUR"


def test_api_test_provider_endpoint(auth_client):
    client, _ = auth_client
    with patch.object(LLMProviderService, "test_provider_credentials") as mock_test:
        mock_test.return_value = {"success": True, "provider": "mistral", "message": "Key valid"}
        response = client.post(
            "/api/v1/assistant/test-provider",
            json={"provider": "mistral", "api_key": "test_key", "model": "mistral-small-latest"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["provider"] == "mistral"


def test_api_engine_install_endpoint(auth_client):
    client, _ = auth_client
    with patch.object(LLMProviderService, "install_ollama_engine") as mock_install:
        mock_install.return_value = {"status": "manual", "os": "linux", "message": "Run curl command"}
        response = client.post("/api/v1/assistant/engine/install")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "manual"
