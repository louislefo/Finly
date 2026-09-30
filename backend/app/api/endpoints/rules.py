import json
import re
import uuid
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.models.categorization_rule import CategorizationRule
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.user import User
from app.core.security import get_current_user
from app.services.categorizer_service import CategorizerService

router = APIRouter()


# ----------------------------------------------------------------------
# Request / Response Schemas
# ----------------------------------------------------------------------
class RuleCreateRequest(BaseModel):
    name: str
    pattern: str
    match_type: Optional[str] = "contains"  # contains, exact, regex, starts_with, ends_with
    apply_to_field: Optional[str] = "all"   # all, raw_label, merchant_name
    account_id: Optional[str] = None
    amount_type: Optional[str] = "any"      # any, expense, income
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    category: str
    subcategory: Optional[str] = None
    tags: Optional[Any] = None              # List of strings or string
    is_excluded_from_budget: Optional[bool] = False
    mark_as_transfer: Optional[bool] = False
    logo_url: Optional[str] = None
    is_active: Optional[bool] = True
    priority: Optional[int] = 0


class RuleUpdateRequest(BaseModel):
    name: Optional[str] = None
    pattern: Optional[str] = None
    match_type: Optional[str] = None
    apply_to_field: Optional[str] = None
    account_id: Optional[str] = None
    amount_type: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: Optional[Any] = None
    is_excluded_from_budget: Optional[bool] = None
    mark_as_transfer: Optional[bool] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


class RuleReorderRequest(BaseModel):
    rule_ids: List[str]


class RuleTestRequest(BaseModel):
    pattern: str
    match_type: Optional[str] = "contains"
    apply_to_field: Optional[str] = "all"
    account_id: Optional[str] = None
    amount_type: Optional[str] = "any"
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None


class BatchApplyRequest(BaseModel):
    rule_ids: Optional[List[str]] = None
    overwrite_user_classified: Optional[bool] = False
    account_id: Optional[str] = None


class SingleApplyRequest(BaseModel):
    overwrite_user_classified: Optional[bool] = False


# ----------------------------------------------------------------------
# Helper Functions
# ----------------------------------------------------------------------
def _parse_tags(tags_val: Any) -> List[str]:
    if not tags_val:
        return []
    if isinstance(tags_val, list):
        return [str(t).strip() for t in tags_val if str(t).strip()]
    if isinstance(tags_val, str):
        try:
            parsed = json.loads(tags_val)
            if isinstance(parsed, list):
                return [str(t).strip() for t in parsed if str(t).strip()]
        except Exception:
            pass
        # Fallback to comma-separated
        return [t.strip() for t in tags_val.split(",") if t.strip()]
    return []


def _serialize_tags(tags_val: Any) -> Optional[str]:
    tags_list = _parse_tags(tags_val)
    if not tags_list:
        return None
    return json.dumps(tags_list)


def _validate_rule_data(pattern: str, match_type: str):
    if not pattern or not pattern.strip():
        raise HTTPException(status_code=400, detail="Le motif de correspondance est requis.")
    if match_type == "regex":
        try:
            re.compile(pattern.strip())
        except re.error as e:
            raise HTTPException(status_code=400, detail=f"Expression régulière invalide: {str(e)}")


def _format_rule_response(rule: CategorizationRule, account_map: Dict[str, str], matched_count: int = 0) -> Dict[str, Any]:
    return {
        "id": rule.id,
        "name": rule.name,
        "is_active": bool(rule.is_active),
        "priority": rule.priority or 0,
        "pattern": rule.pattern,
        "match_type": rule.match_type or "contains",
        "apply_to_field": rule.apply_to_field or "all",
        "account_id": rule.account_id,
        "account_name": account_map.get(rule.account_id) if rule.account_id else None,
        "amount_type": rule.amount_type or "any",
        "min_amount": rule.min_amount,
        "max_amount": rule.max_amount,
        "category": rule.category,
        "subcategory": rule.subcategory,
        "tags": _parse_tags(rule.tags),
        "is_excluded_from_budget": bool(rule.is_excluded_from_budget),
        "mark_as_transfer": bool(rule.mark_as_transfer),
        "logo_url": rule.logo_url,
        "matched_count": matched_count,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
        "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
    }


