import pytest
import uuid
import json
from app.core.database import SessionLocal
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.investment import InvestmentHolding
from app.models.user import User
from app.mcp.service import (
    get_net_worth_data,
    get_budget_status_data,
    search_transactions_data,
    get_cashflow_forecast_data,
)
from app.mcp.server import create_mcp_server


@pytest.fixture
def mcp_test_data():
    db = SessionLocal()
    test_uid = f"usr_{uuid.uuid4().hex[:8]}"

    user = User(
        id=test_uid,
        email=f"mcp_user_{test_uid}@finly.local",
        hashed_password="hashed_pwd",
        full_name="MCP Tester",
        role="member",
    )
    db.add(user)

    acc1 = Account(
        id=f"acc_chk_{test_uid}",
        user_id=test_uid,
        bank_account_id=f"ext_chk_{test_uid}",
        name="Compte Principal",
        account_type="Compte Courant",
        balance=3500.50,
        currency="EUR",
        bank_name="BoursoBank",
    )
    acc2 = Account(
        id=f"acc_sav_{test_uid}",
        user_id=test_uid,
        bank_account_id=f"ext_sav_{test_uid}",
        name="Livret A",
        account_type="Livret A",
        balance=12000.00,
        currency="EUR",
        bank_name="BoursoBank",
    )
    db.add_all([acc1, acc2])

    holding = InvestmentHolding(
        id=f"hld_{test_uid}",
        user_id=test_uid,
        account_id=acc1.id,
        symbol="CW8.PA",
        name="Amundi MSCI World",
        asset_type="etf",
        quantity=20.0,
        buy_price=450.0,
        current_price=510.0,
        currency="EUR",
    )
    db.add(holding)

    budget = Budget(
        id=f"bdg_{test_uid}",
        user_id=test_uid,
        category="Alimentation",
        monthly_limit=600.0,
    )
    db.add(budget)

    tx1 = Transaction(
        id=f"tx1_{test_uid}",
        user_id=test_uid,
        bank_tx_id=f"btx1_{test_uid}",
        account_id=acc1.id,
        booking_date="2026-09-15",
        amount=-85.40,
        currency="EUR",
        raw_label="CARREFOUR MARKET PARIS",
        merchant_name="Carrefour",
        category="Alimentation",
        tags="#groceries",
    )
    tx2 = Transaction(
        id=f"tx2_{test_uid}",
        user_id=test_uid,
        bank_tx_id=f"btx2_{test_uid}",
        account_id=acc1.id,
        booking_date="2026-09-01",
        amount=3200.00,
        currency="EUR",
        raw_label="VIR SALAIRE ACME CORP",
        merchant_name="ACME Corp",
        category="Revenus",
    )
    tx3 = Transaction(
        id=f"tx3_{test_uid}",
        user_id=test_uid,
        bank_tx_id=f"btx3_{test_uid}",
        account_id=acc1.id,
        booking_date="2026-08-10",
        amount=-15.99,
        currency="EUR",
        raw_label="CB NETFLIX.COM",
        merchant_name="Netflix",
        category="Abonnements",
    )
    tx4 = Transaction(
        id=f"tx4_{test_uid}",
        user_id=test_uid,
        bank_tx_id=f"btx4_{test_uid}",
        account_id=acc1.id,
        booking_date="2026-09-10",
        amount=-15.99,
        currency="EUR",
        raw_label="CB NETFLIX.COM",
        merchant_name="Netflix",
        category="Abonnements",
    )
    db.add_all([tx1, tx2, tx3, tx4])
    db.commit()

    yield {
        "user_id": test_uid,
        "acc1_id": acc1.id,
        "acc2_id": acc2.id,
    }

    # Cleanup
    db.query(Transaction).filter(Transaction.user_id == test_uid).delete()
    db.query(Budget).filter(Budget.user_id == test_uid).delete()
    db.query(InvestmentHolding).filter(InvestmentHolding.user_id == test_uid).delete()
    db.query(Account).filter(Account.user_id == test_uid).delete()
    db.query(User).filter(User.id == test_uid).delete()
    db.commit()
    db.close()


def test_mcp_get_net_worth(mcp_test_data):
    db = SessionLocal()
    try:
        user_id = mcp_test_data["user_id"]
        res = get_net_worth_data(db, user_id=user_id)

        assert res["total_net_worth"] == round(3500.50 + 12000.00 + (20.0 * 510.0), 2)
        assert res["breakdown"]["checking"] == 3500.50
        assert res["breakdown"]["savings"] == 12000.00
        assert res["breakdown"]["brokerage_pea"] == (20.0 * 510.0)
        assert res["accounts_count"] == 2
        assert res["holdings_count"] == 1
    finally:
        db.close()


def test_mcp_get_budget_status(mcp_test_data):
    db = SessionLocal()
    try:
        user_id = mcp_test_data["user_id"]
        res = get_budget_status_data(db, user_id=user_id, month="2026-09")

        assert res["month"] == "2026-09"
        assert res["total_budget_limit"] == 600.0
        assert len(res["budgets"]) == 1

        b_item = res["budgets"][0]
        assert b_item["category"] == "Alimentation"
        assert b_item["spent"] == 85.40
        assert b_item["remaining"] == round(600.0 - 85.40, 2)
        assert not b_item["is_over_budget"]
    finally:
        db.close()


def test_mcp_search_transactions(mcp_test_data):
    db = SessionLocal()
    try:
        user_id = mcp_test_data["user_id"]

        # Search by keyword
        res_carrefour = search_transactions_data(db, query="Carrefour", user_id=user_id)
        assert res_carrefour["total_count"] == 1
        assert res_carrefour["transactions"][0]["merchant_name"] == "Carrefour"

        # Search by category
        res_cat = search_transactions_data(db, category="Alimentation", user_id=user_id)
        assert res_cat["total_count"] == 1

        # Search by min/max amount
        res_income = search_transactions_data(db, min_amount=1000.0, user_id=user_id)
        assert res_income["total_count"] == 1
        assert res_income["transactions"][0]["amount"] == 3200.00

        # Search by tag
        res_tag = search_transactions_data(db, query="#groceries", user_id=user_id)
        assert res_tag["total_count"] == 1
    finally:
        db.close()


def test_mcp_get_cashflow_forecast(mcp_test_data):
    db = SessionLocal()
    try:
        user_id = mcp_test_data["user_id"]
        res = get_cashflow_forecast_data(db, months_ahead=3, user_id=user_id)

        assert res["current_liquid_balance"] == round(3500.50 + 12000.00, 2)
        assert res["months_ahead"] == 3
        assert len(res["projections"]) == 3

        # Recurring Netflix subscription should be detected
        merchants = [m["merchant"] for m in res["top_recurring_merchants"]]
        assert "Netflix" in merchants
    finally:
        db.close()


def test_mcp_server_factory():
    server = create_mcp_server()
    assert server.name == "Finly"
