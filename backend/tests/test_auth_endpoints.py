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

    # 1. Register new user (avatar_seed should be automatically assigned)
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
    assert reg_data["user"]["avatar_seed"] is not None
    assert len(reg_data["user"]["avatar_seed"]) > 0

    token = reg_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get current user profile (/me)
    me_response = client.get("/api/v1/auth/me", headers=headers)
    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["email"] == unique_email
    assert me_data["role"] == "member"
    assert me_data["avatar_seed"] == reg_data["user"]["avatar_seed"]

    # 3. Update avatar seed via /profile
    profile_response = client.patch(
        "/api/v1/auth/profile",
        headers=headers,
        json={"avatar_seed": "custom_line_face"}
    )
    assert profile_response.status_code == 200
    profile_data = profile_response.json()
    assert profile_data["user"]["avatar_seed"] == "custom_line_face"

    # 4. Try to register same email again (should fail)
    duplicate_reg = client.post("/api/v1/auth/register", json={
        "email": unique_email,
        "password": "AnotherPassword",
        "full_name": "Duplicate"
    })
    assert duplicate_reg.status_code == 400

    # 5. Register user with explicit custom avatar seed
    explicit_email = f"user_explicit_{uuid.uuid4().hex[:8]}@finly.local"
    explicit_reg = client.post("/api/v1/auth/register", json={
        "email": explicit_email,
        "password": raw_password,
        "full_name": "Explicit Avatar User",
        "avatar_seed": "maya"
    })
    assert explicit_reg.status_code == 200
    assert explicit_reg.json()["user"]["avatar_seed"] == "maya"

    # 6. Login with valid credentials
    login_response = client.post("/api/v1/auth/login", json={
        "email": unique_email,
        "password": raw_password
    })
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()
    assert login_response.json()["user"]["avatar_seed"] == "custom_line_face"

    # 7. Login with invalid password (should fail)
    bad_login = client.post("/api/v1/auth/login", json={
        "email": unique_email,
        "password": "WrongPassword!"
    })
    assert bad_login.status_code == 401

    # Cleanup
    db = SessionLocal()
    db.query(User).filter(User.email.in_([unique_email, explicit_email])).delete()
    db.commit()
    db.close()
