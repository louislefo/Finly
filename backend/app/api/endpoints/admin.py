import os
import re
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db, engine
from app.core.config import settings
from app.core.security import get_current_admin_user, hash_user_password, create_access_token
from app.models.user import User
from app.models.account import Account
from app.models.bank_connection import BankConnection
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.project import Project
from app.models.category import Category
from app.models.merchant_rule import MerchantRule
from app.services.sync_service import SyncService

router = APIRouter()

class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    full_name: Optional[str] = None

class AdminResetPasswordRequest(BaseModel):
    new_password: str

@router.get("/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Retourne les métriques globales et statistiques système."""
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    admin_users = db.query(User).filter(User.role == "admin").count()

    total_connections = db.query(BankConnection).count()
    total_accounts = db.query(Account).count()
    total_transactions = db.query(Transaction).count()
    total_budgets = db.query(Budget).count()
    total_projects = db.query(Project).count()

    # Calcul du volume d'actifs total
    total_balance_res = db.query(func.sum(Account.balance)).scalar()
    total_balance = float(total_balance_res or 0.0)

    # Calcul de la taille du fichier SQLite
    db_size_bytes = 0
    try:
        # Extraire le chemin du fichier depuis DATABASE_URL (ex: sqlite:///./data/finly.db)
        clean_path = settings.DATABASE_URL.replace("sqlite:///", "").split("?")[0]
        if os.path.exists(clean_path):
            db_size_bytes = os.path.getsize(clean_path)
    except Exception:
        db_size_bytes = 0

    from app.scheduler.cron_jobs import scheduler
    scheduler_running = scheduler.running if scheduler else False

    return {
        "status": "success",
        "system": {
            "version": settings.VERSION,
            "project_name": settings.PROJECT_NAME,
            "database_size_bytes": db_size_bytes,
            "database_size_mb": round(db_size_bytes / (1024 * 1024), 2),
            "scheduler_running": scheduler_running,
            "sync_interval_hours": settings.SYNC_INTERVAL_HOURS,
        },
        "metrics": {
            "total_users": total_users,
            "active_users": active_users,
            "admin_users": admin_users,
            "total_bank_connections": total_connections,
            "total_accounts": total_accounts,
            "total_transactions": total_transactions,
            "total_budgets": total_budgets,
            "total_projects": total_projects,
            "total_balance": round(total_balance, 2),
        },
    }

@router.get("/users")
def get_all_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Liste exhaustive des utilisateurs enregistrés et de leurs métriques d'activité."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    result = []

    for u in users:
        accounts_count = db.query(Account).filter(Account.user_id == u.id).count()
        bank_connections_count = db.query(BankConnection).filter(BankConnection.user_id == u.id).count()
        transactions_count = db.query(Transaction).filter(Transaction.user_id == u.id).count()
        balance_res = db.query(func.sum(Account.balance)).filter(Account.user_id == u.id).scalar()
        total_balance = float(balance_res or 0.0)

        result.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role or "member",
            "is_active": bool(getattr(u, "is_active", True)),
            "auto_sync_enabled": bool(getattr(u, "auto_sync_enabled", False)),
            "sync_interval_hours": getattr(u, "sync_interval_hours", 12),
            "sync_time": getattr(u, "sync_time", "08:00"),
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "accounts_count": accounts_count,
            "bank_connections_count": bank_connections_count,
            "transactions_count": transactions_count,
            "total_balance": round(total_balance, 2),
        })

    return {"status": "success", "users": result}

@router.patch("/users/{user_id}")
def update_user_status(
    user_id: str,
    req: UpdateUserRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Met à jour le rôle ou le statut actif/inactif d'un utilisateur."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    # Protection : si l'admin tente de se rétrograder ou de se désactiver alors qu'il est le seul admin actif
    if target_user.id == admin_user.id:
        if req.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vous ne pouvez pas désactiver votre propre compte administrateur.",
            )
        if req.role and req.role != "admin":
            admin_count = db.query(User).filter(User.role == "admin", User.is_active == True).count()
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Impossible de rétrograder le seul administrateur actif.",
                )

    if req.role is not None:
        if req.role not in ["admin", "member"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rôle invalide. Les rôles autorisés sont 'admin' et 'member'.",
            )
        target_user.role = req.role

    if req.is_active is not None:
        target_user.is_active = req.is_active

    if req.full_name is not None and req.full_name.strip():
        target_user.full_name = req.full_name.strip()

    db.commit()
    db.refresh(target_user)

    return {
        "status": "success",
        "message": "Utilisateur mis à jour avec succès.",
        "user": {
            "id": target_user.id,
            "email": target_user.email,
            "full_name": target_user.full_name,
            "role": target_user.role,
            "is_active": target_user.is_active,
        },
    }

