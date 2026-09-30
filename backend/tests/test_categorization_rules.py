import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.models.categorization_rule import CategorizationRule
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.user import User
from app.services.categorizer_service import CategorizerService
from app.core.database import SessionLocal


@pytest.fixture
def auth_client():
    client = TestClient(app)
    db = SessionLocal()
    test_uid = uuid.uuid4().hex[:8]
    user = User(
        id=f"usr_{test_uid}",
        email=f"rule_tester_{test_uid}@finly.local",
        hashed_password="test_hashed_password",
        full_name="Rule Tester",
        role="member",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()

    from app.core.security import create_access_token
    token = create_access_token(data={"sub": user.id, "email": user.email})
    client.headers = {"Authorization": f"Bearer {token}"}
    return client, user


def test_rule_matching_engine_unit():
    # 1. Contains match
    rule_contains = CategorizationRule(
        pattern="spotify",
        match_type="contains",
        apply_to_field="all",
        is_active=True,
    )
    assert CategorizerService.matches_rule(rule_contains, merchant="Spotify AB", raw_label="CB SPOTIFY.COM")
    assert not CategorizerService.matches_rule(rule_contains, merchant="Netflix", raw_label="CB NETFLIX.COM")

    # 2. Exact match
    rule_exact = CategorizationRule(
        pattern="UBER",
        match_type="exact",
        apply_to_field="merchant_name",
        is_active=True,
    )
    assert CategorizerService.matches_rule(rule_exact, merchant="UBER", raw_label="CB UBER EATS PARIS")
    assert not CategorizerService.matches_rule(rule_exact, merchant="UBER EATS", raw_label="CB UBER EATS PARIS")

    # 3. Regex match
    rule_regex = CategorizationRule(
        pattern=r"^VIR\s+SALAIRE\s+[A-Z]+",
        match_type="regex",
        apply_to_field="raw_label",
        is_active=True,
    )
    assert CategorizerService.matches_rule(rule_regex, merchant="ACME", raw_label="VIR SALAIRE ACME CORP")
    assert not CategorizerService.matches_rule(rule_regex, merchant="ACME", raw_label="PRLV SALAIRE ACME CORP")

    # 4. Amount and Type filter
    rule_amount = CategorizationRule(
        pattern="LOYER",
        match_type="contains",
        amount_type="expense",
        min_amount=500.0,
        max_amount=1500.0,
        is_active=True,
    )
    # Matching expense between 500 and 1500
    assert CategorizerService.matches_rule(rule_amount, raw_label="VIR LOYER APPART", amount=-850.0)
    # Below min amount
    assert not CategorizerService.matches_rule(rule_amount, raw_label="VIR LOYER APPART", amount=-200.0)
    # Above max amount
    assert not CategorizerService.matches_rule(rule_amount, raw_label="VIR LOYER APPART", amount=-2000.0)
    # Positive amount (income) when expense required
    assert not CategorizerService.matches_rule(rule_amount, raw_label="VIR LOYER APPART", amount=850.0)

    # 5. Inactive rule
    rule_inactive = CategorizationRule(
        pattern="spotify",
        match_type="contains",
        is_active=False,
    )
    assert not CategorizerService.matches_rule(rule_inactive, raw_label="SPOTIFY")


def test_categorization_rules_endpoints_and_batch_apply(auth_client):
    client, user = auth_client
    # 1. Create a dummy account and transactions for the authenticated user
    db = SessionLocal()
    user_id = user.id

    acc_id = f"acc_rule_{uuid.uuid4().hex[:8]}"
    acc = Account(
        id=acc_id,
        user_id=user_id,
        name="Compte Test Règles",
        account_type="Compte Courant",
        balance=1000.0,
    )
    db.add(acc)

    tx1_id = f"tx_rule_1_{uuid.uuid4().hex[:8]}"
    tx2_id = f"tx_rule_2_{uuid.uuid4().hex[:8]}"

    tx1 = Transaction(
        id=tx1_id,
        user_id=user_id,
        account_id=acc.id,
        booking_date="2026-09-15",
        amount=-12.99,
        raw_label="CB NETFLIX PREMIUM PARIS",
        merchant_name="Netflix",
        category="Divers",
        subcategory=None,
        is_user_classified=False,
    )
    tx2 = Transaction(
        id=tx2_id,
        user_id=user_id,
        account_id=acc.id,
        booking_date="2026-09-20",
        amount=3200.0,
        raw_label="VIR SALAIRE MENSUEL SOCIETE GENERALE",
        merchant_name="Société Générale",
        category="Divers",
        subcategory=None,
        is_user_classified=False,
    )
    db.add(tx1)
    db.add(tx2)
    db.commit()
    db.close()

    # 2. Test regex validation failure
    bad_rule_resp = client.post("/api/v1/rules", json={
        "name": "Bad Regex",
        "pattern": "[invalid(regex",
        "match_type": "regex",
        "category": "Abonnements",
    })
    assert bad_rule_resp.status_code == 400

    # 3. Create valid rules
    r1_resp = client.post("/api/v1/rules", json={
        "name": "Règle Netflix",
        "pattern": "NETFLIX",
        "match_type": "contains",
        "category": "Abonnements",
        "subcategory": "Streaming",
        "tags": ["#streaming", "#perso"],
        "priority": 10,
    })
    assert r1_resp.status_code == 200
    r1_data = r1_resp.json()["rule"]
    assert r1_data["category"] == "Abonnements"
    assert "#streaming" in r1_data["tags"]

    r2_resp = client.post("/api/v1/rules", json={
        "name": "Règle Salaire",
        "pattern": r"^VIR\s+SALAIRE.*",
        "match_type": "regex",
        "amount_type": "income",
        "category": "Revenus",
        "subcategory": "Salaire",
        "tags": ["#salaire"],
        "priority": 20,
    })
    assert r2_resp.status_code == 200
    r2_data = r2_resp.json()["rule"]

    # 4. List rules
    list_resp = client.get("/api/v1/rules")
    assert list_resp.status_code == 200
    rules_list = list_resp.json()["rules"]
    assert len(rules_list) >= 2

    # 5. Test pattern endpoint preview
    test_preview = client.post("/api/v1/rules/test", json={
        "pattern": "NETFLIX",
        "match_type": "contains",
    })
    assert test_preview.status_code == 200
    preview_data = test_preview.json()
    assert preview_data["matched_count"] >= 1
    assert any("NETFLIX" in s["raw_label"] for s in preview_data["samples"])

    # 6. Batch apply rules retrospectively
    apply_resp = client.post("/api/v1/rules/batch-apply", json={
        "overwrite_user_classified": False,
    })
    assert apply_resp.status_code == 200
    apply_data = apply_resp.json()
    assert apply_data["status"] == "success"
    assert apply_data["updated_count"] >= 2

    # Verify transactions were updated in DB
    tx_list_resp = client.get("/api/v1/transactions")
    assert tx_list_resp.status_code == 200
    txs = tx_list_resp.json()["transactions"]

    netflix_tx = next(t for t in txs if t["id"] == tx1_id)
    assert netflix_tx["category"] == "Abonnements"
    assert netflix_tx["subcategory"] == "Streaming"
    assert "#streaming" in netflix_tx["tags"]

    salaire_tx = next(t for t in txs if t["id"] == tx2_id)
    assert salaire_tx["category"] == "Revenus"
    assert salaire_tx["subcategory"] == "Salaire"
    assert "#salaire" in salaire_tx["tags"]

    # 7. Toggle rule active state
    toggle_resp = client.patch(f"/api/v1/rules/{r1_data['id']}/toggle")
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["is_active"] is False

    # 8. Delete rule
    del_resp = client.delete(f"/api/v1/rules/{r1_data['id']}")
    assert del_resp.status_code == 200
