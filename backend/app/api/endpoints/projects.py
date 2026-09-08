import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.core.database import get_db
from app.models.project import Project
from app.models.account import Account
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()

class CreateProjectRequest(BaseModel):
    name: str
    target_amount: float
    current_amount: Optional[float] = 0.0
    monthly_contribution: Optional[float] = 0.0
    deadline: str
    category: Optional[str] = "Général"
    project_type: Optional[str] = "savings"  # savings, real_estate, general
    status: Optional[str] = "in_progress"  # future, in_progress, completed, paused
    linked_account_id: Optional[str] = None
    real_estate_data: Optional[Dict[str, Any]] = None
    description: Optional[str] = None

class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    monthly_contribution: Optional[float] = None
    deadline: Optional[str] = None
    category: Optional[str] = None
    project_type: Optional[str] = None
    status: Optional[str] = None
    linked_account_id: Optional[str] = None
    real_estate_data: Optional[Dict[str, Any]] = None
    description: Optional[str] = None

class AddFundsRequest(BaseModel):
    amount: float

def serialize_project(p: Project, accounts_map: Dict[str, Account] = None) -> Dict[str, Any]:
    re_data = None
    if p.real_estate_data:
        try:
            re_data = json.loads(p.real_estate_data)
        except Exception:
            re_data = None

    linked_acc_name = None
    if p.linked_account_id and accounts_map and p.linked_account_id in accounts_map:
        acc = accounts_map[p.linked_account_id]
        linked_acc_name = f"{acc.bank_name or ''} - {acc.account_type}".strip(" -")

    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "projectType": p.project_type or "savings",
        "targetAmount": p.target_amount,
        "currentAmount": p.current_amount,
        "monthlyContribution": p.monthly_contribution or 0.0,
        "deadline": p.deadline,
        "category": p.category or "Général",
        "status": p.status or "in_progress",
        "linkedAccountId": p.linked_account_id,
        "linkedAccountName": linked_acc_name,
        "realEstateData": re_data,
        "createdAt": p.created_at.isoformat() if p.created_at else None,
    }

@router.get("/")
@router.get("", include_in_schema=False)
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = db.query(Project).filter(Project.user_id == current_user.id).order_by(Project.created_at.desc()).all()
    user_accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    accounts_map = {a.id: a for a in user_accounts}

    return [serialize_project(p, accounts_map) for p in projects]

@router.post("/")
@router.post("", include_in_schema=False)
def create_project(
    req: CreateProjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    re_json = json.dumps(req.real_estate_data) if req.real_estate_data else None

    # If linked account is selected, optionally sync current_amount from linked account balance
    init_amount = req.current_amount or 0.0
    if req.linked_account_id and init_amount == 0.0:
        acc = db.query(Account).filter((Account.id == req.linked_account_id) & (Account.user_id == current_user.id)).first()
        if acc and acc.balance > 0:
            init_amount = round(acc.balance, 2)

    new_proj = Project(
        id=f"proj_{uuid.uuid4().hex[:12]}",
        user_id=current_user.id,
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        project_type=req.project_type or "savings",
        target_amount=max(1.0, req.target_amount),
        current_amount=max(0.0, init_amount),
        monthly_contribution=max(0.0, req.monthly_contribution or 0.0),
        deadline=req.deadline,
        category=req.category or "Général",
        status=req.status or "in_progress",
        linked_account_id=req.linked_account_id,
        real_estate_data=re_json,
    )
    db.add(new_proj)
    db.commit()
    db.refresh(new_proj)

    user_accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    accounts_map = {a.id: a for a in user_accounts}

    return serialize_project(new_proj, accounts_map)

@router.put("/{project_id}")
def update_project(
    project_id: str,
    req: UpdateProjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proj = db.query(Project).filter(
        (Project.id == project_id) & (Project.user_id == current_user.id)
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Projet non trouvé")

    if req.name is not None:
        proj.name = req.name.strip()
    if req.description is not None:
        proj.description = req.description.strip() if req.description else None
    if req.target_amount is not None:
        proj.target_amount = max(1.0, req.target_amount)
    if req.current_amount is not None:
        proj.current_amount = max(0.0, req.current_amount)
        if proj.current_amount >= proj.target_amount and proj.status != "completed":
            proj.status = "completed"
    if req.monthly_contribution is not None:
        proj.monthly_contribution = max(0.0, req.monthly_contribution)
    if req.deadline is not None:
        proj.deadline = req.deadline
    if req.category is not None:
        proj.category = req.category
    if req.project_type is not None:
        proj.project_type = req.project_type
    if req.status is not None:
        proj.status = req.status
    if req.linked_account_id is not None:
        proj.linked_account_id = req.linked_account_id if req.linked_account_id != "none" else None
    if req.real_estate_data is not None:
        proj.real_estate_data = json.dumps(req.real_estate_data)

    db.commit()
    db.refresh(proj)

    user_accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    accounts_map = {a.id: a for a in user_accounts}

    return serialize_project(proj, accounts_map)

@router.post("/{project_id}/funds")
def add_funds(
    project_id: str,
    req: AddFundsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proj = db.query(Project).filter(
        (Project.id == project_id) & (Project.user_id == current_user.id)
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Projet non trouvé")

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")

    proj.current_amount = round(proj.current_amount + req.amount, 2)
    if proj.current_amount >= proj.target_amount and proj.status != "completed":
        proj.status = "completed"

    db.commit()
    db.refresh(proj)

    user_accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    accounts_map = {a.id: a for a in user_accounts}

    return serialize_project(proj, accounts_map)

@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proj = db.query(Project).filter(
        (Project.id == project_id) & (Project.user_id == current_user.id)
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Projet non trouvé")

    db.delete(proj)
    db.commit()
    return {"status": "success", "message": "Projet supprimé"}
