import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.core.database import get_db
from app.models.bank_connection import BankConnection
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User
from app.core.security import encrypt_bank_password, get_current_user
from app.services.woob_service import woob_service
from app.services.sync_service import sync_service

router = APIRouter()

class ConnectBankRequest(BaseModel):
    module: str  # e.g. "lcl", "bourso", "revolut", "bnporc", "cragr", "sg"
    login: str
    password: str
    custom_params: Optional[Dict[str, str]] = None

@router.get("/banks")
def list_supported_banks():
    return woob_service.get_supported_banks()

@router.get("/logs")
def get_woob_logs():
    return {"logs": woob_service.latest_logs}

@router.get("/connections")
def list_bank_connections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connections = db.query(BankConnection).filter(BankConnection.user_id == current_user.id).all()

    return [
        {
            "id": c.id,
            "module_name": c.module_name,
            "bank_name": c.bank_name,
            "login": c.login,
            "backend_name": c.backend_name,
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "last_synced_at": c.last_synced_at.isoformat() if c.last_synced_at else None,
        }
        for c in connections
    ]

@router.post("/connect")
async def connect_bank(
    req: ConnectBankRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # Find bank display name
        bank_name = req.module.upper()
        for b in woob_service.SUPPORTED_MODULES:
            if b["id"] == req.module:
                bank_name = b["name"]
                break

        backend_name = f"{req.module}_{uuid.uuid4().hex[:8]}"

        result = woob_service.setup_backend(
            module_name=req.module,
            login=req.login,
            password=req.password,
            backend_name=backend_name,
            custom_params=req.custom_params,
        )

        if result.get("status") in ["connected", "2fa_required"]:
            # Encrypt password with AES-256 Fernet before storing
            encrypted_password = encrypt_bank_password(req.password)

            # 1. Persist connection in SQLite
            connection = BankConnection(
                id=f"conn_{uuid.uuid4().hex[:12]}",
                user_id=current_user.id,
                module_name=req.module,
                bank_name=bank_name,
                login=req.login,
                password=encrypted_password,  # Chiffre en AES-256
                backend_name=backend_name,
                status=result.get("status", "connected"),
                last_synced_at=datetime.utcnow(),
            )
            db.add(connection)
            db.commit()

            # 2. If status is connected, synchronize data immediately
            if result.get("status") == "connected":
                sync_res = await sync_service.sync_all_active_accounts(
                    db,
                    pre_extracted=result.get("extracted_data"),
                    user_id=current_user.id,
                )
                result["sync"] = sync_res

        return result
    except Exception as e:
        woob_service.log(f"Erreur endpoint /connect: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/sync")
async def trigger_woob_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        res = await sync_service.sync_all_active_accounts(
            db, user_id=current_user.id
        )
        return {"status": "success", "result": res}
    except Exception as e:
        woob_service.log(f"Erreur endpoint /sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/connections/{conn_id}")
def delete_bank_connection(
    conn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(BankConnection).filter(
        (BankConnection.id == conn_id) & (BankConnection.user_id == current_user.id)
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion non trouvée")

    # Remove accounts and transactions associated with this backend
    accounts = db.query(Account).filter(
        (Account.backend_name == conn.backend_name) & (Account.user_id == current_user.id)
    ).all()
    for acc in accounts:
        db.query(Transaction).filter(Transaction.account_id == acc.id).delete()
        db.delete(acc)

    db.delete(conn)
    db.commit()

    return {"status": "success", "message": "Connexion et comptes supprimés"}
