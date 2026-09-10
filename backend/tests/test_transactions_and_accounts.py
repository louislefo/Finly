import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction

client = TestClient(app)

def test_accounts_and_transactions_flow():
    db = SessionLocal()
    # Create test user
    test_uid = uuid.uuid4().hex[:8]
    user = User(
        id=f"usr_{test_uid}",
        email=f"test_finance_{test_uid}@finly.local",
        hashed_password="test_hashed_password",
        full_name="Finance Tester",
        role="member"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Add account directly for user
    account = Account(
        id=f"acc_{test_uid}",
        user_id=user.id,
        bank_account_id=f"bourso_acc_{test_uid}",
        bank_name="BoursoBank",
        name="Compte Courant Test",
        account_type="Compte Courant",
        balance=2500.0,
        currency="EUR"
    )
    db.add(account)

    # Add transaction for this account
    tx = Transaction(
        id=f"tx_{test_uid}",
        user_id=user.id,
        account_id=account.id,
        bank_tx_id=f"bourso_tx_{test_uid}",
        booking_date="2026-09-08",
        amount=-34.20,
        currency="EUR",
        raw_label="CB RESTAURANT PARIS",
        merchant_name="Restaurant Paris",
        category="Divers",
        status="confirmed"
    )
    db.add(tx)
    db.commit()

    from app.core.security import create_access_token
    token = create_access_token(data={"sub": user.id, "email": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Get accounts list
    list_acc_res = client.get("/api/v1/accounts", headers=headers)
    assert list_acc_res.status_code == 200
    acc_data = list_acc_res.json()
    assert acc_data["accounts_count"] == 1
    assert acc_data["accounts"][0]["id"] == account.id
    assert acc_data["total_balance"] == 2500.0

    # 2. Update account properties
    update_acc_res = client.patch(f"/api/v1/accounts/{account.id}", json={
        "name": "Compte Principal Modifié",
        "color": "#6366F1"
    }, headers=headers)
    assert update_acc_res.status_code == 200
    assert update_acc_res.json()["account"]["name"] == "Compte Principal Modifié"

    # 3. Get transactions list
    list_tx_res = client.get("/api/v1/transactions", headers=headers)
    assert list_tx_res.status_code == 200
    txs_data = list_tx_res.json()
    assert len(txs_data["transactions"]) == 1
    assert txs_data["transactions"][0]["id"] == tx.id

    # 4. Update transaction category
    cat_res = client.patch(f"/api/v1/transactions/{tx.id}/category", json={
        "category": "Restaurants & Sorties",
        "subcategory": "Restaurant",
        "apply_to_all_merchant": True
    }, headers=headers)
    assert cat_res.status_code == 200
    assert cat_res.json()["category"] == "Restaurants & Sorties"

    # 5. Exclude transaction from budget
    exclude_res = client.patch(f"/api/v1/transactions/{tx.id}/exclude-budget", json={
        "is_excluded": True
    }, headers=headers)
    assert exclude_res.status_code == 200
    assert exclude_res.json()["is_excluded_from_budget"] is True

    # Cleanup
    db.query(Transaction).filter(Transaction.user_id == user.id).delete()
    db.query(Account).filter(Account.user_id == user.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()
    db.close()