# ----------------------------------------------------------------------
# Endpoints
# ----------------------------------------------------------------------
@router.get("/")
@router.get("", include_in_schema=False)
def list_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all categorization rules for the authenticated user."""
    rules = db.query(CategorizationRule).filter(
        CategorizationRule.user_id == current_user.id
    ).order_by(CategorizationRule.priority.desc(), CategorizationRule.created_at.desc()).all()

    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    account_map = {a.id: a.name for a in accounts}

    # Fetch user transactions to calculate real match counts
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()

    rule_match_counts = {r.id: 0 for r in rules}
    for tx in transactions:
        for r in rules:
            if CategorizerService.matches_rule(
                r,
                merchant=tx.merchant_name,
                raw_label=tx.raw_label,
                amount=tx.amount,
                account_id=tx.account_id,
            ):
                rule_match_counts[r.id] += 1

    formatted_rules = [
        _format_rule_response(r, account_map, matched_count=rule_match_counts.get(r.id, 0))
        for r in rules
    ]

    return {
        "rules": formatted_rules,
        "total": len(formatted_rules),
    }


@router.post("/")
@router.post("", include_in_schema=False)
def create_rule(
    req: RuleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new categorization rule."""
    match_type = req.match_type or "contains"
    _validate_rule_data(req.pattern, match_type)

    rule_name = (req.name or "").strip() or req.pattern.strip()

    # Determine default priority (highest existing priority + 1)
    if req.priority is None or req.priority == 0:
        max_prio = db.query(CategorizationRule.priority).filter(
            CategorizationRule.user_id == current_user.id
        ).order_by(CategorizationRule.priority.desc()).first()
        new_priority = (max_prio[0] + 1) if max_prio and max_prio[0] is not None else 1
    else:
        new_priority = req.priority

    new_rule = CategorizationRule(
        id=f"rule_{uuid.uuid4().hex[:12]}",
        user_id=current_user.id,
        name=rule_name,
        is_active=req.is_active if req.is_active is not None else True,
        priority=new_priority,
        pattern=req.pattern.strip(),
        match_type=match_type,
        apply_to_field=req.apply_to_field or "all",
        account_id=req.account_id if req.account_id and req.account_id != "all" else None,
        amount_type=req.amount_type or "any",
        min_amount=req.min_amount,
        max_amount=req.max_amount,
        category=req.category.strip() if req.category else "Divers",
        subcategory=req.subcategory.strip() if req.subcategory else None,
        tags=_serialize_tags(req.tags),
        is_excluded_from_budget=bool(req.is_excluded_from_budget),
        mark_as_transfer=bool(req.mark_as_transfer),
        logo_url=req.logo_url,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)

    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    account_map = {a.id: a.name for a in accounts}

    return {
        "status": "success",
        "rule": _format_rule_response(new_rule, account_map, matched_count=0),
    }


