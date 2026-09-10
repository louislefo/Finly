import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.core.database import SessionLocal
from app.models.user import User
from app.core.seed import init_db_superuser

init_db_superuser()
client = TestClient(app)

def test_admin_access_denied_for_unauthenticated():
    response = client.get("/api/v1/admin/stats")
    assert response.status_code == 401

def test_admin_access_denied_for_member():
    db = SessionLocal()
    member = db.query(User).filter(User.role == "member").first()
    db.close()
    if member:
        token = create_access_token(data={"sub": member.id, "email": member.email})
        response = client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403

def test_admin_access_granted_for_admin():
    db = SessionLocal()
    admin = db.query(User).filter(User.role == "admin").first()
    db.close()
    assert admin is not None
    token = create_access_token(data={"sub": admin.id, "email": admin.email})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Stats
    response = client.get("/api/v1/admin/stats", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "metrics" in data
    assert "system" in data

    # 2. Users
    response = client.get("/api/v1/admin/users", headers=headers)
    assert response.status_code == 200
    users_data = response.json()
    assert "users" in users_data
    assert len(users_data["users"]) >= 1

    # 3. Vacuum
    response = client.post("/api/v1/admin/maintenance/vacuum", headers=headers)
    assert response.status_code == 200

def test_login_shorthand_admin():
    response = client.post("/api/v1/auth/login", json={"email": "admin", "password": "admin"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["user"]["role"] == "admin"

def test_admin_impersonate_user():
    # Login as admin
    admin_login = client.post("/api/v1/auth/login", json={"email": "admin", "password": "admin"})
    admin_token = admin_login.json()["access_token"]

    db = SessionLocal()
    target_user = db.query(User).filter(User.role != "admin").first()
    db.close()

    if target_user:
        response = client.post(
            f"/api/v1/admin/users/{target_user.id}/impersonate",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["user"]["id"] == target_user.id
        assert "impersonated_by" in data

