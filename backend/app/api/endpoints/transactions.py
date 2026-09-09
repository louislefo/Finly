import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.core.database import get_db
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.user import User
from app.models.merchant_rule import MerchantRule
from app.core.security import get_current_user
from app.services.merchant_enrichment import fetch_company_info
from app.services.csv_parser_service import csv_parser_service
from app.services.cleaner_service import CleanerService
from app.services.categorizer_service import CategorizerService
from app.services.reconciliation_service import ReconciliationService

router = APIRouter()

class PreviewCsvRequest(BaseModel):
    csv_text: str
    custom_mapping: Optional[Dict[str, Any]] = None

class ImportCsvRequest(BaseModel):
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    account_type: Optional[str] = None
    csv_text: Optional[str] = None
    custom_mapping: Optional[Dict[str, Any]] = None
    transactions: Optional[List[Dict[str, Any]]] = None

class AssignProjectRequest(BaseModel):
    project_id: Optional[str] = None

class ExcludeBudgetRequest(BaseModel):
    is_excluded: bool

class UpdateCategoryRequest(BaseModel):
    category: str
    subcategory: Optional[str] = None
    apply_to_all_merchant: Optional[bool] = True

class UpdateLogoRequest(BaseModel):
    logo_url: Optional[str] = None  # "none", "https://...", or None
    apply_to_all_merchant: Optional[bool] = True

@router.get("/")
@router.get("", include_in_schema=False)
def list_transactions(
    account_id: Optional[str] = None,
    account_type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if account_id and account_id != "all":
        query = query.filter(Transaction.account_id == account_id)

    if category and category != "Toutes":
        query = query.filter(
            (Transaction.category == category) | (Transaction.subcategory == category)
        )

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Transaction.merchant_name.ilike(search_fmt)) |
            (Transaction.raw_label.ilike(search_fmt)) |
            (Transaction.category.ilike(search_fmt)) |
            (Transaction.subcategory.ilike(search_fmt))
        )

    # Join account information maps for the current user
    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    account_name_map = {a.id: a.name for a in accounts}
    account_type_map = {a.id: a.account_type for a in accounts}
    account_bank_map = {a.id: a.bank_name for a in accounts}

    # Fetch user merchant rules to identify user-classified expenses & custom logos
    user_rules = db.query(MerchantRule).filter(MerchantRule.user_id == current_user.id).all()
    user_classified_merchants = {r.merchant_pattern for r in user_rules}
    merchant_logo_rules = {r.merchant_pattern: r.logo_url for r in user_rules if r.logo_url is not None}

    if account_type and account_type != "all":
        target_account_ids = [a.id for a in accounts if a.account_type == account_type]
        query = query.filter(Transaction.account_id.in_(target_account_ids))

    total_count = query.count()
    transactions = query.order_by(Transaction.booking_date.desc()).offset(offset).limit(limit).all()

    return {
        "total": total_count,
        "transactions": [
            {
                "id": t.id,
                "merchant": t.merchant_name,
                "raw_label": t.raw_label,
                "rawLabel": t.raw_label,
                "date": t.booking_date,
                "time": t.booking_datetime.strftime("%H:%M") if t.booking_datetime else "12:00",
                "amount": t.amount,
                "currency": t.currency,
                "category": t.category,
                "subcategory": t.subcategory,
                "is_user_classified": bool(t.is_user_classified or (t.merchant_name and t.merchant_name in user_classified_merchants)),
                "is_excluded_from_budget": bool(t.is_excluded_from_budget),
                "account": account_name_map.get(t.account_id, "Compte"),
                "account_id": t.account_id,
                "account_type": account_type_map.get(t.account_id, "Compte Courant"),
                "bank": account_bank_map.get(t.account_id, "Banque"),
                "status": getattr(t, "status", "confirmed") or "confirmed",
                "project_id": t.project_id,
                "logo_url": t.logo_url if t.logo_url is not None else merchant_logo_rules.get(t.merchant_name),
            }
            for t in transactions
        ],
    }

