import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.user import User
from app.core.security import (
    hash_user_password,
    verify_user_password,
    create_access_token,
    get_current_user,
)

router = APIRouter()

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    language: Optional[str] = "en"

class LoginRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/register")
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    clean_email = req.email.lower().strip()
    if "@" not in clean_email or "." not in clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format d'adresse email invalide.",
        )

    # Check if user already exists
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte avec cette adresse email existe déjà.",
        )

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    hashed_pw = hash_user_password(req.password)

    new_user = User(
        id=user_id,
        email=clean_email,
        full_name=req.full_name.strip(),
        hashed_password=hashed_pw,
        role="member",
        language=req.language or "en",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(data={"sub": new_user.id, "email": new_user.email})

    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "role": new_user.role,
            "language": new_user.language,
        },
    }

@router.post("/login")
def login_user(req: LoginRequest, db: Session = Depends(get_db)):
    clean_identifier = req.email.lower().strip()
    user = db.query(User).filter(
        (User.email == clean_identifier) | (User.email == f"{clean_identifier}@finly.local")
    ).first()
    if not user or not verify_user_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Adresse email ou mot de passe incorrect.",
        )

    token = create_access_token(data={"sub": user.id, "email": user.email})

    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "language": getattr(user, "language", "en") or "en",
        },
    }

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_user_password(req.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect.",
        )

    if len(req.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nouveau mot de passe doit comporter au moins 6 caractères.",
        )

    current_user.hashed_password = hash_user_password(req.new_password)
    db.commit()

    return {"status": "success", "message": "Mot de passe modifié avec succès."}

class UpdateSyncSettingsRequest(BaseModel):
    auto_sync_enabled: bool
    sync_interval_hours: Optional[int] = 12
    sync_time: Optional[str] = "08:00"
    language: Optional[str] = None

class UpdatePreferencesRequest(BaseModel):
    language: Optional[str] = None
    auto_sync_enabled: Optional[bool] = None
    sync_interval_hours: Optional[int] = None
    sync_time: Optional[str] = None

@router.get("/me")
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "language": str(getattr(current_user, "language", "en") or "en"),
        "auto_sync_enabled": bool(getattr(current_user, "auto_sync_enabled", False)),
        "sync_interval_hours": int(getattr(current_user, "sync_interval_hours", 12) or 12),
        "sync_time": str(getattr(current_user, "sync_time", "08:00") or "08:00"),
    }

@router.patch("/sync-settings")
def update_sync_settings(
    req: UpdateSyncSettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.auto_sync_enabled = req.auto_sync_enabled
    if req.sync_interval_hours is not None:
        current_user.sync_interval_hours = req.sync_interval_hours
    if req.sync_time is not None:
        current_user.sync_time = req.sync_time
    if req.language is not None:
        current_user.language = req.language
    db.commit()
    db.refresh(current_user)

    return {
        "status": "success",
        "message": "Préférences de synchronisation enregistrées.",
        "auto_sync_enabled": current_user.auto_sync_enabled,
        "sync_interval_hours": current_user.sync_interval_hours,
        "sync_time": current_user.sync_time,
        "language": current_user.language,
    }

@router.patch("/preferences")
def update_user_preferences(
    req: UpdatePreferencesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.language is not None:
        current_user.language = req.language
    if req.auto_sync_enabled is not None:
        current_user.auto_sync_enabled = req.auto_sync_enabled
    if req.sync_interval_hours is not None:
        current_user.sync_interval_hours = req.sync_interval_hours
    if req.sync_time is not None:
        current_user.sync_time = req.sync_time
    db.commit()
    db.refresh(current_user)

    return {
        "status": "success",
        "message": "Préférences mises à jour.",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role,
            "language": current_user.language,
            "auto_sync_enabled": current_user.auto_sync_enabled,
            "sync_interval_hours": current_user.sync_interval_hours,
            "sync_time": current_user.sync_time,
        },
    }

@router.post("/logout")
def logout():
    return {"status": "success", "message": "Déconnexion réussie"}
