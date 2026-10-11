import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.loan import Loan
from app.services.loan_service import LoanService

router = APIRouter()


class LoanCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    loan_type: Optional[str] = "mortgage"  # mortgage, student, auto, consumer, personal, other
    lender_name: Optional[str] = None
    principal_amount: float = Field(..., gt=0)
    interest_rate: float = Field(..., ge=0)  # annual rate in %
    insurance_rate: Optional[float] = 0.30  # annual insurance rate in %
    duration_months: int = Field(..., gt=0, le=600)  # max 50 years
    start_date: str  # YYYY-MM or YYYY-MM-DD
    monthly_payment: Optional[float] = None
    rate_type: Optional[str] = "fixed"
    linked_project_id: Optional[str] = None
    linked_account_id: Optional[str] = None
    notes: Optional[str] = None


class LoanUpdateRequest(BaseModel):
    name: Optional[str] = None
    loan_type: Optional[str] = None
    lender_name: Optional[str] = None
    principal_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    insurance_rate: Optional[float] = None
    duration_months: Optional[int] = None
    start_date: Optional[str] = None
    monthly_payment: Optional[float] = None
    rate_type: Optional[str] = None
    linked_project_id: Optional[str] = None
    linked_account_id: Optional[str] = None
    notes: Optional[str] = None


class EarlyRepaymentRequest(BaseModel):
    repayment_amount: float = Field(..., gt=0)
    repayment_month: Optional[int] = None  # month index, defaults to current elapsed
    strategy: Optional[str] = "reduce_duration"  # "reduce_duration" or "reduce_payment"
    penalty_rate_pct: Optional[float] = 0.0  # % IRA


class StandaloneSimulateRequest(BaseModel):
    principal_amount: float = Field(..., gt=0)
    interest_rate: float = Field(..., ge=0)
    duration_months: int = Field(..., gt=0)
    insurance_rate: Optional[float] = 0.30
    start_date: Optional[str] = None


def serialize_loan_with_live_status(loan: Loan) -> Dict[str, Any]:
    live_status = LoanService.calculate_live_status(
        principal=loan.principal_amount,
        annual_rate_pct=loan.interest_rate,
        duration_months=loan.duration_months,
        insurance_rate_pct=loan.insurance_rate or 0.0,
        start_date_str=loan.start_date,
    )

    return {
        "id": loan.id,
        "name": loan.name,
        "loan_type": loan.loan_type or "mortgage",
        "lender_name": loan.lender_name,
        "principal_amount": loan.principal_amount,
        "interest_rate": loan.interest_rate,
        "insurance_rate": loan.insurance_rate or 0.0,
        "duration_months": loan.duration_months,
        "start_date": loan.start_date,
        "rate_type": loan.rate_type or "fixed",
        "linked_project_id": loan.linked_project_id,
        "linked_account_id": loan.linked_account_id,
        "notes": loan.notes,
        "created_at": loan.created_at.isoformat() if loan.created_at else None,
        "updated_at": loan.updated_at.isoformat() if loan.updated_at else None,
        # Live computed status
        **live_status,
    }


@router.get("/")
@router.get("", include_in_schema=False)
def list_loans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loans = (
        db.query(Loan)
        .filter(Loan.user_id == current_user.id)
        .order_by(Loan.created_at.desc())
        .all()
    )
    return [serialize_loan_with_live_status(loan) for loan in loans]


