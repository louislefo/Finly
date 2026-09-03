import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.models.category import Category
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()

DEFAULT_SYSTEM_CATEGORIES = [
    {
        "name": "Alimentation",
        "icon": "ShoppingBag",
        "color": "#10b981",
        "subcategories": ["Supermarché", "Restaurant & Bar", "Boulangerie", "Livraison de repas"],
    },
    {
        "name": "Transports",
        "icon": "Car",
        "color": "#3b82f6",
        "subcategories": ["Carburant", "Transports en commun", "Train & Avion", "Péage & Parking", "Entretien"],
    },
    {
        "name": "Logement",
        "icon": "Home",
        "color": "#f59e0b",
        "subcategories": ["Loyer / Prêt", "Électricité & Gaz", "Eau", "Assurance", "Bricolage & Déco"],
    },
    {
        "name": "Abonnements",
        "icon": "Film",
        "color": "#8b5cf6",
        "subcategories": ["Streaming", "Internet & Mobile", "Salle de sport", "Logiciels & Cloud"],
    },
    {
        "name": "Loisirs & Sorties",
        "icon": "Compass",
        "color": "#ec4899",
        "subcategories": ["Vacances & Voyages", "Cinéma & Culture", "Shopping & Mode", "High-Tech", "Sorties"],
    },
    {
        "name": "Santé & Bien-être",
        "icon": "HeartPulse",
        "color": "#06b6d4",
        "subcategories": ["Pharmacie", "Consultation", "Soins & Beauté"],
    },
    {
        "name": "Revenus",
        "icon": "ArrowDownRight",
        "color": "#22c55e",
        "subcategories": ["Salaire", "Primes & Bonus", "Remboursements", "Revenus locatifs"],
    },
    {
        "name": "Virements & Épargne",
        "icon": "PiggyBank",
        "color": "#6366f1",
        "subcategories": ["Virement interne", "Épargne", "Investissement & Bourse"],
    },
    {
        "name": "Divers",
        "icon": "Tag",
        "color": "#71717a",
        "subcategories": ["Frais bancaires", "Impôts & Taxes", "Autre"],
    },
]

class CreateCategoryRequest(BaseModel):
    name: str
    parent_name: Optional[str] = None
    icon: Optional[str] = "Tag"
    color: Optional[str] = "#818cf8"

@router.get("/")
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch custom user categories
    user_cats = db.query(Category).filter(Category.user_id == current_user.id).all()

    # Build response structure
    category_map: dict = {}

    for sys_cat in DEFAULT_SYSTEM_CATEGORIES:
        category_map[sys_cat["name"]] = {
            "id": f"sys_{sys_cat['name'].lower()}",
            "name": sys_cat["name"],
            "icon": sys_cat["icon"],
            "color": sys_cat["color"],
            "subcategories": list(sys_cat["subcategories"]),
            "is_custom": False,
        }

    # Merge user custom categories
    for uc in user_cats:
        if uc.parent_name:
            if uc.parent_name in category_map:
                if uc.name not in category_map[uc.parent_name]["subcategories"]:
                    category_map[uc.parent_name]["subcategories"].append(uc.name)
            else:
                category_map[uc.parent_name] = {
                    "id": f"parent_{uc.parent_name.lower()}",
                    "name": uc.parent_name,
                    "icon": "Tag",
                    "color": "#818cf8",
                    "subcategories": [uc.name],
                    "is_custom": True,
                }
        else:
            if uc.name not in category_map:
                category_map[uc.name] = {
                    "id": uc.id,
                    "name": uc.name,
                    "icon": uc.icon or "Tag",
                    "color": uc.color or "#818cf8",
                    "subcategories": [],
                    "is_custom": True,
                }

    return {"categories": list(category_map.values())}

@router.post("/")
def create_category(
    req: CreateCategoryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clean_name = req.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Nom de catégorie requis")

    new_cat = Category(
        id=f"cat_{uuid.uuid4().hex[:12]}",
        user_id=current_user.id,
        name=clean_name,
        parent_name=req.parent_name.strip() if req.parent_name else None,
        icon=req.icon or "Tag",
        color=req.color or "#818cf8",
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)

    return {
        "status": "success",
        "category": {
            "id": new_cat.id,
            "name": new_cat.name,
            "parent_name": new_cat.parent_name,
            "icon": new_cat.icon,
            "color": new_cat.color,
        },
    }

@router.delete("/{category_id}")
def delete_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(
        (Category.id == category_id) & (Category.user_id == current_user.id)
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")

    db.delete(cat)
    db.commit()
    return {"status": "success", "message": "Catégorie supprimée"}