@router.get("/{rule_id}")
def get_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single rule by ID."""
    rule = db.query(CategorizationRule).filter(
        (CategorizationRule.id == rule_id) & (CategorizationRule.user_id == current_user.id)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Règle non trouvée")

    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    account_map = {a.id: a.name for a in accounts}

    return {"rule": _format_rule_response(rule, account_map)}


@router.put("/{rule_id}")
def update_rule(
    rule_id: str,
    req: RuleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing categorization rule."""
    rule = db.query(CategorizationRule).filter(
        (CategorizationRule.id == rule_id) & (CategorizationRule.user_id == current_user.id)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Règle non trouvée")

    if req.pattern is not None or req.match_type is not None:
        target_pattern = req.pattern if req.pattern is not None else rule.pattern
        target_match = req.match_type if req.match_type is not None else rule.match_type
        _validate_rule_data(target_pattern, target_match)
        rule.pattern = target_pattern.strip()
        rule.match_type = target_match

    if req.name is not None:
        rule.name = req.name.strip()
    if req.apply_to_field is not None:
        rule.apply_to_field = req.apply_to_field
    if req.account_id is not None:
        rule.account_id = None if req.account_id in ("", "all") else req.account_id
    if req.amount_type is not None:
        rule.amount_type = req.amount_type
    if req.min_amount is not None:
        rule.min_amount = req.min_amount
    if req.max_amount is not None:
        rule.max_amount = req.max_amount
    if req.category is not None:
        rule.category = req.category.strip()
    if req.subcategory is not None:
        rule.subcategory = req.subcategory.strip() if req.subcategory else None
    if req.tags is not None:
        rule.tags = _serialize_tags(req.tags)
    if req.is_excluded_from_budget is not None:
        rule.is_excluded_from_budget = bool(req.is_excluded_from_budget)
    if req.mark_as_transfer is not None:
        rule.mark_as_transfer = bool(req.mark_as_transfer)
    if req.logo_url is not None:
        rule.logo_url = req.logo_url
    if req.is_active is not None:
        rule.is_active = bool(req.is_active)
    if req.priority is not None:
        rule.priority = req.priority

    rule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rule)

    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    account_map = {a.id: a.name for a in accounts}

    return {
        "status": "success",
        "rule": _format_rule_response(rule, account_map),
    }