@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: str,
    req: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Réinitialise le mot de passe d'un utilisateur donné."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    if len(req.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit comporter au moins 6 caractères.",
        )

    target_user.hashed_password = hash_user_password(req.new_password)
    db.commit()

    return {
        "status": "success",
        "message": f"Mot de passe réinitialisé pour l'utilisateur {target_user.email}.",
    }

@router.delete("/users/{user_id}")
def delete_user_and_cascade(
    user_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Supprime définitivement un utilisateur et effectue une purge en cascade de ses données."""
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas supprimer votre propre compte.",
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    try:
        # Purge en cascade
        db.query(Transaction).filter(Transaction.user_id == user_id).delete(synchronize_session=False)
        db.query(Account).filter(Account.user_id == user_id).delete(synchronize_session=False)
        db.query(BankConnection).filter(BankConnection.user_id == user_id).delete(synchronize_session=False)
        db.query(Budget).filter(Budget.user_id == user_id).delete(synchronize_session=False)
        db.query(Project).filter(Project.user_id == user_id).delete(synchronize_session=False)
        db.query(Category).filter(Category.user_id == user_id).delete(synchronize_session=False)
        
        # Supprimer l'utilisateur
        db.delete(target_user)
        db.commit()

        return {
            "status": "success",
            "message": f"Utilisateur {target_user.email} et l'ensemble de ses données ont été supprimés.",
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la suppression de l'utilisateur : {str(e)}",
        )

@router.post("/users/{user_id}/impersonate")
def impersonate_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Permet à un administrateur d'endosser la vue et la session d'un utilisateur pour voir son tableau de bord."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    if hasattr(target_user, "is_active") and not target_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible d'endosser un compte utilisateur désactivé.",
        )

    # Création du token d'accès au nom de l'utilisateur cible avec métadonnées d'incarnation
    token = create_access_token(
        data={
            "sub": target_user.id,
            "email": target_user.email,
            "impersonated_by": admin_user.id,
        }
    )

    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": target_user.id,
            "email": target_user.email,
            "full_name": target_user.full_name,
            "role": target_user.role,
        },
        "impersonated_by": {
            "id": admin_user.id,
            "email": admin_user.email,
            "full_name": admin_user.full_name,
        },
    }


def _run_global_sync():
    """Tâche d'arrière-plan pour synchroniser l'ensemble des comptes bancaires."""
    db = SessionLocal() if 'SessionLocal' in globals() else None
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        connections = db.query(BankConnection).filter(BankConnection.status == "connected").all()
        for conn in connections:
            try:
                SyncService.sync_bank_connection(db, conn.backend_name, conn.user_id)
            except Exception as e:
                print(f"[Admin Global Sync] Erreur pour {conn.backend_name}: {e}")
    finally:
        db.close()

@router.post("/maintenance/sync-all")
def trigger_global_sync(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Déclenche la synchronisation bancaire pour l'ensemble des connexions actives en arrière-plan."""
    connected_count = db.query(BankConnection).filter(BankConnection.status == "connected").count()
    background_tasks.add_task(_run_global_sync)

    return {
        "status": "success",
        "message": f"Synchronisation globale lancée en arrière-plan ({connected_count} connexions ciblées).",
        "target_connections": connected_count,
    }

@router.post("/maintenance/vacuum")
def trigger_database_vacuum(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Exécute l'optimisation SQLite VACUUM pour compacter la base de données et reconstruire les index."""
    try:
        # Note: VACUUM ne peut pas s'exécuter dans un bloc de transaction SQLite classique
        db.execute(text("PRAGMA optimize;"))
        db.commit()

        with engine.connect() as conn:
            conn.execution_options(isolation_level="AUTOCOMMIT")
            conn.execute(text("VACUUM;"))

        # Recalculer la taille après vacuum
        clean_path = settings.DATABASE_URL.replace("sqlite:///", "").split("?")[0]
        db_size_bytes = os.path.getsize(clean_path) if os.path.exists(clean_path) else 0

        return {
            "status": "success",
            "message": "Optimisation VACUUM effectuée avec succès.",
            "database_size_bytes": db_size_bytes,
            "database_size_mb": round(db_size_bytes / (1024 * 1024), 2),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'exécution de VACUUM : {str(e)}",
        )
