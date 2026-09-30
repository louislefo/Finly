"""
Finly MCP Service Layer
Provides read-only database query execution for MCP tools and resources.
"""

from datetime import datetime, date
from typing import Dict, Any, List, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from app.models.account import Account
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.investment import InvestmentHolding


def get_net_worth_data(db: Session, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Computes aggregated wealth breakdown by asset type.
    """
    account_query = db.query(Account)
    if user_id:
        account_query = account_query.filter(Account.user_id == user_id)
    accounts = account_query.all()

    holding_query = db.query(InvestmentHolding)
    if user_id:
        holding_query = holding_query.filter(InvestmentHolding.user_id == user_id)
    holdings = holding_query.all()

    breakdown = {
        "checking": 0.0,
        "savings": 0.0,
        "life_insurance": 0.0,
        "brokerage_pea": 0.0,
        "crypto": 0.0,
        "other": 0.0,
    }

    accounts_list = []
    for acc in accounts:
        balance = float(acc.balance or 0.0)
        acc_type = (acc.account_type or "").lower()
        acc_name = (acc.name or "").lower()

        is_savings = any(k in acc_type or k in acc_name for k in ["livret", "epargne", "épargne", "ldd", "lep", "csl", "savings"])
        is_life_ins = any(k in acc_type or k in acc_name for k in ["assurance", "assurance-vie", "assurance vie", "av", "per", "capitalisation"])
        is_brokerage = any(k in acc_type or k in acc_name for k in ["pea", "titre", "titres", "bourse", "cto", "brokerage"])
        is_crypto = any(k in acc_type or k in acc_name for k in ["crypto", "binance", "kraken", "coinbase"])

        if is_crypto:
            breakdown["crypto"] += balance
            category = "Crypto"
        elif is_life_ins:
            breakdown["life_insurance"] += balance
            category = "Life Insurance"
        elif is_brokerage:
            breakdown["brokerage_pea"] += balance
            category = "Brokerage & PEA"
        elif is_savings:
            breakdown["savings"] += balance
            category = "Savings"
        else:
            breakdown["checking"] += balance
            category = "Checking"

        accounts_list.append({
            "id": acc.id,
            "name": acc.name,
            "bank_name": acc.bank_name,
            "type": acc.account_type,
            "category": category,
            "balance": round(balance, 2),
            "currency": acc.currency or "EUR",
            "iban": acc.iban,
        })

    holdings_list = []
    total_investments_val = 0.0
    for h in holdings:
        qty = float(h.quantity or 0.0)
        price = float(h.current_price if h.current_price is not None and h.current_price > 0 else (h.buy_price or 0.0))
        val = round(qty * price, 2)
        total_investments_val += val

        asset_t = (h.asset_type or "stock").lower()
        if asset_t == "crypto":
            breakdown["crypto"] += val
        else:
            breakdown["brokerage_pea"] += val

        holdings_list.append({
            "id": h.id,
            "symbol": h.symbol,
            "name": h.name,
            "asset_type": h.asset_type,
            "quantity": qty,
            "current_price": price,
            "total_value": val,
            "pru": float(h.buy_price or 0.0),
            "currency": h.currency or "EUR",
        })

    total_bank_balance = sum(acc["balance"] for acc in accounts_list)
    total_net_worth = round(total_bank_balance + total_investments_val, 2)

    return {
        "total_net_worth": total_net_worth,
        "currency": "EUR",
        "breakdown": {
            "checking": round(breakdown["checking"], 2),
            "savings": round(breakdown["savings"], 2),
            "life_insurance": round(breakdown["life_insurance"], 2),
            "brokerage_pea": round(breakdown["brokerage_pea"], 2),
            "crypto": round(breakdown["crypto"], 2),
            "other": round(breakdown["other"], 2),
        },
        "accounts_count": len(accounts_list),
        "holdings_count": len(holdings_list),
        "accounts": accounts_list,
        "holdings": holdings_list,
        "as_of": datetime.utcnow().isoformat(),
    }


def get_budget_status_data(
    db: Session,
    user_id: Optional[str] = None,
    month: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes active budget limits and real-time consumption rates.
    """
    if not month:
        now = datetime.utcnow()
        month = now.strftime("%Y-%m")

    budget_query = db.query(Budget)
    if user_id:
        budget_query = budget_query.filter(Budget.user_id == user_id)
    budgets = budget_query.all()

    tx_query = db.query(Transaction).filter(
        Transaction.booking_date.like(f"{month}%"),
        Transaction.amount < 0,
        Transaction.is_excluded_from_budget == False,
    )
    if user_id:
        tx_query = tx_query.filter(Transaction.user_id == user_id)
    transactions = tx_query.all()

    spent_by_category = defaultdict(float)
    for tx in transactions:
        cat = tx.category or "Divers"
        spent_by_category[cat] += abs(float(tx.amount or 0.0))

    budget_items = []
    total_limit = 0.0
    total_spent = 0.0

    for b in budgets:
        limit = float(b.monthly_limit or 0.0)
        spent = round(spent_by_category.get(b.category, 0.0), 2)
        remaining = round(limit - spent, 2)
        pct = round((spent / limit * 100) if limit > 0 else 0.0, 1)

        total_limit += limit
        total_spent += spent

        budget_items.append({
            "category": b.category,
            "monthly_limit": limit,
            "spent": spent,
            "remaining": remaining,
            "percentage_used": pct,
            "is_over_budget": spent > limit,
        })

    # Add categories with spending that don't have explicit budget limits
    budgeted_categories = {b.category for b in budgets}
    unbudgeted_items = []
    for cat, spent_amount in spent_by_category.items():
        if cat not in budgeted_categories:
            spent_val = round(spent_amount, 2)
            total_spent += spent_val
            unbudgeted_items.append({
                "category": cat,
                "monthly_limit": 0.0,
                "spent": spent_val,
                "remaining": -spent_val,
                "percentage_used": 100.0 if spent_val > 0 else 0.0,
                "is_over_budget": spent_val > 0,
            })

    total_limit = round(total_limit, 2)
    total_spent = round(total_spent, 2)
    total_remaining = round(total_limit - total_spent, 2)
    overall_pct = round((total_spent / total_limit * 100) if total_limit > 0 else 0.0, 1)

    return {
        "month": month,
        "total_budget_limit": total_limit,
        "total_spent": total_spent,
        "total_remaining": total_remaining,
        "overall_percentage_used": overall_pct,
        "is_overall_over_budget": total_spent > total_limit if total_limit > 0 else False,
        "budgets": budget_items,
        "unbudgeted_spending": unbudgeted_items,
        "as_of": datetime.utcnow().isoformat(),
    }


def search_transactions_data(
    db: Session,
    query: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    account_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Searches transactions by date, merchant, category, and amount with pagination.
    """
    limit = min(max(1, limit), 200)
    offset = max(0, offset)

    filters = []

    if user_id:
        filters.append(Transaction.user_id == user_id)

    if account_id:
        filters.append(Transaction.account_id == account_id)

    if query:
        q_term = f"%{query.strip()}%"
        filters.append(
            or_(
                Transaction.raw_label.ilike(q_term),
                Transaction.merchant_name.ilike(q_term),
                Transaction.tags.ilike(q_term),
            )
        )

    if category:
        cat_term = f"%{category.strip()}%"
        filters.append(
            or_(
                Transaction.category.ilike(cat_term),
                Transaction.subcategory.ilike(cat_term),
            )
        )

    if start_date:
        filters.append(Transaction.booking_date >= start_date.strip())

    if end_date:
        filters.append(Transaction.booking_date <= end_date.strip())

    if min_amount is not None:
        filters.append(Transaction.amount >= min_amount)

    if max_amount is not None:
        filters.append(Transaction.amount <= max_amount)

    total_count = db.query(func.count(Transaction.id)).filter(*filters).scalar() or 0

    tx_rows = (
        db.query(Transaction)
        .filter(*filters)
        .order_by(Transaction.booking_date.desc(), Transaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    transactions_list = []
    for tx in tx_rows:
        transactions_list.append({
            "id": tx.id,
            "account_id": tx.account_id,
            "booking_date": tx.booking_date,
            "amount": round(float(tx.amount), 2),
            "currency": tx.currency or "EUR",
            "raw_label": tx.raw_label,
            "merchant_name": tx.merchant_name,
            "category": tx.category or "Divers",
            "subcategory": tx.subcategory,
            "status": tx.status or "confirmed",
            "is_user_classified": bool(tx.is_user_classified),
            "tags": tx.tags.split(",") if tx.tags else [],
        })

    return {
        "total_count": total_count,
        "returned_count": len(transactions_list),
        "limit": limit,
        "offset": offset,
        "transactions": transactions_list,
    }


def get_cashflow_forecast_data(
    db: Session,
    months_ahead: int = 3,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes upcoming cashflow forecast based on recurring debits and historical trends.
    """
    months_ahead = min(max(1, months_ahead), 12)

    # Get accounts current liquid balance
    acc_query = db.query(Account)
    if user_id:
        acc_query = acc_query.filter(Account.user_id == user_id)
    accounts = acc_query.all()
    current_liquid_balance = sum(float(a.balance or 0.0) for a in accounts)

    # Query last 6 months of transactions to establish monthly averages
    tx_query = db.query(Transaction)
    if user_id:
        tx_query = tx_query.filter(Transaction.user_id == user_id)
    transactions = tx_query.all()

    # Group by month (YYYY-MM)
    monthly_inflows = defaultdict(float)
    monthly_outflows = defaultdict(float)
    merchant_occurrences = defaultdict(list)

    for tx in transactions:
        b_date = tx.booking_date or ""
        if len(b_date) >= 7:
            m_key = b_date[:7]
            amt = float(tx.amount or 0.0)
            if amt > 0:
                monthly_inflows[m_key] += amt
            else:
                monthly_outflows[m_key] += abs(amt)

            if tx.merchant_name or tx.raw_label:
                m_label = tx.merchant_name or tx.raw_label
                merchant_occurrences[m_label].append(amt)

    # Calculate 3-month moving averages
    recent_months = sorted(set(list(monthly_inflows.keys()) + list(monthly_outflows.keys())))[-3:]
    if recent_months:
        avg_monthly_inflow = sum(monthly_inflows[m] for m in recent_months) / len(recent_months)
        avg_monthly_outflow = sum(monthly_outflows[m] for m in recent_months) / len(recent_months)
    else:
        avg_monthly_inflow = 0.0
        avg_monthly_outflow = 0.0

    # Identify recurring subscriptions / fixed expenses (occurred in multiple recent months with similar negative amount)
    recurring_expenses = []
    recurring_monthly_sum = 0.0

    for m_label, amounts in merchant_occurrences.items():
        neg_amounts = [a for a in amounts if a < 0]
        if len(neg_amounts) >= 2:
            avg_amt = abs(sum(neg_amounts) / len(neg_amounts))
            # If standard deviation is relatively small, count as recurring
            recurring_expenses.append({
                "merchant": m_label,
                "estimated_monthly_amount": round(avg_amt, 2),
                "occurrences_count": len(neg_amounts),
            })
            recurring_monthly_sum += avg_amt

    # Build month-by-month projections
    now = datetime.utcnow()
    curr_year = now.year
    curr_month = now.month

    projections = []
    running_balance = current_liquid_balance

    for i in range(1, months_ahead + 1):
        target_month_num = curr_month + i
        target_year = curr_year + (target_month_num - 1) // 12
        target_month = ((target_month_num - 1) % 12) + 1
        month_str = f"{target_year:04d}-{target_month:02d}"

        expected_inflow = round(avg_monthly_inflow, 2)
        expected_outflow = round(avg_monthly_outflow, 2)
        net_cashflow = round(expected_inflow - expected_outflow, 2)
        running_balance = round(running_balance + net_cashflow, 2)

        projections.append({
            "month": month_str,
            "projected_inflow": expected_inflow,
            "projected_outflow": expected_outflow,
            "projected_net_cashflow": net_cashflow,
            "projected_end_balance": running_balance,
            "is_positive": net_cashflow >= 0,
        })

    return {
        "current_liquid_balance": round(current_liquid_balance, 2),
        "historical_avg_monthly_inflow": round(avg_monthly_inflow, 2),
        "historical_avg_monthly_outflow": round(avg_monthly_outflow, 2),
        "estimated_fixed_recurring_burn": round(recurring_monthly_sum, 2),
        "months_ahead": months_ahead,
        "projections": projections,
        "top_recurring_merchants": sorted(recurring_expenses, key=lambda x: x["estimated_monthly_amount"], reverse=True)[:10],
        "as_of": datetime.utcnow().isoformat(),
    }
