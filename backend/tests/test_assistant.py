"""
Unit and Integration Tests for Ollama Assistant & Financial Vector Store
"""

import pytest
import uuid
import json
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.core.database import SessionLocal
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.services.ollama_service import OllamaService
from app.services.financial_vector_store import FinancialVectorStore
from app.services.assistant_prompts import build_system_prompt, get_default_quick_prompts


@pytest.fixture
def auth_client():
    client = TestClient(app)
    db = SessionLocal()
    test_uid = uuid.uuid4().hex[:8]
    user = User(
        id=f"usr_{test_uid}",
        email=f"assistant_tester_{test_uid}@finly.local",
        hashed_password="test_hashed_password",
        full_name="Assistant Tester",
        role="member",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()

    token = create_access_token(data={"sub": user.id, "email": user.email})
    client.headers = {"Authorization": f"Bearer {token}"}
    return client, user


@pytest.fixture
def assistant_test_user_and_data():
    db = SessionLocal()
    uid = f"usr_ai_{uuid.uuid4().hex[:8]}"

    user = User(
        id=uid,
        email=f"ai_tester_{uid}@finly.local",
        hashed_password="hashed_password",
        full_name="AI Tester",
        role="member",
    )
    db.add(user)

    acc = Account(
        id=f"acc_ai_{uid}",
        user_id=uid,
        name="Compte Courant Test",
        account_type="Compte Courant",
        balance=4250.75,
        currency="EUR",
        bank_name="BoursoBank",
    )
    db.add(acc)

    b = Budget(
        id=f"bdg_ai_{uid}",
        user_id=uid,
        category="Alimentation",
        monthly_limit=500.0,
    )
    db.add(b)

    tx = Transaction(
        id=f"tx_ai_{uid}",
        user_id=uid,
        account_id=acc.id,
        booking_date="2026-09-20",
        amount=-45.60,
        raw_label="CARREFOUR EXPRESS PARIS",
        merchant_name="Carrefour",
        category="Alimentation",
    )
    db.add(tx)
    db.commit()

    yield {"user_id": uid, "account_id": acc.id}

    # Cleanup
    db.query(Transaction).filter(Transaction.user_id == uid).delete()
    db.query(Budget).filter(Budget.user_id == uid).delete()
    db.query(Account).filter(Account.user_id == uid).delete()
    db.query(User).filter(User.id == uid).delete()
    db.commit()
    db.close()


def test_ollama_service_install_guide():
    win_guide = OllamaService.get_install_guide("windows")
    assert win_guide["os"] == "windows"
    assert "OllamaSetup.exe" in win_guide["download_url"]

    mac_guide = OllamaService.get_install_guide("darwin")
    assert mac_guide["os"] == "darwin"
    assert "brew" in mac_guide["command"]

    linux_guide = OllamaService.get_install_guide("linux")
    assert linux_guide["os"] == "linux"
    assert "install.sh" in linux_guide["command"]


def test_financial_vector_store_indexing_and_retrieval(assistant_test_user_and_data):
    db = SessionLocal()
    try:
        uid = assistant_test_user_and_data["user_id"]
        docs = FinancialVectorStore.build_financial_context_documents(db, user_id=uid)

        assert len(docs) >= 2
        categories = [d["category"] for d in docs]
        assert "patrimoine_soldes" in categories
        assert "budget_enveloppes" in categories

        # Semantic retrieval with keyword
        ctx_budget = FinancialVectorStore.retrieve_relevant_context("Combien ai-je dépensé en courses et alimentation ?", db, user_id=uid)
        assert "Alimentation" in ctx_budget or "Budget" in ctx_budget

        # Targeted merchant query retrieval
        ctx_merchant = FinancialVectorStore.retrieve_relevant_context("j'ai depenser combien d'argent chez carrefour depuis le debut ?", db, user_id=uid)
        assert "CARREFOUR" in ctx_merchant
        assert "45.60 EUR" in ctx_merchant

        # Build prompt
        prompt = build_system_prompt(ctx_merchant)
        assert "<financial_context>" in prompt
        assert "Finly AI Assistant" in prompt
    finally:
        db.close()


def test_quick_prompts_generation():
    fr_prompts = get_default_quick_prompts("fr")
    assert len(fr_prompts) >= 3
    assert any("Patrimoine" in p["label"] for p in fr_prompts)

    en_prompts = get_default_quick_prompts("en")
    assert len(en_prompts) >= 3
    assert any("Net Worth" in p["label"] for p in en_prompts)


def test_assistant_api_endpoints(auth_client, assistant_test_user_and_data):
    client, user = auth_client

    # 1. Status endpoint
    resp = client.get("/api/v1/assistant/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "ollama" in data
    assert "install_guide" in data

    # 2. Quick prompts endpoint
    qp_resp = client.get("/api/v1/assistant/quick-prompts?lang=fr")
    assert qp_resp.status_code == 200
    assert len(qp_resp.json()["prompts"]) >= 3

    # 3. Index refresh endpoint
    ref_resp = client.post("/api/v1/assistant/index/refresh")
    assert ref_resp.status_code == 200
    assert ref_resp.json()["documents_indexed"] >= 1

    # 4. Chat endpoint (non-streaming with mock)
    with patch.object(OllamaService, "chat_stream", return_value=iter(["Votre patrimoine ", "total est de 4 250,75 EUR."])):
        chat_resp = client.post("/api/v1/assistant/chat", json={
            "message": "Quel est mon solde ?",
            "stream": False,
        })
        assert chat_resp.status_code == 200
        chat_data = chat_resp.json()
        assert "4 250,75 EUR" in chat_data["response"]
