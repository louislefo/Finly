import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User

client = TestClient(app)

def test_auth_flow():
    unique_email = f"user_{uuid.uuid4().hex[:8]}@finly.local"
    raw_password = "SecurePassword123!"

    # 1. Register new user
    reg_response = client.post("/api/v1/auth/register", json={
        "email": unique_email,
        "password": raw_password,
        "full_name": "Test Flow User"
    })
    assert reg_response.status_code == 200
    reg_data = reg_response.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == unique_email
    assert reg_data["user"]["role"] == "member"

    token = reg_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get current user profile (/me)
    me_response = client.get("/api/v1/auth/me", headers=headers)
    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["email"] == unique_email
    assert me_data["role"] == "member"

    # 3. Try to register same email again (should fail)
    duplicate_reg = client.post("/api/v1/auth/register", json={
        "email": unique_email,
        "password": "AnotherPassword",
        "full_name": "Duplicate"
    })
    assert duplicate_reg.status_code == 400

    # 4. Login with valid credentials
    login_response = client.post("/api/v1/auth/login", json={
        "email": unique_email,
        "password": raw_password
    })
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()

    # 5. Login with invalid password (should fail)
    bad_login = client.post("/api/v1/auth/login", json={
        "email": unique_email,
        "password": "WrongPassword!"
    })
    assert bad_login.status_code == 401

    # Cleanup
    db = SessionLocal()
    db.query(User).filter(User.email == unique_email).delete()
    db.commit()
    db.close()
