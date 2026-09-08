from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.bank_connection import BankConnection
from app.models.user import User
from app.core.security import get_current_user
from app.services.woob_service import woob_service

router = APIRouter()

class UpdateAccountRequest(BaseModel):
    name: Optional[str] = None
    account_type: Optional[str] = None
    color: Optional[str] = None

@router.get("/")
@router.get("", include_in_schema=False)
def get_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    total_balance = sum(a.balance for a in accounts)

    return {
        "total_balance": total_balance,
        "accounts_count": len(accounts),
        "accounts": [
            {
                "id": a.id,
                "bank": a.bank_name,
                "backend_name": a.backend_name,
                "type": a.account_type,
                "name": a.name,
                "iban": a.iban,
                "balance": a.balance,
                "currency": a.currency,
                "color": a.color,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            }
            for a in accounts
        ],
    }

@router.post("/reset")
def reset_database(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Purger uniquement les comptes de l'utilisateur connecté."""
    # Find account ids of user
    user_accs = db.query(Account).filter(Account.user_id == current_user.id).all()
    for acc in user_accs:
        db.query(Transaction).filter(Transaction.account_id == acc.id).delete()
        db.delete(acc)

    # Find bank connections of user
    user_conns = db.query(BankConnection).filter(BankConnection.user_id == current_user.id).all()
    w = woob_service._get_woob_instance()
    for conn in user_conns:
        if conn.backend_name:
            w.backend_instances.pop(conn.backend_name, None)
        db.delete(conn)

    db.commit()
    woob_service.log(f"Comptes et banques de l'utilisateur {current_user.email} réinitialisés.")
    return {"status": "success", "message": "Comptes de votre profil réinitialisés."}

@router.delete("/by-bank/{bank_name}")
def delete_bank_and_all_accounts(
    bank_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprimer une banque entière et l'ensemble de ses sous-comptes pour l'utilisateur connecté."""
    accounts = db.query(Account).filter(
        (Account.user_id == current_user.id) & (Account.bank_name == bank_name)
    ).all()

    if not accounts:
        accounts = db.query(Account).filter(
            (Account.user_id == current_user.id) & (Account.bank_name.ilike(bank_name))
        ).all()

    if not accounts:
        raise HTTPException(status_code=404, detail="Banque non trouvée pour cet utilisateur")

    backend_names = set(a.backend_name for a in accounts if a.backend_name)
    for acc in accounts:
        db.query(Transaction).filter(Transaction.account_id == acc.id).delete()
        db.delete(acc)

    for b_name in backend_names:
        db.query(BankConnection).filter(
            (BankConnection.user_id == current_user.id) & (BankConnection.backend_name == b_name)
        ).delete()
        woob_service.remove_backend(b_name)

    db.commit()
    woob_service.log(f"Banque {bank_name} de {current_user.email} supprimée.")
    return {"status": "success", "message": f"Banque {bank_name} et tous ses comptes supprimés"}

@router.delete("/{account_id}")
def delete_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    acc = db.query(Account).filter(
        (Account.id == account_id) & (Account.user_id == current_user.id)
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Compte bancaire non trouvé")

    backend_name = acc.backend_name
    db.query(Transaction).filter(Transaction.account_id == acc.id).delete()
    db.delete(acc)

    if backend_name:
        remaining = db.query(Account).filter(
            (Account.user_id == current_user.id) & (Account.backend_name == backend_name)
        ).count()
        if remaining == 0:
            db.query(BankConnection).filter(
                (BankConnection.user_id == current_user.id) & (BankConnection.backend_name == backend_name)
            ).delete()
            woob_service.remove_backend(backend_name)

    db.commit()
    woob_service.log(f"Compte {account_id} de {current_user.email} supprimé.")

    return {"status": "success", "message": "Compte supprimé de votre profil"}

@router.patch("/{account_id}")
def update_account(
    account_id: str,
    payload: UpdateAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    acc = db.query(Account).filter(
        (Account.id == account_id) & (Account.user_id == current_user.id)
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Compte bancaire non trouvé")

    if payload.name is not None and payload.name.strip():
        acc.name = payload.name.strip()
    if payload.account_type is not None and payload.account_type.strip():
        acc.account_type = payload.account_type.strip()
    if payload.color is not None and payload.color.strip():
        acc.color = payload.color.strip()

    acc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(acc)

    return {
        "status": "success",
        "account": {
            "id": acc.id,
            "bank": acc.bank_name,
            "name": acc.name,
            "type": acc.account_type,
            "iban": acc.iban,
            "balance": acc.balance,
            "currency": acc.currency,
            "color": acc.color,
            "updated_at": acc.updated_at.isoformat() if acc.updated_at else None,
        }
    }
