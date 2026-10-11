import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

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
    module: str  # e.g. "boursorama", "cragr", "bnp", "sg", "lcl", "n26", etc.
    login: str
    password: str
    custom_params: Optional[Dict[str, str]] = None

class RespondChallengeRequest(BaseModel):
    challenge_id: str
    answers: Dict[str, str] = {}

class PollChallengeRequest(BaseModel):
    challenge_id: str

@router.get("/banks")
def list_supported_banks():
    """List supported banks with dynamic regional parameters (Crédit Agricole, Banque Populaire)."""
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
    has_changes = False

    result = []
    for c in connections:
        has_pwd = bool(c.password)
        status = c.status
        if not has_pwd and status in ["connected", "ok", "active"]:
            status = "reconnect_required"
            c.status = "reconnect_required"
            has_changes = True

        custom_params_obj = None
        if c.custom_params:
            try:
                custom_params_obj = json.loads(c.custom_params) if isinstance(c.custom_params, str) else c.custom_params
            except Exception:
                pass

        result.append({
            "id": c.id,
            "module_name": c.module_name,
            "bank_name": c.bank_name,
            "login": c.login,
            "backend_name": c.backend_name,
            "status": status,
            "has_password": has_pwd,
            "custom_params": custom_params_obj,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "last_synced_at": c.last_synced_at.isoformat() if c.last_synced_at else None,
        })

    if has_changes:
        db.commit()

    return result

@router.post("/connect")
async def connect_bank(
    req: ConnectBankRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        bank_name = req.module.upper()
        for b in woob_service.SUPPORTED_MODULES:
            if b["id"] == req.module:
                bank_name = b["name"]
                break

        existing_conn = None
        if req.custom_params and req.custom_params.get("backend_name"):
            existing_conn = db.query(BankConnection).filter(
                (BankConnection.user_id == current_user.id) &
                (BankConnection.backend_name == req.custom_params.get("backend_name"))
            ).first()
        if not existing_conn:
            existing_conn = db.query(BankConnection).filter(
                (BankConnection.user_id == current_user.id) &
                (BankConnection.module_name == req.module)
            ).first()

        backend_name = existing_conn.backend_name if existing_conn else f"{req.module}_{uuid.uuid4().hex[:8]}"

        result = woob_service.setup_backend(
            module_name=req.module,
            login=req.login,
            password=req.password,
            backend_name=backend_name,
            custom_params=req.custom_params,
            user_id=current_user.id,
        )

        custom_params_json = json.dumps(req.custom_params) if req.custom_params else None

        if result.get("status") in ["connected", "2fa_required"]:
            encrypted_password = encrypt_bank_password(req.password)

            if existing_conn:
                existing_conn.login = req.login
                existing_conn.password = encrypted_password
                existing_conn.bank_name = bank_name
                existing_conn.module_name = req.module
                existing_conn.backend_name = backend_name
                existing_conn.custom_params = custom_params_json
                existing_conn.status = result.get("status", "connected")
                existing_conn.last_synced_at = datetime.utcnow()
                db.commit()
            else:
                connection = BankConnection(
                    id=f"conn_{uuid.uuid4().hex[:12]}",
                    user_id=current_user.id,
                    module_name=req.module,
                    bank_name=bank_name,
                    login=req.login,
                    password=encrypted_password,
                    backend_name=backend_name,
                    custom_params=custom_params_json,
                    status=result.get("status", "connected"),
                    last_synced_at=datetime.utcnow(),
                )
                db.add(connection)
                db.commit()

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

@router.post("/challenge/respond")
async def respond_to_bank_challenge(
    req: RespondChallengeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit 2FA challenge response (SMS OTP, e-mail code, etc.) to resume authentication."""
    try:
        result = woob_service.respond_to_challenge(
            challenge_id=req.challenge_id,
            answers=req.answers,
        )

        if result.get("status") == "connected":
            # Update connection status in DB
            backend_name = result.get("backend_name")
            conn = db.query(BankConnection).filter(
                (BankConnection.user_id == current_user.id) &
                (BankConnection.backend_name == backend_name)
            ).first()

            if conn:
                conn.status = "connected"
                conn.last_synced_at = datetime.utcnow()
                db.commit()

            # Trigger synchronization with pre-extracted data
            sync_res = await sync_service.sync_all_active_accounts(
                db,
                pre_extracted=result.get("extracted_data"),
                user_id=current_user.id,
            )
            result["sync"] = sync_res

        return result
    except Exception as e:
        woob_service.log(f"Erreur endpoint /challenge/respond: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/challenge/poll")
async def poll_bank_challenge(
    req: PollChallengeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check approval status of decoupled mobile push notification."""
    try:
        result = woob_service.poll_or_verify_challenge(challenge_id=req.challenge_id)

        if result.get("status") == "connected":
            backend_name = result.get("backend_name")
            conn = db.query(BankConnection).filter(
                (BankConnection.user_id == current_user.id) &
                (BankConnection.backend_name == backend_name)
            ).first()

            if conn:
                conn.status = "connected"
                conn.last_synced_at = datetime.utcnow()
                db.commit()

            sync_res = await sync_service.sync_all_active_accounts(
                db,
                pre_extracted=result.get("extracted_data"),
                user_id=current_user.id,
            )
            result["sync"] = sync_res

        return result
    except Exception as e:
        woob_service.log(f"Erreur endpoint /challenge/poll: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/challenge/{challenge_id}")
def cancel_bank_challenge(
    challenge_id: str,
    current_user: User = Depends(get_current_user),
):
    """Cancel a pending 2FA challenge and clean up server memory."""
    woob_service.cancel_challenge(challenge_id)
    return {"status": "success", "message": "Session 2FA annulée"}

@router.get("/modules/status")
def get_woob_modules_status(
    current_user: User = Depends(get_current_user),
):
    """List all supported official modules with their local version and installation status."""
    return woob_service.get_modules_status()

@router.post("/modules/update")
def update_woob_modules(
    current_user: User = Depends(get_current_user),
):
    """Check repository and update all supported modules."""
    return woob_service.update_all_modules()

@router.post("/sync")
async def trigger_woob_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        res = await sync_service.sync_all_active_accounts(
            db, user_id=current_user.id
        )
        return {**res, "result": res}
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

    accounts = db.query(Account).filter(
        (Account.backend_name == conn.backend_name) & (Account.user_id == current_user.id)
    ).all()
    for acc in accounts:
        db.query(Transaction).filter(Transaction.account_id == acc.id).delete()
        db.delete(acc)

    woob_service.remove_backend(conn.backend_name)
    db.delete(conn)
    db.commit()

    return {"status": "success", "message": "Connexion et comptes supprimés"}