@router.get("/summary")
def get_loans_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loans = db.query(Loan).filter(Loan.user_id == current_user.id).all()
    if not loans:
        return {
            "total_loans_count": 0,
            "total_initial_principal": 0.0,
            "total_remaining_balance": 0.0,
            "total_capital_amortized": 0.0,
            "total_monthly_payments": 0.0,
            "total_interest_remaining": 0.0,
            "total_insurance_remaining": 0.0,
            "average_interest_rate": 0.0,
            "breakdown_by_type": {},
        }

    total_initial = 0.0
    total_remaining = 0.0
    total_amortized = 0.0
    total_monthly = 0.0
    total_int_rem = 0.0
    total_ins_rem = 0.0
    rate_weighted_sum = 0.0
    breakdown: Dict[str, Dict[str, Any]] = {}

    for loan in loans:
        stat = LoanService.calculate_live_status(
            principal=loan.principal_amount,
            annual_rate_pct=loan.interest_rate,
            duration_months=loan.duration_months,
            insurance_rate_pct=loan.insurance_rate or 0.0,
            start_date_str=loan.start_date,
        )

        total_initial += loan.principal_amount
        total_remaining += stat["remaining_balance"]
        total_amortized += stat["capital_amortized"]
        total_monthly += stat["monthly_payment"]
        total_int_rem += stat["interest_remaining"]
        total_ins_rem += stat["insurance_remaining"]
        rate_weighted_sum += loan.interest_rate * stat["remaining_balance"]

        l_type = loan.loan_type or "mortgage"
        if l_type not in breakdown:
            breakdown[l_type] = {
                "count": 0,
                "total_remaining": 0.0,
                "monthly_payment": 0.0,
            }
        breakdown[l_type]["count"] += 1
        breakdown[l_type]["total_remaining"] = round(
            breakdown[l_type]["total_remaining"] + stat["remaining_balance"], 2
        )
        breakdown[l_type]["monthly_payment"] = round(
            breakdown[l_type]["monthly_payment"] + stat["monthly_payment"], 2
        )

    avg_rate = (
        round(rate_weighted_sum / total_remaining, 2)
        if total_remaining > 0
        else round(sum(l.interest_rate for l in loans) / len(loans), 2)
    )

    return {
        "total_loans_count": len(loans),
        "total_initial_principal": round(total_initial, 2),
        "total_remaining_balance": round(total_remaining, 2),
        "total_capital_amortized": round(total_amortized, 2),
        "total_monthly_payments": round(total_monthly, 2),
        "total_interest_remaining": round(total_int_rem, 2),
        "total_insurance_remaining": round(total_ins_rem, 2),
        "average_interest_rate": avg_rate,
        "breakdown_by_type": breakdown,
    }


