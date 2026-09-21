import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.models.category import Category
from app.models.budget import Budget
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
@router.get("", include_in_schema=False)
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_cats = db.query(Category).filter(Category.user_id == current_user.id).all()

    category_map: dict = {}

    for sys_cat in DEFAULT_SYSTEM_CATEGORIES:
        category_map[sys_cat["name"]] = {
            "id": f"sys_{sys_cat['name'].lower()}",
            "name": sys_cat["name"],
            "icon": sys_cat["icon"],
            "color": sys_cat["color"],
            "subcategories": list(sys_cat["subcategories"]),
            "subcategories_details": [
                {
                    "id": None,
                    "name": sub,
                    "parent_name": sys_cat["name"],
                    "icon": sys_cat["icon"],
                    "color": sys_cat["color"],
                    "is_custom": False,
                }
                for sub in sys_cat["subcategories"]
            ],
            "is_custom": False,
        }

    # Pass 1: Add custom top-level categories
    for uc in user_cats:
        if not uc.parent_name:
            if uc.name not in category_map:
                category_map[uc.name] = {
                    "id": uc.id,
                    "name": uc.name,
                    "icon": uc.icon or "Tag",
                    "color": uc.color or "#818cf8",
                    "subcategories": [],
                    "subcategories_details": [],
                    "is_custom": True,
                }
            else:
                category_map[uc.name]["id"] = uc.id
                category_map[uc.name]["is_custom"] = True
                if uc.icon:
                    category_map[uc.name]["icon"] = uc.icon
                if uc.color:
                    category_map[uc.name]["color"] = uc.color

    # Pass 2: Attach subcategories
    for uc in user_cats:
        if uc.parent_name:
            parent_key = uc.parent_name
            if parent_key not in category_map:
                category_map[parent_key] = {
                    "id": f"parent_{parent_key.lower()}",
                    "name": parent_key,
                    "icon": "Tag",
                    "color": "#818cf8",
                    "subcategories": [],
                    "subcategories_details": [],
                    "is_custom": True,
                }
            if uc.name not in category_map[parent_key]["subcategories"]:
                category_map[parent_key]["subcategories"].append(uc.name)

            category_map[parent_key]["subcategories_details"].append({
                "id": uc.id,
                "name": uc.name,
                "parent_name": parent_key,
                "icon": uc.icon or "Tag",
                "color": uc.color or "#818cf8",
                "is_custom": True,
            })

    return {"categories": list(category_map.values())}

@router.post("/")
@router.post("", include_in_schema=False)
def create_category(
    req: CreateCategoryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clean_name = req.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Nom de catégorie requis")

    parent_name = req.parent_name.strip() if req.parent_name and req.parent_name.strip() else None

    # Duplicate check
    if parent_name:
        for sc in DEFAULT_SYSTEM_CATEGORIES:
            if sc["name"].lower() == parent_name.lower():
                if any(s.lower() == clean_name.lower() for s in sc["subcategories"]):
                    raise HTTPException(status_code=400, detail=f"La sous-catégorie '{clean_name}' existe déjà dans '{parent_name}'.")
                break

        existing_sub = db.query(Category).filter(
            (Category.user_id == current_user.id) &
            (Category.parent_name == parent_name) &
            (Category.name.ilike(clean_name))
        ).first()
        if existing_sub:
            raise HTTPException(status_code=400, detail=f"La sous-catégorie '{clean_name}' existe déjà dans '{parent_name}'.")
    else:
        if any(sc["name"].lower() == clean_name.lower() for sc in DEFAULT_SYSTEM_CATEGORIES):
            raise HTTPException(status_code=400, detail=f"La catégorie '{clean_name}' existe déjà comme catégorie système.")

        existing_cat = db.query(Category).filter(
            (Category.user_id == current_user.id) &
            (Category.parent_name.is_(None)) &
            (Category.name.ilike(clean_name))
        ).first()
        if existing_cat:
            raise HTTPException(status_code=400, detail=f"La catégorie '{clean_name}' existe déjà.")

    new_cat = Category(
        id=f"cat_{uuid.uuid4().hex[:12]}",
        user_id=current_user.id,
        name=clean_name,
        parent_name=parent_name,
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
            "is_custom": True,
        },
    }

@router.delete("/{category_id}")
@router.delete("/{category_id}/", include_in_schema=False)
def delete_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if category_id.startswith("sys_"):
        raise HTTPException(status_code=400, detail="Les catégories système ne peuvent pas être supprimées.")

    cat = db.query(Category).filter(
        (Category.id == category_id) & (Category.user_id == current_user.id)
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")

    # If parent category, delete its custom subcategories & budget
    if not cat.parent_name:
        db.query(Category).filter(
            (Category.user_id == current_user.id) & (Category.parent_name == cat.name)
        ).delete(synchronize_session=False)
        db.query(Budget).filter(
            (Budget.user_id == current_user.id) & (Budget.category == cat.name)
        ).delete(synchronize_session=False)

    db.delete(cat)
    db.commit()
    return {"status": "success", "message": "Catégorie supprimée avec succès"}