@router.patch("/{rule_id}/toggle")
def toggle_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle the active status of a rule."""
    rule = db.query(CategorizationRule).filter(
        (CategorizationRule.id == rule_id) & (CategorizationRule.user_id == current_user.id)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Règle non trouvée")

    rule.is_active = not bool(rule.is_active)
    rule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rule)

    return {
        "status": "success",
        "rule_id": rule.id,
        "is_active": rule.is_active,
    }


@router.delete("/{rule_id}")
def delete_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a categorization rule."""
    rule = db.query(CategorizationRule).filter(
        (CategorizationRule.id == rule_id) & (CategorizationRule.user_id == current_user.id)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Règle non trouvée")

    db.delete(rule)
    db.commit()

    return {
        "status": "success",
        "message": "Règle supprimée avec succès",
        "rule_id": rule_id,
    }


@router.post("/reorder")
def reorder_rules(
    req: RuleReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reorder rules priorities according to the submitted list of IDs.
    First in the array receives the highest priority.
    """
    total = len(req.rule_ids)
    for idx, rule_id in enumerate(req.rule_ids):
        rule = db.query(CategorizationRule).filter(
            (CategorizationRule.id == rule_id) & (CategorizationRule.user_id == current_user.id)
        ).first()
        if rule:
            rule.priority = total - idx
    db.commit()

    return {"status": "success", "message": "Ordre des règles mis à jour"}


@router.post("/test")
def test_rule_pattern(
    req: RuleTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Test a rule configuration against existing transactions without modifying them.
    Returns matched transaction samples and total matches count.
    """
    match_type = req.match_type or "contains"
    _validate_rule_data(req.pattern, match_type)

    dummy_rule = CategorizationRule(
        pattern=req.pattern.strip(),
        match_type=match_type,
        apply_to_field=req.apply_to_field or "all",
        account_id=req.account_id if req.account_id and req.account_id != "all" else None,
        amount_type=req.amount_type or "any",
        min_amount=req.min_amount,
        max_amount=req.max_amount,
        is_active=True,
    )

    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if req.account_id and req.account_id != "all":
        query = query.filter(Transaction.account_id == req.account_id)

    transactions = query.order_by(Transaction.booking_date.desc()).all()

    matched_samples = []
    matched_count = 0

    for tx in transactions:
        if CategorizerService.matches_rule(
            dummy_rule,
            merchant=tx.merchant_name,
            raw_label=tx.raw_label,
            amount=tx.amount,
            account_id=tx.account_id,
        ):
            matched_count += 1
            if len(matched_samples) < 20:
                matched_samples.append({
                    "id": tx.id,
                    "date": tx.booking_date,
                    "amount": tx.amount,
                    "raw_label": tx.raw_label,
                    "merchant_name": tx.merchant_name,
                    "current_category": tx.category,
                    "current_subcategory": tx.subcategory,
                    "is_user_classified": bool(tx.is_user_classified),
                })

    return {
        "matched_count": matched_count,
        "samples": matched_samples,
        "pattern": req.pattern,
        "match_type": match_type,
    }


@router.post("/batch-apply")
def batch_apply_rules(
    req: BatchApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Batch process and apply active categorization rules retrospectively on past transactions.
    """
    rules_query = db.query(CategorizationRule).filter(
        (CategorizationRule.user_id == current_user.id) &
        (CategorizationRule.is_active == True)
    )
    if req.rule_ids:
        rules_query = rules_query.filter(CategorizationRule.id.in_(req.rule_ids))

    rules = rules_query.order_by(
        CategorizationRule.priority.desc(),
        CategorizationRule.created_at.asc()
    ).all()

    if not rules:
        return {
            "status": "success",
            "message": "Aucune règle active à appliquer",
            "total_scanned": 0,
            "matched_count": 0,
            "updated_count": 0,
        }

    tx_query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if req.account_id and req.account_id != "all":
        tx_query = tx_query.filter(Transaction.account_id == req.account_id)

    transactions = tx_query.all()
    total_scanned = len(transactions)
    matched_count = 0
    updated_count = 0

    for tx in transactions:
        # If overwrite_user_classified is False, skip manually classified transactions
        if not req.overwrite_user_classified and tx.is_user_classified:
            continue

        for rule in rules:
            if CategorizerService.matches_rule(
                rule,
                merchant=tx.merchant_name,
                raw_label=tx.raw_label,
                amount=tx.amount,
                account_id=tx.account_id,
            ):
                matched_count += 1
                is_changed = False

                target_category = "Virements & Épargne" if rule.mark_as_transfer else rule.category
                target_subcategory = "Virement interne" if rule.mark_as_transfer else rule.subcategory

                if tx.category != target_category:
                    tx.category = target_category
                    is_changed = True
                if tx.subcategory != target_subcategory:
                    tx.subcategory = target_subcategory
                    is_changed = True
                if rule.tags:
                    # Merge or assign tags
                    current_tags = _parse_tags(tx.tags)
                    rule_tags = _parse_tags(rule.tags)
                    merged_tags = list(dict.fromkeys(current_tags + rule_tags))
                    serialized = json.dumps(merged_tags)
                    if tx.tags != serialized:
                        tx.tags = serialized
                        is_changed = True
                if rule.is_excluded_from_budget is not None and tx.is_excluded_from_budget != rule.is_excluded_from_budget:
                    tx.is_excluded_from_budget = bool(rule.is_excluded_from_budget)
                    is_changed = True
                if rule.logo_url and tx.logo_url != rule.logo_url:
                    tx.logo_url = rule.logo_url
                    is_changed = True

                tx.category_confidence = 1.0
                tx.matched_rule_id = rule.id

                if is_changed:
                    updated_count += 1
                break  # Only apply the highest priority matching rule

    db.commit()

    return {
        "status": "success",
        "message": f"{updated_count} transaction(s) mise(s) à jour sur {matched_count} correspondance(s).",
        "total_scanned": total_scanned,
        "matched_count": matched_count,
        "updated_count": updated_count,
    }


@router.post("/{rule_id}/apply")
def apply_single_rule(
    rule_id: str,
    req: SingleApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply a specific single categorization rule to past transactions."""
    rule = db.query(CategorizationRule).filter(
        (CategorizationRule.id == rule_id) & (CategorizationRule.user_id == current_user.id)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Règle non trouvée")

    batch_req = BatchApplyRequest(
        rule_ids=[rule.id],
        overwrite_user_classified=req.overwrite_user_classified,
    )
    return batch_apply_rules(batch_req, db=db, current_user=current_user)
