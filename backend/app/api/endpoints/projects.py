import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.models.project import Project
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()

class CreateProjectRequest(BaseModel):
    name: str
    target_amount: float
    current_amount: Optional[float] = 0.0
    deadline: str
    category: Optional[str] = "Général"
    description: Optional[str] = None

class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    deadline: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None

@router.get("/")
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = db.query(Project).filter(Project.user_id == current_user.id).all()

    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "targetAmount": p.target_amount,
            "currentAmount": p.current_amount,
            "deadline": p.deadline,
            "category": p.category,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in projects
    ]

@router.post("/")
def create_project(
    req: CreateProjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_proj = Project(
        id=f"proj_{uuid.uuid4().hex[:12]}",
        user_id=current_user.id,
        name=req.name,
        description=req.description,
        target_amount=req.target_amount,
        current_amount=req.current_amount or 0.0,
        deadline=req.deadline,
        category=req.category or "Général",
        status="in_progress",
    )
    db.add(new_proj)
    db.commit()
    db.refresh(new_proj)

    return {
        "id": new_proj.id,
        "name": new_proj.name,
        "description": new_proj.description,
        "targetAmount": new_proj.target_amount,
        "currentAmount": new_proj.current_amount,
        "deadline": new_proj.deadline,
        "category": new_proj.category,
        "status": new_proj.status,
    }

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
