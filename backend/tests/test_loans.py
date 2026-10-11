import pytest
import uuid
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import User
from app.models.loan import Loan
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.services.loan_service import LoanService


@pytest.fixture
def auth_client():
    client = TestClient(app)
    db = SessionLocal()
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=f"usr_loan_{uid}",
        email=f"loan_tester_{uid}@finly.local",
        hashed_password="test_hashed_password",
        full_name="Loan Tester",
        role="member",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()

    token = create_access_token(data={"sub": user.id, "email": user.email})
    client.headers = {"Authorization": f"Bearer {token}"}
    return client, user


def test_loan_service_monthly_payment_math():
    # 200,000 € at 3% over 20 years (240 months) with 0.30% insurance
    res = LoanService.calculate_monthly_payment(
        principal=200000.0,
        annual_rate_pct=3.0,
        duration_months=240,
        insurance_rate_pct=0.30,
    )
    # Monthly principal & interest for 200k @ 3% / 240m is ~1109.20
    assert 1105.0 <= res["monthly_principal_interest"] <= 1115.0
    # Monthly insurance: 200000 * 0.003 / 12 = 50.00
    assert res["monthly_insurance"] == 50.0
    assert res["monthly_payment"] == round(res["monthly_principal_interest"] + 50.0, 2)
    assert res["total_interest"] > 0
    assert res["total_insurance"] == 50.0 * 240
    assert res["total_cost"] == round(200000.0 + res["total_interest"] + 12000.0, 2)


def test_loan_service_live_status():
    # Fixed test date: 2 years (24 months) after start
    start_date = "2024-01"
    now_date = datetime(2026, 1, 15)

    status = LoanService.calculate_live_status(
        principal=100000.0,
        annual_rate_pct=2.5,
        duration_months=120,
        insurance_rate_pct=0.30,
        start_date_str=start_date,
        now=now_date,
    )

    assert status["elapsed_months"] == 24
    assert status["remaining_months"] == 96
    assert 0 < status["remaining_balance"] < 100000.0
    assert status["capital_amortized"] == round(100000.0 - status["remaining_balance"], 2)
    assert 0 < status["completion_percentage"] < 100.0
    assert status["end_date"] == "2034-01"


def test_loan_service_amortization_schedule():
    schedule = LoanService.generate_amortization_schedule(
        principal=50000.0,
        annual_rate_pct=4.0,
        duration_months=60,
        insurance_rate_pct=0.20,
        start_date_str="2025-01",
    )

    assert len(schedule) == 60
    assert schedule[0]["period"] == 1
    assert schedule[0]["beginning_balance"] == 50000.0
    assert schedule[-1]["period"] == 60
    assert schedule[-1]["ending_balance"] == 0.0
    # Total cumulative principal repaid should equal 50,000.0
    assert abs(schedule[-1]["cumulative_principal"] - 50000.0) < 0.5


def test_loan_service_early_repayment_duration_strategy():
    sim = LoanService.simulate_early_repayment(
        principal=150000.0,
        annual_rate_pct=3.5,
        duration_months=240,
        insurance_rate_pct=0.30,
        start_date_str="2024-01",
        repayment_amount=20000.0,
        repayment_month_index=24,
        strategy="reduce_duration",
        penalty_rate_pct=0.0,
    )

    assert sim["strategy"] == "reduce_duration"
    assert sim["repayment_amount"] == 20000.0
    assert sim["months_saved"] > 0
    assert sim["years_saved"] > 0
    assert sim["interest_saved"] > 0
    assert sim["insurance_saved"] > 0
    assert sim["net_savings"] > 0
    assert sim["new_monthly_payment"] == sim["current_monthly_payment"]


def test_loan_service_early_repayment_payment_strategy():
    sim = LoanService.simulate_early_repayment(
        principal=150000.0,
        annual_rate_pct=3.5,
        duration_months=240,
        insurance_rate_pct=0.30,
        start_date_str="2024-01",
        repayment_amount=20000.0,
        repayment_month_index=24,
        strategy="reduce_payment",
        penalty_rate_pct=0.0,
    )

    assert sim["strategy"] == "reduce_payment"
    assert sim["months_saved"] == 0
    assert sim["new_monthly_payment"] < sim["current_monthly_payment"]
    assert sim["monthly_payment_change"] < 0
    assert sim["interest_saved"] > 0
    assert sim["net_savings"] > 0


def test_loans_api_endpoints_crud(auth_client):
    client, user = auth_client

    # 1. Create Loan
    create_payload = {
        "name": "Crédit Immobilier Résidence",
        "loan_type": "mortgage",
        "lender_name": "BNP Paribas",
        "principal_amount": 250000.0,
        "interest_rate": 3.4,
        "insurance_rate": 0.28,
        "duration_months": 300,
        "start_date": "2023-06",
        "rate_type": "fixed",
        "notes": "Prêt principal avec apport 50k",
    }
    res_create = client.post("/api/v1/loans/", json=create_payload)
    assert res_create.status_code == 200
    loan_data = res_create.json()
    loan_id = loan_data["id"]
    assert loan_data["name"] == "Crédit Immobilier Résidence"
    assert loan_data["principal_amount"] == 250000.0
    assert loan_data["remaining_balance"] <= 250000.0
    assert loan_data["monthly_payment"] > 0

    # 2. List Loans
    res_list = client.get("/api/v1/loans/")
    assert res_list.status_code == 200
    items = res_list.json()
    assert any(l["id"] == loan_id for l in items)

    # 3. Get Summary
    res_sum = client.get("/api/v1/loans/summary")
    assert res_sum.status_code == 200
    sum_data = res_sum.json()
    assert sum_data["total_loans_count"] >= 1
    assert sum_data["total_remaining_balance"] > 0
    assert "mortgage" in sum_data["breakdown_by_type"]

    # 4. Get Amortization Schedule
    res_sched = client.get(f"/api/v1/loans/{loan_id}/schedule")
    assert res_sched.status_code == 200
    sched_data = res_sched.json()
    assert sched_data["total_periods"] == 300
    assert len(sched_data["schedule"]) == 300

    # 5. Simulate Early Repayment
    res_sim = client.post(
        f"/api/v1/loans/{loan_id}/simulate-repayment",
        json={"repayment_amount": 15000.0, "strategy": "reduce_duration"},
    )
    assert res_sim.status_code == 200
    sim_data = res_sim.json()
    assert sim_data["months_saved"] > 0
    assert sim_data["net_savings"] > 0

    # 6. Update Loan
    res_up = client.put(f"/api/v1/loans/{loan_id}", json={"name": "Crédit Immobilier RP (Renégocié)"})
    assert res_up.status_code == 200
    assert res_up.json()["name"] == "Crédit Immobilier RP (Renégocié)"

    # 7. Standalone Simulation
    res_standalone = client.post(
        "/api/v1/loans/simulate",
        json={
            "principal_amount": 80000.0,
            "interest_rate": 2.9,
            "duration_months": 120,
            "insurance_rate": 0.25,
        },
    )
    assert res_standalone.status_code == 200
    assert "preview_schedule" in res_standalone.json()

    # 8. Delete Loan
    res_del = client.delete(f"/api/v1/loans/{loan_id}")
    assert res_del.status_code == 200
    res_check = client.get(f"/api/v1/loans/{loan_id}")
    assert res_check.status_code == 404