@router.patch("/{tx_id}/logo")
def update_transaction_logo(
    tx_id: str,
    req: UpdateLogoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(
        (Transaction.id == tx_id) & (Transaction.user_id == current_user.id)
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    tx.logo_url = req.logo_url
    merchant_name = tx.merchant_name
    updated_count = 1

    if req.apply_to_all_merchant and merchant_name:
        existing_rule = db.query(MerchantRule).filter(
            (MerchantRule.user_id == current_user.id) &
            (MerchantRule.merchant_pattern == merchant_name)
        ).first()

        if existing_rule:
            existing_rule.logo_url = req.logo_url
        else:
            new_rule = MerchantRule(
                id=f"rule_{uuid.uuid4().hex[:12]}",
                user_id=current_user.id,
                merchant_pattern=merchant_name,
                category=tx.category or "Divers",
                subcategory=tx.subcategory,
                logo_url=req.logo_url,
            )
            db.add(new_rule)

        # Propagate to all existing transactions with same merchant_name
        same_merchant_txs = db.query(Transaction).filter(
            (Transaction.user_id == current_user.id) &
            (Transaction.merchant_name == merchant_name) &
            (Transaction.id != tx.id)
        ).all()

        for other_tx in same_merchant_txs:
            other_tx.logo_url = req.logo_url
            updated_count += 1

    db.commit()
    db.refresh(tx)

    return {
        "status": "success",
        "transaction_id": tx.id,
        "merchant": merchant_name,
        "logo_url": tx.logo_url,
        "updated_count": updated_count,
    }

@router.get("/enrichment/merchant")
async def search_merchant_company(
    query: str,
    current_user: User = Depends(get_current_user),
):
    return await fetch_company_info(query, query)

@router.get("/{tx_id}/company-info")
async def get_transaction_company_info(
    tx_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(
        (Transaction.id == tx_id) & (Transaction.user_id == current_user.id)
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    return await fetch_company_info(tx.merchant_name or "", tx.raw_label or "")

@router.patch("/{tx_id}/exclude-budget")
def toggle_exclude_budget(
    tx_id: str,
    req: ExcludeBudgetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(
        (Transaction.id == tx_id) & (Transaction.user_id == current_user.id)
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    tx.is_excluded_from_budget = req.is_excluded
    db.commit()
    db.refresh(tx)

    return {
        "status": "success",
        "transaction_id": tx.id,
        "is_excluded_from_budget": tx.is_excluded_from_budget,
    }

@router.patch("/{tx_id}/category")
def update_transaction_category(
    tx_id: str,
    req: UpdateCategoryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(
        (Transaction.id == tx_id) & (Transaction.user_id == current_user.id)
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    tx.category = req.category
    tx.subcategory = req.subcategory
    tx.is_user_classified = True

    updated_count = 1
    merchant_name = tx.merchant_name

    # Save rule to memory & propagate to all transactions from same merchant
    if req.apply_to_all_merchant and merchant_name:
        # Upsert rule
        existing_rule = db.query(MerchantRule).filter(
            (MerchantRule.user_id == current_user.id) &
            (MerchantRule.merchant_pattern == merchant_name)
        ).first()

        if existing_rule:
            existing_rule.category = req.category
            existing_rule.subcategory = req.subcategory
        else:
            new_rule = MerchantRule(
                id=f"rule_{uuid.uuid4().hex[:12]}",
                user_id=current_user.id,
                merchant_pattern=merchant_name,
                category=req.category,
                subcategory=req.subcategory,
            )
            db.add(new_rule)

        # Propagate to all existing transactions with same merchant_name
        same_merchant_txs = db.query(Transaction).filter(
            (Transaction.user_id == current_user.id) &
            (Transaction.merchant_name == merchant_name) &
            (Transaction.id != tx.id)
        ).all()

        for other_tx in same_merchant_txs:
            other_tx.category = req.category
            other_tx.subcategory = req.subcategory
            other_tx.is_user_classified = True
            updated_count += 1

    db.commit()
    db.refresh(tx)

    return {
        "status": "success",
        "transaction_id": tx.id,
        "category": tx.category,
        "subcategory": tx.subcategory,
        "merchant": merchant_name,
        "updated_count": updated_count,
        "is_user_classified": True,
    }

@router.patch("/{tx_id}/project")
def assign_project(
    tx_id: str,
    req: AssignProjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(
        (Transaction.id == tx_id) & (Transaction.user_id == current_user.id)
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    tx.project_id = req.project_id
    db.commit()
    db.refresh(tx)

    return {"status": "success", "transaction_id": tx.id, "project_id": tx.project_id}

@router.delete("/{tx_id}")
def delete_transaction(
    tx_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(
        (Transaction.id == tx_id) & (Transaction.user_id == current_user.id)
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    db.delete(tx)
    db.commit()

    return {"status": "success", "message": "Transaction supprimée", "transaction_id": tx_id}

@router.post("/preview-csv")
def preview_csv_transactions(
    req: PreviewCsvRequest,
    current_user: User = Depends(get_current_user),
):
    if not req.csv_text or not req.csv_text.strip():
        raise HTTPException(status_code=400, detail="Contenu CSV vide")
    return csv_parser_service.analyze_and_parse_csv(req.csv_text, req.custom_mapping)

@router.post("/import-csv")
def import_csv_transactions(
    req: ImportCsvRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import hashlib
    from datetime import datetime

    # 1. Resolve or create target account
    account_id = req.account_id
    account = None
    if account_id and account_id != "new":
        account = db.query(Account).filter((Account.id == account_id) & (Account.user_id == current_user.id)).first()

    if not account:
        account_name = req.account_name or "Relevé Importé (CSV)"
        account_type = req.account_type or "Compte Courant"
        account = db.query(Account).filter((Account.name == account_name) & (Account.user_id == current_user.id)).first()
        if not account:
            account = Account(
                id=f"acc_{uuid.uuid4().hex[:12]}",
                user_id=current_user.id,
                bank_account_id=f"csv_{uuid.uuid4().hex[:8]}",
                backend_name="csv_import",
                bank_name=account_name,
                name=account_name,
                account_type=account_type,
                balance=0.0,
                currency="EUR",
            )
            db.add(account)
            db.commit()
            db.refresh(account)

    # 2. Get transactions to import
    tx_list = req.transactions
    if not tx_list and req.csv_text:
        parsed = csv_parser_service.analyze_and_parse_csv(req.csv_text, req.custom_mapping)
        tx_list = parsed.get("all_transactions", [])

    if not tx_list:
        raise HTTPException(status_code=400, detail="Aucune transaction valide à importer")

    imported_count = 0
    updated_count = 0
    matched_tx_ids = set()
    user_rules = db.query(MerchantRule).filter(MerchantRule.user_id == current_user.id).all()
    rule_map = {r.merchant_pattern.lower(): r for r in user_rules}

    for tx_data in tx_list:
        booking_date = str(tx_data.get("date") or datetime.utcnow().strftime("%Y-%m-%d"))[:10]
        amount = round(float(tx_data.get("amount", 0.0)), 2)
        raw_label = str(tx_data.get("raw_label") or "Paiement").strip()
        merchant_name = tx_data.get("merchant_name") or CleanerService.clean_merchant_name(raw_label)
        category = tx_data.get("category")
        subcategory = tx_data.get("subcategory")
        logo_url = None

        matched_rule = rule_map.get(merchant_name.lower())
        if matched_rule:
            category = matched_rule.category
            subcategory = matched_rule.subcategory
            logo_url = matched_rule.logo_url
        elif not category or category.lower() in ["divers", "autre", "none"]:
            category = CategorizerService.categorize(merchant_name, raw_label, amount)

        label_hash = hashlib.md5(f"{account.id}_{booking_date}_{amount}_{raw_label.upper()}".encode()).hexdigest()[:10]
        bank_tx_id = tx_data.get("id") or f"csv_{account.id}_{label_hash}"

        # Fuzzy reconciliation (matches exact bank_tx_id, exact date+amount+label, or same day / +/-2 days with same amount & similar title)
        existing_tx = ReconciliationService.find_matching_transaction(
            db=db,
            user_id=current_user.id,
            account_id=account.id,
            booking_date=booking_date,
            amount=amount,
            raw_label=raw_label,
            merchant_name=merchant_name,
            bank_tx_id=bank_tx_id,
            exclude_tx_ids=matched_tx_ids,
        )

        if existing_tx:
            matched_tx_ids.add(existing_tx.id)
            if not existing_tx.is_user_classified:
                if category:
                    existing_tx.category = category
                if subcategory:
                    existing_tx.subcategory = subcategory
                if merchant_name:
                    existing_tx.merchant_name = merchant_name
            updated_count += 1
        else:
            new_tx = Transaction(
                id=f"tx_{uuid.uuid4().hex[:12]}",
                user_id=current_user.id,
                bank_tx_id=bank_tx_id,
                account_id=account.id,
                booking_date=booking_date,
                value_date=booking_date,
                amount=amount,
                currency=account.currency or "EUR",
                raw_label=raw_label,
                merchant_name=merchant_name,
                category=category or "Divers",
                subcategory=subcategory,
                status="confirmed",
                logo_url=logo_url,
            )
            db.add(new_tx)
            imported_count += 1

    db.commit()

    return {
        "status": "success",
        "message": f"{imported_count} opération(s) importée(s), {updated_count} déjà existante(s).",
        "account_id": account.id,
        "account_name": account.name,
        "imported_count": imported_count,
        "updated_count": updated_count,
        "total_processed": len(tx_list),
    }
