import pytest
from app.core.security import (
    hash_user_password,
    verify_user_password,
    create_access_token,
    decode_access_token,
    encrypt_bank_password,
    decrypt_bank_password,
)

def test_password_hashing_and_verification():
    raw_pwd = "MonSuperMotDePasse2026!"
    hashed = hash_user_password(raw_pwd)
    
    assert hashed != raw_pwd
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
    assert verify_user_password(raw_pwd, hashed) is True
    assert verify_user_password("MauvaisMotDePasse", hashed) is False
    assert verify_user_password("", hashed) is False

def test_jwt_token_creation_and_decoding():
    payload = {"sub": "usr_test123", "email": "test@finly.local", "role": "member"}
    token = create_access_token(payload)
    
    assert isinstance(token, str)
    assert len(token) > 20
    
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "usr_test123"
    assert decoded["email"] == "test@finly.local"
    assert decoded["role"] == "member"
    assert "exp" in decoded
    assert "iat" in decoded

def test_jwt_token_invalid():
    invalid_token = "invalid.token.payload"
    decoded = decode_access_token(invalid_token)
    assert decoded is None

def test_bank_password_encryption_and_decryption():
    plain_secret = "BankSecretPin9876"
    encrypted = encrypt_bank_password(plain_secret)
    
    assert encrypted != plain_secret
    assert encrypted.startswith("gAAAAA")
    
    decrypted = decrypt_bank_password(encrypted)
    assert decrypted == plain_secret

def test_bank_password_encryption_empty_or_none():
    assert encrypt_bank_password(None) is None
    assert decrypt_bank_password(None) is None
    assert decrypt_bank_password("plaintext_unencrypted") == "plaintext_unencrypted"
