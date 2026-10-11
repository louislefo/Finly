import pytest
import uuid
import json
from unittest.mock import MagicMock, patch
from app.core.database import SessionLocal
from app.models.user import User
from app.models.bank_connection import BankConnection
from app.services.woob_service import woob_service
from app.core.security import create_access_token, encrypt_bank_password
from fastapi.testclient import TestClient
from app.main import app, auto_migrate_sqlite

auto_migrate_sqlite()
client = TestClient(app)

@pytest.fixture
def auth_header():
    db = SessionLocal()
    user_id = f"usr_{uuid.uuid4().hex[:10]}"
    email = f"test_woob_{uuid.uuid4().hex[:6]}@finly.local"
    user = User(
        id=user_id,
        email=email,
        hashed_password="pw",
        full_name="Woob Tester",
        role="member",
    )
    db.add(user)
    db.commit()
    db.close()

    token = create_access_token({"sub": user_id, "email": email, "role": "member"})
    yield {"Authorization": f"Bearer {token}", "user_id": user_id}

    # Cleanup
    db = SessionLocal()
    db.query(BankConnection).filter(BankConnection.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    db.close()

def test_supported_banks_and_regional_choices():
    banks = woob_service.get_supported_banks()
    assert len(banks) >= 18

    # Verify Crédit Agricole has regional choices
    cragr = next((b for b in banks if b["id"] == "cragr"), None)
    assert cragr is not None
    assert "config_fields" in cragr
    cragr_cf = next((f for f in cragr["config_fields"] if f["name"] == "website"), None)
    assert cragr_cf is not None
    assert cragr_cf["type"] == "select"
    assert len(cragr_cf["choices"]) > 10

    # Verify Banque Populaire has regional choices
    bp = next((b for b in banks if b["id"] == "banquepopulaire"), None)
    assert bp is not None
    assert "config_fields" in bp
    bp_cf = next((f for f in bp["config_fields"] if f["name"] == "cdetab"), None)
    assert bp_cf is not None
    assert bp_cf["type"] == "select"
    assert len(bp_cf["choices"]) >= 5

def test_custom_params_persistence_in_bank_connection(auth_header):
    db = SessionLocal()
    conn = BankConnection(
        id=f"conn_{uuid.uuid4().hex[:8]}",
        user_id=auth_header["user_id"],
        module_name="cragr",
        bank_name="Crédit Agricole",
        login="12345678901",
        password=encrypt_bank_password("654321"),
        backend_name=f"cragr_{uuid.uuid4().hex[:6]}",
        custom_params=json.dumps({"website": "www.ca-paris.fr"}),
        status="connected",
    )
    db.add(conn)
    db.commit()

    db.refresh(conn)
    assert conn.custom_params is not None
    parsed = json.loads(conn.custom_params)
    assert parsed["website"] == "www.ca-paris.fr"

    # Verify ensure_connections_loaded reads custom_params without crashing
    errors = woob_service.ensure_connections_loaded([conn], force_reload=True)
    # Could have network error or load fine, but custom_params shouldn't raise unhandled exception
    assert isinstance(errors, list)

    db.delete(conn)
    db.commit()
    db.close()

def test_challenge_sessions_store_and_cancellation():
    challenge_id = "test_chal_123"
    woob_service._challenge_sessions[challenge_id] = {
        "challenge_id": challenge_id,
        "backend": MagicMock(),
        "backend_name": "test_bank",
        "module_name": "boursorama",
        "bank_name": "BoursoBank",
        "login": "12345678",
        "password": "pwd",
        "custom_params": {},
        "user_id": "usr_1",
        "challenge_type": "app_validation",
        "message": "Validation requise sur l'application",
        "fields": [],
    }

    assert challenge_id in woob_service._challenge_sessions
    woob_service.cancel_challenge(challenge_id)
    assert challenge_id not in woob_service._challenge_sessions

def test_api_banks_endpoint():
    res = client.get("/api/v1/woob/banks")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 18

def test_api_modules_status(auth_header):
    headers = {"Authorization": auth_header["Authorization"]}
    res = client.get("/api/v1/woob/modules/status", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 18

def test_api_sync_health_endpoint(auth_header):
    headers = {"Authorization": auth_header["Authorization"]}
    res = client.get("/api/v1/sync/health", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "connections" in data

def test_api_sync_test_connection_endpoint(auth_header):
    headers = {"Authorization": auth_header["Authorization"]}
    db = SessionLocal()
    conn = BankConnection(
        id=f"conn_{uuid.uuid4().hex[:8]}",
        user_id=auth_header["user_id"],
        module_name="boursorama",
        bank_name="BoursoBank",
        login="12345678",
        password=encrypt_bank_password("invalid_pwd"),
        backend_name=f"test_bourso_{uuid.uuid4().hex[:6]}",
        status="connected",
    )
    db.add(conn)
    db.commit()
    conn_id = conn.id
    db.close()

    res = client.post(f"/api/v1/sync/test/{conn_id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert data["bank_name"] == "BoursoBank"
