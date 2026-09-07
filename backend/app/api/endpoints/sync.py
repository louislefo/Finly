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
from app.models.merchant_rule import MerchantRule
from app.models.bank_connection import BankConnection
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

@router.get("/export-json")
def export_json_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export complete financial backup in JSON format for the authenticated user."""
    try:
        accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
        transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).order_by(Transaction.booking_date.desc()).all()
        projects = db.query(Project).filter(Project.user_id == current_user.id).all()
        categories = db.query(Category).filter(Category.user_id == current_user.id).all()
        budgets = db.query(Budget).filter(Budget.user_id == current_user.id).all()
        merchant_rules = db.query(MerchantRule).filter(MerchantRule.user_id == current_user.id).all()
        connections = db.query(BankConnection).filter(BankConnection.user_id == current_user.id).all()

        total_balance = sum(acc.balance or 0.0 for acc in accounts)

        acc_list = [
            {
                "id": a.id,
                "bank_account_id": a.bank_account_id,
                "backend_name": a.backend_name,
                "bank_name": a.bank_name,
                "bank": a.bank_name,
                "name": a.name,
                "account_type": a.account_type,
                "type": a.account_type,
                "balance": a.balance,
                "currency": a.currency,
                "iban": a.iban,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in accounts
        ]

        tx_list = [
            {
                "id": t.id,
                "bank_tx_id": t.bank_tx_id,
                "account_id": t.account_id,
                "booking_date": t.booking_date,
                "date": t.booking_date,
                "value_date": t.value_date,
                "amount": t.amount,
                "currency": t.currency,
                "raw_label": t.raw_label,
                "rawLabel": t.raw_label,
                "merchant_name": t.merchant_name,
                "merchant": t.merchant_name,
                "category": t.category,
                "subcategory": t.subcategory,
                "is_user_classified": t.is_user_classified,
                "is_excluded_from_budget": t.is_excluded_from_budget,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in transactions
        ]

        proj_list = [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "target_amount": p.target_amount,
                "targetAmount": p.target_amount,
                "current_amount": p.current_amount,
                "currentAmount": p.current_amount,
                "deadline": p.deadline,
                "category": p.category,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in projects
        ]

        cat_list = [
            {
                "id": c.id,
                "name": c.name,
                "parent_id": c.parent_id,
                "parent_name": c.parent_name,
                "icon": c.icon,
                "color": c.color,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in categories
        ]

        budget_dict = {
            "items": [
                {
                    "id": b.id,
                    "category": b.category,
                    "monthly_limit": b.monthly_limit,
                    "created_at": b.created_at.isoformat() if b.created_at else None,
                }
                for b in budgets
            ]
        }

        rules_list = [
            {
                "id": r.id,
                "merchant_pattern": r.merchant_pattern,
                "category": r.category,
                "subcategory": r.subcategory,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in merchant_rules
        ]

        conn_list = [
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

        return {
            "metadata": {
                "app": "Finly",
                "version": "1.0.0",
                "exported_at": datetime.utcnow().isoformat(),
                "user": {
                    "id": current_user.id,
                    "email": current_user.email,
                    "full_name": current_user.full_name,
                },
                "summary": {
                    "total_accounts": len(accounts),
                    "total_transactions": len(transactions),
                    "total_balance": total_balance,
                    "total_categories": len(categories),
                    "total_rules": len(merchant_rules),
                    "total_budgets": len(budgets),
                    "total_projects": len(projects),
                },
            },
            "accounts": acc_list,
            "transactions": tx_list,
            "projects": proj_list,
            "categories": cat_list,
            "budgets": budget_dict,
            "merchant_rules": rules_list,
            "bank_connections": conn_list,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'exportation des données: {str(e)}")

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
        imported_categories = 0
        imported_rules = 0

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
            acc_backend = acc.get("backend_name") or f"import_{acc_id}"
            acc_bank_id = acc.get("bank_account_id") or acc_id

            # Check if account already exists
            db_acc = db.query(Account).filter(
                (Account.user_id == current_user.id) &
                ((Account.id == acc_id) | (Account.bank_account_id == acc_bank_id) | (Account.name == acc_name))
            ).first()

            if db_acc:
                db_acc.balance = acc_balance
                db_acc.account_type = acc_type
                db_acc.bank_name = acc_bank
                if acc_iban:
                    db_acc.iban = acc_iban
                account_id_map[acc_id] = db_acc.id
                account_id_map[acc_name] = db_acc.id
            else:
                new_acc = Account(
                    id=acc_id,
                    user_id=current_user.id,
                    bank_account_id=acc_bank_id,
                    backend_name=acc_backend,
                    bank_name=acc_bank,
                    name=acc_name,
                    account_type=acc_type,
                    balance=acc_balance,
                    currency=acc.get("currency", "EUR"),
                    iban=acc_iban,
                )
                db.add(new_acc)
                account_id_map[acc_id] = acc_id
                account_id_map[acc_name] = acc_id
                imported_accounts += 1

        db.commit()

        # 2. Import Categories & Subcategories
        raw_categories = payload.get("categories", [])
        for cat in raw_categories:
            cat_name = cat.get("name")
            if not cat_name:
                continue

            parent_name = cat.get("parent_name")
            cat_icon = cat.get("icon", "Tag")
            cat_color = cat.get("color", "#818cf8")

            existing_cat = db.query(Category).filter(
                (Category.user_id == current_user.id) &
                (Category.name == cat_name) &
                (Category.parent_name == parent_name)
            ).first()

            if not existing_cat:
                new_cat = Category(
                    id=cat.get("id") or f"cat_{uuid.uuid4().hex[:12]}",
                    user_id=current_user.id,
                    name=cat_name,
                    parent_name=parent_name,
                    color=cat_color,
                    icon=cat_icon,
                )
                db.add(new_cat)
                imported_categories += 1

            # Subcategories listed in array
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
                        imported_categories += 1

        db.commit()

        # 3. Import Merchant Rules (Custom user categorization memory)
        raw_rules = payload.get("merchant_rules", [])
        for r in raw_rules:
            pattern = r.get("merchant_pattern") or r.get("merchant")
            rule_cat = r.get("category")
            rule_subcat = r.get("subcategory")
            if not pattern or not rule_cat:
                continue

            existing_rule = db.query(MerchantRule).filter(
                (MerchantRule.user_id == current_user.id) &
                (MerchantRule.merchant_pattern == pattern)
            ).first()

            if existing_rule:
                existing_rule.category = rule_cat
                existing_rule.subcategory = rule_subcat
            else:
                new_rule = MerchantRule(
                    id=r.get("id") or f"rule_{uuid.uuid4().hex[:12]}",
                    user_id=current_user.id,
                    merchant_pattern=pattern,
                    category=rule_cat,
                    subcategory=rule_subcat,
                )
                db.add(new_rule)
                imported_rules += 1

        db.commit()

        # 4. Import Budgets
        raw_budgets = payload.get("budgets", {})
        budget_items = []
        if isinstance(raw_budgets, dict):
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
                    id=b.get("id") or f"bdg_{uuid.uuid4().hex[:12]}",
                    user_id=current_user.id,
                    category=b_cat,
                    monthly_limit=b_limit,
                )
                db.add(new_b)
                imported_budgets += 1

        db.commit()

        # 5. Import Projects
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
                if proj.get("status"):
                    existing_proj.status = proj.get("status")
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

        # 6. Import Bank Connections metadata
        raw_conns = payload.get("bank_connections", [])
        for c in raw_conns:
            c_backend = c.get("backend_name")
            if not c_backend:
                continue

            existing_c = db.query(BankConnection).filter(
                (BankConnection.user_id == current_user.id) &
                (BankConnection.backend_name == c_backend)
            ).first()

            if not existing_c:
                new_c = BankConnection(
                    id=c.get("id") or f"conn_{uuid.uuid4().hex[:12]}",
                    user_id=current_user.id,
                    module_name=c.get("module_name", "generic"),
                    bank_name=c.get("bank_name", "Banque"),
                    login=c.get("login", ""),
                    backend_name=c_backend,
                    status=c.get("status", "connected"),
                    last_synced_at=datetime.utcnow(),
                )
                db.add(new_c)

        db.commit()

        # 7. Import Transactions
        raw_transactions = payload.get("transactions", [])
        for tx in raw_transactions:
            tx_id = tx.get("id") or f"tx_{uuid.uuid4().hex[:12]}"
            tx_amount = float(tx.get("amount", 0.0))
            raw_label = tx.get("rawLabel") or tx.get("raw_label") or tx.get("merchant") or "Paiement"
            booking_date = str(tx.get("date") or tx.get("booking_date") or datetime.utcnow().strftime("%Y-%m-%d")).split("T")[0]
            tx_merchant = tx.get("merchant") or tx.get("merchant_name") or CleanerService.clean_merchant_name(raw_label)
            tx_category = tx.get("category") or CategorizerService.categorize(tx_merchant, raw_label, tx_amount)
            tx_subcategory = tx.get("subcategory")
            is_user_classified = bool(tx.get("is_user_classified", True if tx.get("category") else False))
            is_excluded_from_budget = bool(tx.get("is_excluded_from_budget", False))

            # Resolve Account ID
            raw_acc_ref = tx.get("account_id") or tx.get("account")
            target_acc_id = account_id_map.get(raw_acc_ref)

            if not target_acc_id:
                matched_acc = db.query(Account).filter(
                    (Account.user_id == current_user.id) &
                    ((Account.id == raw_acc_ref) | (Account.name == raw_acc_ref) | (Account.bank_name == raw_acc_ref))
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

            if existing_tx:
                if tx_category:
                    existing_tx.category = tx_category
                if tx_subcategory:
                    existing_tx.subcategory = tx_subcategory
                existing_tx.is_user_classified = is_user_classified
                if "is_excluded_from_budget" in tx:
                    existing_tx.is_excluded_from_budget = is_excluded_from_budget
                if target_acc_id and not existing_tx.account_id:
                    existing_tx.account_id = target_acc_id
            else:
                new_tx = Transaction(
                    id=tx_id,
                    user_id=current_user.id,
                    bank_tx_id=tx.get("bank_tx_id", tx_id),
                    account_id=target_acc_id,
                    booking_date=booking_date,
                    value_date=tx.get("value_date", booking_date),
                    amount=tx_amount,
                    currency=tx.get("currency", "EUR"),
                    raw_label=raw_label,
                    merchant_name=tx_merchant,
                    category=tx_category,
                    subcategory=tx_subcategory,
                    is_user_classified=is_user_classified,
                    is_excluded_from_budget=is_excluded_from_budget,
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
                "categories": imported_categories,
                "rules": imported_rules,
            },
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erreur lors de l'import de la sauvegarde JSON: {str(e)}")

