import pytest
import uuid
from datetime import datetime
from app.core.database import SessionLocal
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.services.cleaner_service import CleanerService
from app.services.categorizer_service import CategorizerService
from app.services.reconciliation_service import ReconciliationService
from app.services.sync_service import sync_service

def test_cleaner_service():
    assert CleanerService.clean_merchant_name("CB CARREFOUR CONTACT 06/09") == "Carrefour"
    assert CleanerService.clean_merchant_name("VIR SEPA LOYER PARIS") == "Loyer"
    assert CleanerService.clean_merchant_name("PRLV EDF CLIENT 12345") == "Edf Client 12345"
    assert CleanerService.clean_merchant_name("CB FONDATION DE FRA 06/09/26") == "Fondation De"

def test_categorizer_service():
    cat = CategorizerService.categorize("Carrefour", "CB CARREFOUR", -45.50)
    assert cat in ["Alimentation & Supermarché", "Alimentation", "Courses"]
    
    cat_uber = CategorizerService.categorize("Uber", "CB UBER TRIP", -18.20)
    assert cat_uber in ["Transports & Véhicule", "Transports", "Transport"]

def test_reconciliation_service_similarity():
    # Exact normalized match
    assert ReconciliationService.is_similar_title("CB CARREFOUR MARKET", "Carrefour Market", "Carrefour", "Carrefour")
    # Cleaned merchant match
    assert ReconciliationService.is_similar_title("CB FONDATION DE FRA 06/09/26", "FONDATION DE FRA", "Fondation De", "Fondation De")
    # Distinct titles
    assert not ReconciliationService.is_similar_title("CB MCDONALDS", "VIR EDF ELECTRICITE", "Mcdonalds", "Edf")

@pytest.mark.asyncio
async def test_sync_all_active_accounts_deduplication():
    db = SessionLocal()
    # Create or retrieve a test user
    user = db.query(User).filter(User.email == "test_sync_user@finly.local").first()
    if not user:
        user = User(
            id=f"usr_{uuid.uuid4().hex[:10]}",
            email="test_sync_user@finly.local",
            hashed_password="hashed_test_password",
            full_name="Test Sync User",
            role="member"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Simulated pre-extracted accounts with multiple identical amounts on the same date (testing uniqueness & name safety)
    mock_extracted_data = [
        {
            "backend_name": "lcl_test_backend",
            "module": "lcl",
            "account_id": "test_acc_001",
            "name": "Compte Courant Test",
            "iban": "FR7600000000000000000000000",
            "balance": 1500.0,
            "currency": "EUR",
            "type": "Compte Courant",
            "transactions": [
                {
                    "id": "tx_same_key",
                    "date": "2026-09-07",
                    "amount": -1.0,
                    "raw_label": "CB FONDATION DE FRA 06/09/26",
                    "currency": "EUR",
                    "status": "confirmed",
                },
                {
                    "id": "tx_same_key",
                    "date": "2026-09-07",
                    "amount": -1.0,
                    "raw_label": "CB FONDATION DE FRA 06/09/26",
                    "currency": "EUR",
                    "status": "confirmed",
                },
                {
                    "id": "tx_third_entry",
                    "date": "2026-09-08",
                    "amount": -45.90,
                    "raw_label": "CB MONOPRIX 07/09",
                    "currency": "EUR",
                    "status": "confirmed",
                }
            ]
        }
    ]

    # Run sync service
    result = await sync_service.sync_all_active_accounts(
        db=db,
        pre_extracted=mock_extracted_data,
        user_id=user.id
    )

    assert result["status"] == "success"
    assert result["synced_accounts"] >= 1

    # Verify transactions were inserted without unique constraint error
    acc = db.query(Account).filter((Account.user_id == user.id) & (Account.bank_account_id == "test_acc_001")).first()
    assert acc is not None

    txs = db.query(Transaction).filter(Transaction.account_id == acc.id).all()
    assert len(txs) >= 2

    # Cleanup test data
    db.query(Transaction).filter(Transaction.user_id == user.id).delete()
    db.query(Account).filter(Account.user_id == user.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()
    db.close()
