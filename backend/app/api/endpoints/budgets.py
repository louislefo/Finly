import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.models.budget import Budget
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()

DEFAULT_CATEGORIES = [
    "Alimentation",
    "Transports",
    "Logement",
    "Abonnements",
    "Loisirs & Sorties",
    "Santé & Bien-être",
    "Divers",
]

class SetBudgetRequest(BaseModel):
    category: str
    monthly_limit: float

@router.get("/")
def get_budgets_summary(
    month: Optional[str] = None, # format YYYY-MM or 'last_30_days'
    account_type: Optional[str] = "checking", # 'checking' (Compte Courant / Dépôt) or 'all'
    account_id: Optional[str] = None,
    exclude_transfers: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import timedelta
    from app.models.account import Account

    # 1. Accounts filter
    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    checking_acc_ids = {a.id for a in accounts if a.account_type in ["Compte Courant", "checking", "deposit", "Dépôt", "Courant"]}

    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if month == "last_30_days":
        cutoff_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        query = query.filter(Transaction.booking_date >= cutoff_date)
        period_identifier = "last_30_days"
    else:
        period_identifier = month or datetime.utcnow().strftime("%Y-%m")
        query = query.filter(Transaction.booking_date.startswith(period_identifier))

    # Account filtering: if checking selected, restrict to checking/deposit accounts
    if account_id and account_id != "all":
        query = query.filter(Transaction.account_id == account_id)
    elif account_type == "checking" and checking_acc_ids:
        query = query.filter(Transaction.account_id.in_(checking_acc_ids))

    month_txs = query.all()

    # Fetch custom user budgets
    saved_budgets = db.query(Budget).filter(Budget.user_id == current_user.id).all()
    budget_map = {b.category: b.monthly_limit for b in saved_budgets}

    # Fetch all custom categories for user
    user_cats = db.query(Category).filter(Category.user_id == current_user.id).all()
    all_categories = list(DEFAULT_CATEGORIES)
    for uc in user_cats:
        if not uc.parent_name and uc.name not in all_categories:
            all_categories.append(uc.name)

    # Aggregate spending per category
    spent_by_category: dict = {}
    txs_by_category: dict = {}

    INTERNAL_TRANSFER_CATEGORIES = {"Virements & Épargne", "Virement interne", "Virement", "Épargne"}

    for tx in month_txs:
        cat = tx.category or "Divers"
        sub = tx.subcategory or ""

        # If exclude_transfers is True, skip internal transfers and savings movements
        if exclude_transfers:
            if cat in INTERNAL_TRANSFER_CATEGORIES or sub in INTERNAL_TRANSFER_CATEGORIES:
                continue
            raw_upper = (tx.raw_label or "").upper()
            if any(k in raw_upper for k in ["VIR INTERNE", "VIREMENT INTERNE", "VIR DE VOTRE COMPTE", "VERS VOTRE COMPTE", "ALIMENTATION COMPTE", "VERSEMENT EPARGNE"]):
                continue

        val = tx.amount
        # If expense (amount < 0), count as spending
        if val < 0:
            if cat not in spent_by_category:
                spent_by_category[cat] = 0.0
                txs_by_category[cat] = []
            spent_by_category[cat] += abs(val)
            txs_by_category[cat].append({
                "id": tx.id,
                "merchant": tx.merchant_name,
                "raw_label": tx.raw_label,
                "date": tx.booking_date,
                "amount": tx.amount,
                "category": tx.category,
                "subcategory": tx.subcategory,
            })

    # Prepare response items
    items = []
    total_budget = 0.0
    total_spent = 0.0

    all_active_cats = list(set(all_categories + list(spent_by_category.keys()) + list(budget_map.keys())))

    for cat_name in all_active_cats:
        # Don't show transfer category in regular expense budget if transfers are excluded
        if exclude_transfers and cat_name in INTERNAL_TRANSFER_CATEGORIES:
            continue

        limit = budget_map.get(cat_name, 0.0)
        spent = round(spent_by_category.get(cat_name, 0.0), 2)
        txs = txs_by_category.get(cat_name, [])

        total_budget += limit
        total_spent += spent

        percentage = round((spent / limit * 100), 1) if limit > 0 else (100.0 if spent > 0 else 0.0)

        items.append({
            "category": cat_name,
            "monthly_limit": limit,
            "spent": spent,
            "remaining": round(max(0.0, limit - spent), 2),
            "percentage": percentage,
            "transactions_count": len(txs),
            "transactions": txs,
        })

    # Sort: categories with spending or limit first
    items.sort(key=lambda x: (x["spent"], x["monthly_limit"]), reverse=True)

    return {
        "month": period_identifier,
        "account_type": account_type,
        "exclude_transfers": exclude_transfers,
        "total_budget": round(total_budget, 2),
        "total_spent": round(total_spent, 2),
        "remaining_budget": round(max(0.0, total_budget - total_spent), 2),
        "items": items,
    }

@router.post("/")
def set_budget(
    req: SetBudgetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clean_cat = req.category.strip()
    if not clean_cat:
        raise HTTPException(status_code=400, detail="Catégorie requise")

    budget = db.query(Budget).filter(
        (Budget.user_id == current_user.id) & (Budget.category == clean_cat)
    ).first()

    if budget:
        budget.monthly_limit = max(0.0, req.monthly_limit)
    else:
        budget = Budget(
            id=f"bdg_{uuid.uuid4().hex[:12]}",
            user_id=current_user.id,
            category=clean_cat,
            monthly_limit=max(0.0, req.monthly_limit),
        )
        db.add(budget)

    db.commit()
    db.refresh(budget)

    return {
        "status": "success",
        "budget": {
            "id": budget.id,
            "category": budget.category,
            "monthly_limit": budget.monthly_limit,
        },
    }

@router.delete("/{category}")
def delete_budget(
    category: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = db.query(Budget).filter(
        (Budget.user_id == current_user.id) & (Budget.category == category)
    ).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Budget non trouvé")

    db.delete(budget)
    db.commit()

    return {"status": "success", "message": "Budget supprimé"}