@router.post("/")
@router.post("", include_in_schema=False)
def create_loan(
    payload: LoanCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment_info = LoanService.calculate_monthly_payment(
        principal=payload.principal_amount,
        annual_rate_pct=payload.interest_rate,
        duration_months=payload.duration_months,
        insurance_rate_pct=payload.insurance_rate or 0.0,
    )

    monthly_payment = payload.monthly_payment or payment_info["monthly_payment"]

    new_loan = Loan(
        id=f"loan_{uuid.uuid4().hex[:12]}",
        user_id=current_user.id,
        name=payload.name.strip(),
        loan_type=payload.loan_type or "mortgage",
        lender_name=payload.lender_name.strip() if payload.lender_name else None,
        principal_amount=payload.principal_amount,
        interest_rate=payload.interest_rate,
        insurance_rate=payload.insurance_rate if payload.insurance_rate is not None else 0.30,
        duration_months=payload.duration_months,
        start_date=payload.start_date.strip(),
        monthly_payment=monthly_payment,
        rate_type=payload.rate_type or "fixed",
        linked_project_id=payload.linked_project_id,
        linked_account_id=payload.linked_account_id,
        notes=payload.notes.strip() if payload.notes else None,
    )

    db.add(new_loan)
    db.commit()
    db.refresh(new_loan)

    return serialize_loan_with_live_status(new_loan)


@router.get("/{loan_id}")
def get_loan(
    loan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = (
        db.query(Loan)
        .filter((Loan.id == loan_id) & (Loan.user_id == current_user.id))
        .first()
    )
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found.")

    return serialize_loan_with_live_status(loan)


@router.put("/{loan_id}")
def update_loan(
    loan_id: str,
    payload: LoanUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = (
        db.query(Loan)
        .filter((Loan.id == loan_id) & (Loan.user_id == current_user.id))
        .first()
    )
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found.")

    if payload.name is not None:
        loan.name = payload.name.strip()
    if payload.loan_type is not None:
        loan.loan_type = payload.loan_type
    if payload.lender_name is not None:
        loan.lender_name = payload.lender_name.strip() if payload.lender_name else None
    if payload.principal_amount is not None:
        loan.principal_amount = payload.principal_amount
    if payload.interest_rate is not None:
        loan.interest_rate = payload.interest_rate
    if payload.insurance_rate is not None:
        loan.insurance_rate = payload.insurance_rate
    if payload.duration_months is not None:
        loan.duration_months = payload.duration_months
    if payload.start_date is not None:
        loan.start_date = payload.start_date.strip()
    if payload.rate_type is not None:
        loan.rate_type = payload.rate_type
    if payload.linked_project_id is not None:
        loan.linked_project_id = payload.linked_project_id
    if payload.linked_account_id is not None:
        loan.linked_account_id = payload.linked_account_id
    if payload.notes is not None:
        loan.notes = payload.notes.strip() if payload.notes else None

    # Recalculate monthly installment if core terms changed
    recalc = LoanService.calculate_monthly_payment(
        principal=loan.principal_amount,
        annual_rate_pct=loan.interest_rate,
        duration_months=loan.duration_months,
        insurance_rate_pct=loan.insurance_rate or 0.0,
    )
    loan.monthly_payment = payload.monthly_payment or recalc["monthly_payment"]

    loan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(loan)

    return serialize_loan_with_live_status(loan)


@router.delete("/{loan_id}")
def delete_loan(
    loan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = (
        db.query(Loan)
        .filter((Loan.id == loan_id) & (Loan.user_id == current_user.id))
        .first()
    )
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found.")

    db.delete(loan)
    db.commit()
    return {"status": "success", "message": "Loan deleted successfully."}


@router.get("/{loan_id}/schedule")
def get_loan_schedule(
    loan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = (
        db.query(Loan)
        .filter((Loan.id == loan_id) & (Loan.user_id == current_user.id))
        .first()
    )
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found.")

    schedule = LoanService.generate_amortization_schedule(
        principal=loan.principal_amount,
        annual_rate_pct=loan.interest_rate,
        duration_months=loan.duration_months,
        insurance_rate_pct=loan.insurance_rate or 0.0,
        start_date_str=loan.start_date,
    )

    return {
        "loan_id": loan.id,
        "loan_name": loan.name,
        "total_periods": len(schedule),
        "schedule": schedule,
    }


@router.post("/{loan_id}/simulate-repayment")
def simulate_loan_repayment(
    loan_id: str,
    payload: EarlyRepaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = (
        db.query(Loan)
        .filter((Loan.id == loan_id) & (Loan.user_id == current_user.id))
        .first()
    )
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found.")

    try:
        sim = LoanService.simulate_early_repayment(
            principal=loan.principal_amount,
            annual_rate_pct=loan.interest_rate,
            duration_months=loan.duration_months,
            insurance_rate_pct=loan.insurance_rate or 0.0,
            start_date_str=loan.start_date,
            repayment_amount=payload.repayment_amount,
            repayment_month_index=payload.repayment_month,
            strategy=payload.strategy or "reduce_duration",
            penalty_rate_pct=payload.penalty_rate_pct or 0.0,
        )
        return sim
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/simulate")
def simulate_standalone_loan(payload: StandaloneSimulateRequest):
    """Calculates loan payment breakdown and preview schedule without persisting to database."""
    start_date = payload.start_date or datetime.utcnow().strftime("%Y-%m")
    live_status = LoanService.calculate_live_status(
        principal=payload.principal_amount,
        annual_rate_pct=payload.interest_rate,
        duration_months=payload.duration_months,
        insurance_rate_pct=payload.insurance_rate or 0.0,
        start_date_str=start_date,
    )
    schedule = LoanService.generate_amortization_schedule(
        principal=payload.principal_amount,
        annual_rate_pct=payload.interest_rate,
        duration_months=payload.duration_months,
        insurance_rate_pct=payload.insurance_rate or 0.0,
        start_date_str=start_date,
    )
    return {
        **live_status,
        "preview_schedule": schedule[:12],  # first year preview
    }
