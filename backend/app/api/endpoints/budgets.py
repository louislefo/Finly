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

    # 1. Accounts filter: Include checking & deposit accounts from all connected banks, strictly exclude savings accounts
    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()

    def is_deposit_account(a: Account) -> bool:
        t = (a.account_type or "").lower()
        name = (a.name or "").lower()
        # Explicitly exclude savings / investments
        if any(k in t or k in name for k in ["livret", "epargne", "épargne", "ldd", "lep", "pea", "assurance", "titre", "placement"]):
            return False
        if any(k in t for k in ["courant", "checking", "deposit", "dépôt", "depot", "vue"]):
            return True
        return True

    checking_acc_ids = {a.id for a in accounts if is_deposit_account(a)}

    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if month == "last_30_days":
        cutoff_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        query = query.filter(Transaction.booking_date >= cutoff_date)
        period_identifier = "last_30_days"
    else:
        period_identifier = month or datetime.utcnow().strftime("%Y-%m")
        query = query.filter(Transaction.booking_date.startswith(period_identifier))

    # Account filtering: if specific account selected, use it; otherwise use all deposit accounts across banks
    if account_id and account_id != "all":
        query = query.filter(Transaction.account_id == account_id)
    elif checking_acc_ids:
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

    # Aggregate spending & income per category
    spent_by_category: dict = {}
    txs_by_category: dict = {}
    excluded_spent_by_category: dict = {}
    excluded_count_by_category: dict = {}
    income_by_category: dict = {}
    income_txs_by_category: dict = {}
    total_excluded_amount = 0.0
    total_excluded_count = 0
    total_income = 0.0

    INTERNAL_TRANSFER_CATEGORIES = {"Virements & Épargne", "Virement interne", "Virement", "Épargne"}

    savings_transfers_list = []
    total_savings_transfers = 0.0

    for tx in month_txs:
        cat = tx.category or "Divers"
        sub = tx.subcategory or ""
        val = tx.amount
        is_excluded = bool(tx.is_excluded_from_budget)
        raw_upper = (tx.raw_label or "").upper()
        merchant_upper = (tx.merchant_name or "").upper()

        is_internal_transfer = False
        if cat in INTERNAL_TRANSFER_CATEGORIES or sub in INTERNAL_TRANSFER_CATEGORIES:
            # Check if it is an outgoing internal transfer or savings
            if any(k in raw_upper or k in merchant_upper for k in ["VIR INTERNE", "VIREMENT INTERNE", "VIR DE VOTRE COMPTE", "VERS VOTRE COMPTE", "ALIMENTATION COMPTE", "VERSEMENT EPARGNE", "SEPA M LOUIS"]):
                is_internal_transfer = True

        # Expense (amount < 0), count as spending
        if val < 0:
            abs_val = abs(val)

            if is_internal_transfer:
                savings_transfers_list.append({
                    "id": tx.id,
                    "merchant": tx.merchant_name,
                    "raw_label": tx.raw_label,
                    "date": tx.booking_date,
                    "amount": tx.amount,
                    "category": "Épargne & Investissements",
                    "subcategory": tx.subcategory or "Virement Épargne",
                })
                total_savings_transfers += abs_val

            # If exclude_transfers is True, skip internal transfers from expense budget
            if exclude_transfers and is_internal_transfer:
                continue

            if cat not in spent_by_category:
                spent_by_category[cat] = 0.0
                excluded_spent_by_category[cat] = 0.0
                excluded_count_by_category[cat] = 0
                txs_by_category[cat] = []

            if is_excluded:
                excluded_spent_by_category[cat] += abs_val
                excluded_count_by_category[cat] += 1
                total_excluded_amount += abs_val
                total_excluded_count += 1
            else:
                spent_by_category[cat] += abs_val

            txs_by_category[cat].append({
                "id": tx.id,
                "merchant": tx.merchant_name,
                "raw_label": tx.raw_label,
                "date": tx.booking_date,
                "amount": tx.amount,
                "category": tx.category,
                "subcategory": tx.subcategory,
                "is_excluded_from_budget": is_excluded,
            })
        elif val > 0:
            # Income (amount > 0), count as cashflow inflow
            # Determine specific and clean source label
            if "VIR.PERMANENT" in raw_upper or "VIR.PERMANENT" in merchant_upper or "SALAIRE" in raw_upper or "SALAIRE" in merchant_upper:
                income_label = tx.merchant_name or "Salaire & Virement Récurrent"
            elif "WERO" in raw_upper or "INSTANTANE" in raw_upper or "WERO" in merchant_upper:
                income_label = tx.merchant_name or "Remboursement & Virement Reçu"
            elif tx.merchant_name and tx.merchant_name not in ["Divers", "Autre", ""]:
                income_label = tx.merchant_name
            elif sub:
                income_label = sub
            elif cat and cat not in ["Divers", "Autre", ""]:
                income_label = cat
            else:
                income_label = "Autre Revenu"

            if income_label not in income_by_category:
                income_by_category[income_label] = 0.0
                income_txs_by_category[income_label] = []

            income_by_category[income_label] += val
            total_income += val
            income_txs_by_category[income_label].append({
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
        ex_spent = round(excluded_spent_by_category.get(cat_name, 0.0), 2)
        ex_count = excluded_count_by_category.get(cat_name, 0)
        txs = txs_by_category.get(cat_name, [])

        total_budget += limit
        total_spent += spent

        percentage = round((spent / limit * 100), 1) if limit > 0 else (100.0 if spent > 0 else 0.0)

        items.append({
            "category": cat_name,
            "monthly_limit": limit,
            "spent": spent,
            "excluded_spent": ex_spent,
            "excluded_count": ex_count,
            "remaining": round(max(0.0, limit - spent), 2),
            "percentage": percentage,
            "transactions_count": len([t for t in txs if not t.get("is_excluded_from_budget")]),
            "transactions": txs,
        })

    # Sort: categories with spending or limit first
    items.sort(key=lambda x: (x["spent"], x["monthly_limit"]), reverse=True)

    incomes_list = [
        {
            "category": k,
            "amount": round(v, 2),
            "transactions_count": len(income_txs_by_category.get(k, [])),
            "transactions": income_txs_by_category.get(k, []),
        }
        for k, v in income_by_category.items()
    ]
    incomes_list.sort(key=lambda x: x["amount"], reverse=True)

    return {
        "month": period_identifier,
        "account_type": account_type,
        "exclude_transfers": exclude_transfers,
        "total_budget": round(total_budget, 2),
        "total_spent": round(total_spent, 2),
        "total_income": round(total_income, 2),
        "net_cashflow": round(total_income - total_spent, 2),
        "remaining_budget": round(max(0.0, total_budget - total_spent), 2),
        "total_excluded_amount": round(total_excluded_amount, 2),
        "excluded_transactions_count": total_excluded_count,
        "total_savings_transfers": round(total_savings_transfers, 2),
        "savings_transfers": savings_transfers_list,
        "incomes": incomes_list,
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

    if req.monthly_limit <= 0:
        if budget:
            db.delete(budget)
            db.commit()
        return {
            "status": "success",
            "message": "Budget réinitialisé",
            "budget": {"category": clean_cat, "monthly_limit": 0.0},
        }

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
