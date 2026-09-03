import uuid
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.project import Project
from app.models.category import Category
from app.models.budget import Budget
from app.services.sync_service import sync_service
from app.services.cleaner_service import CleanerService
from app.services.categorizer_service import CategorizerService

router = APIRouter()

@router.post("/")
async def trigger_manual_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = await sync_service.sync_all_active_accounts(db, user_id=current_user.id)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la synchronisation manuelle: {str(e)}")

@router.post("/import-json")
async def import_json_backup(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import and restore full JSON backup into user's database."""
    try:
        imported_accounts = 0
        imported_transactions = 0
        imported_projects = 0
        imported_budgets = 0

        account_id_map = {}

        # 1. Import Accounts
        raw_accounts = payload.get("accounts", [])
        for acc in raw_accounts:
            acc_id = acc.get("id") or f"acc_{uuid.uuid4().hex[:12]}"
            acc_name = acc.get("name") or acc.get("bank") or "Compte Importé"
            acc_balance = float(acc.get("balance", 0.0))
            acc_type = acc.get("type") or acc.get("account_type") or "Compte Courant"
            acc_bank = acc.get("bank") or acc.get("bank_name") or "Banque"
            acc_iban = acc.get("iban")

            # Check if account already exists
            db_acc = db.query(Account).filter(
                (Account.user_id == current_user.id) &
                ((Account.id == acc_id) | (Account.name == acc_name))
            ).first()

            if db_acc:
                db_acc.balance = acc_balance
                db_acc.account_type = acc_type
                if acc_iban:
                    db_acc.iban = acc_iban
                account_id_map[acc_id] = db_acc.id
            else:
                new_acc = Account(
                    id=acc_id,
                    user_id=current_user.id,
                    bank_account_id=acc.get("bank_account_id", acc_id),
                    bank_name=acc_bank,
                    name=acc_name,
                    account_type=acc_type,
                    balance=acc_balance,
                    currency=acc.get("currency", "EUR"),
                    iban=acc_iban,
                )
                db.add(new_acc)
                account_id_map[acc_id] = acc_id
                imported_accounts += 1

        db.commit()

        # 2. Import Categories & Subcategories
        raw_categories = payload.get("categories", [])
        for cat in raw_categories:
            cat_name = cat.get("name")
            if not cat_name:
                continue

            existing_cat = db.query(Category).filter(
                (Category.user_id == current_user.id) & (Category.name == cat_name)
            ).first()

            if not existing_cat:
                new_cat = Category(
                    id=f"cat_{uuid.uuid4().hex[:12]}",
                    user_id=current_user.id,
                    name=cat_name,
                    color=cat.get("color"),
                    icon=cat.get("icon"),
                )
                db.add(new_cat)

            # Subcategories
            for sub in cat.get("subcategories", []):
                sub_name = sub if isinstance(sub, str) else sub.get("name")
                if sub_name:
                    existing_sub = db.query(Category).filter(
                        (Category.user_id == current_user.id) &
                        (Category.name == sub_name) &
                        (Category.parent_name == cat_name)
                    ).first()
                    if not existing_sub:
                        new_sub = Category(
                            id=f"sub_{uuid.uuid4().hex[:12]}",
                            user_id=current_user.id,
                            name=sub_name,
                            parent_name=cat_name,
                        )
                        db.add(new_sub)

        db.commit()

        # 3. Import Budgets
        raw_budgets = payload.get("budgets", {})
        budget_items = []
        if isinstance(raw_budgets, dict):
            # Could be BudgetSummary { items: [...] } or direct map
            if "items" in raw_budgets:
                budget_items = raw_budgets["items"]
            else:
                budget_items = [{"category": k, "monthly_limit": v} for k, v in raw_budgets.items()]
        elif isinstance(raw_budgets, list):
            budget_items = raw_budgets

        for b in budget_items:
            b_cat = b.get("category")
            b_limit = float(b.get("monthly_limit", 0.0))
            if not b_cat or b_limit <= 0:
                continue

            existing_b = db.query(Budget).filter(
                (Budget.user_id == current_user.id) & (Budget.category == b_cat)
            ).first()

            if existing_b:
                existing_b.monthly_limit = b_limit
            else:
                new_b = Budget(
                    id=f"bdg_{uuid.uuid4().hex[:12]}",
                    user_id=current_user.id,
                    category=b_cat,
                    monthly_limit=b_limit,
                )
                db.add(new_b)
                imported_budgets += 1

        db.commit()

        # 4. Import Projects
        raw_projects = payload.get("projects", [])
        for proj in raw_projects:
            p_id = proj.get("id") or f"prj_{uuid.uuid4().hex[:12]}"
            p_name = proj.get("name", "Projet Importé")
            p_target = float(proj.get("targetAmount") or proj.get("target_amount") or 0.0)
            p_current = float(proj.get("currentAmount") or proj.get("current_amount") or 0.0)
            p_deadline = proj.get("deadline", "2026-12-31")
            p_cat = proj.get("category", "Général")

            existing_proj = db.query(Project).filter(
                (Project.user_id == current_user.id) &
                ((Project.id == p_id) | (Project.name == p_name))
            ).first()

            if existing_proj:
                existing_proj.target_amount = p_target
                existing_proj.current_amount = p_current
                existing_proj.deadline = p_deadline
                existing_proj.category = p_cat
            else:
                new_proj = Project(
                    id=p_id,
                    user_id=current_user.id,
                    name=p_name,
                    description=proj.get("description"),
                    target_amount=p_target,
                    current_amount=p_current,
                    deadline=p_deadline,
                    category=p_cat,
                    status=proj.get("status", "in_progress"),
                )
                db.add(new_proj)
                imported_projects += 1

        db.commit()

        # 5. Import Transactions
        raw_transactions = payload.get("transactions", [])
        for tx in raw_transactions:
            tx_id = tx.get("id") or f"tx_{uuid.uuid4().hex[:12]}"
            tx_amount = float(tx.get("amount", 0.0))
            raw_label = tx.get("rawLabel") or tx.get("raw_label") or tx.get("merchant") or "Paiement"
            booking_date = tx.get("date", datetime.utcnow().strftime("%Y-%m-%d")).split("T")[0]
            tx_merchant = tx.get("merchant") or CleanerService.clean_merchant_name(raw_label)
            tx_category = tx.get("category") or CategorizerService.categorize(tx_merchant, raw_label, tx_amount)
            tx_subcategory = tx.get("subcategory")

            # Resolve Account ID
            raw_acc_ref = tx.get("account_id") or tx.get("account")
            target_acc_id = account_id_map.get(raw_acc_ref)

            if not target_acc_id:
                # Find matching account by name or get first account
                matched_acc = db.query(Account).filter(
                    (Account.user_id == current_user.id) &
                    ((Account.name == raw_acc_ref) | (Account.bank_name == raw_acc_ref))
                ).first()
                if matched_acc:
                    target_acc_id = matched_acc.id
                else:
                    first_acc = db.query(Account).filter(Account.user_id == current_user.id).first()
                    target_acc_id = first_acc.id if first_acc else None

            # Deduplication
            existing_tx = db.query(Transaction).filter(
                (Transaction.user_id == current_user.id) &
                ((Transaction.id == tx_id) |
                 ((Transaction.booking_date == booking_date) &
                  (Transaction.amount == tx_amount) &
                  (Transaction.raw_label == raw_label)))
            ).first()

            if not existing_tx:
                new_tx = Transaction(
                    id=tx_id,
                    user_id=current_user.id,
                    bank_tx_id=tx.get("bank_tx_id", tx_id),
                    account_id=target_acc_id,
                    booking_date=booking_date,
                    value_date=booking_date,
                    amount=tx_amount,
                    currency=tx.get("currency", "EUR"),
                    raw_label=raw_label,
                    merchant_name=tx_merchant,
                    category=tx_category,
                    subcategory=tx_subcategory,
                )
                db.add(new_tx)
                imported_transactions += 1

        db.commit()

        return {
            "status": "success",
            "message": "Sauvegarde JSON importée avec succès",
            "imported": {
                "accounts": imported_accounts,
                "transactions": imported_transactions,
                "projects": imported_projects,
                "budgets": imported_budgets,
            },
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erreur lors de l'import de la sauvegarde JSON: {str(e)}")
