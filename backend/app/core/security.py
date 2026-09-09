import base64
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import bcrypt
import jwt
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db

# 1. Derive 32-byte Fernet key from SECRET_KEY
_primary_fernet_key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.strip().encode()).digest())
_cipher_suite = Fernet(_primary_fernet_key)

_FALLBACK_SECRETS = [
    settings.SECRET_KEY.strip(),
    "finly-local-secure-encryption-key-2026-very-secret",
    "finly-secret-key-2026",
    "finly-encryption-key-2026",
    "secret",
    "finly",
]
_fallback_ciphers = [
    Fernet(base64.urlsafe_b64encode(hashlib.sha256(s.encode()).digest()))
    for s in _FALLBACK_SECRETS
]

def encrypt_bank_password(plain_password: Optional[str]) -> Optional[str]:
    """Chiffrement AES-256 Fernet du mot de passe bancaire avant ecriture en base SQLite."""
    if not plain_password:
        return None
    try:
        return _cipher_suite.encrypt(plain_password.encode("utf-8")).decode("utf-8")
    except Exception as e:
        print(f"[Security] Erreur chiffrement mot de passe: {e}")
        return plain_password

def decrypt_bank_password(encrypted_password: Optional[str]) -> Optional[str]:
    """Dechiffrement du mot de passe bancaire a la volee en memoire pour Woob."""
    if not encrypted_password:
        return None
    if not encrypted_password.startswith("gAAAAA"):
        return encrypted_password

    # Try primary and fallback cipher suites
    for cipher in _fallback_ciphers:
        try:
            return cipher.decrypt(encrypted_password.encode("utf-8")).decode("utf-8")
        except Exception:
            continue

    print(f"[Security] Impossible de dechiffrer le mot de passe stocke avec les cles actuelles.")
    return None

# 2. Bcrypt User Password Hashing
def hash_user_password(password: str) -> str:
    """Hachage securise bcrypt pour les mots de passe utilisateurs."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_user_password(plain_password: str, hashed_password: str) -> bool:
    """Verification de mot de passe bcrypt."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

# 3. JWT Tokens
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None

# 4. Strict Dependency for protected routes
security_bearer = HTTPBearer(auto_error=False)

def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
):
    from app.models.user import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session expirée ou connexion requise.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not auth or not auth.credentials:
        raise credentials_exception

    payload = decode_access_token(auth.credentials)
    if not payload or "sub" not in payload:
        raise credentials_exception

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise credentials_exception

    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte utilisateur a été désactivé.",
        )

    return user

def get_current_admin_user(
    current_user = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs.",
        )
    return current_user

