import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.budget import Budget
from app.models.project import Project
from app.core.security import create_access_token

client = TestClient(app)

@pytest.fixture
def auth_user_and_headers():
    db = SessionLocal()
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=f"usr_bp_{uid}",
        email=f"user_bp_{uid}@finly.local",
        hashed_password="hashed_pw_test",
        full_name="Budgets Projects Tester",
        role="member"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token(data={"sub": user.id, "email": user.email})
    headers = {"Authorization": f"Bearer {token}"}
    
    yield user, headers
    
    # Teardown
    db.query(Budget).filter(Budget.user_id == user.id).delete()
    db.query(Project).filter(Project.user_id == user.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()
    db.close()

def test_budgets_endpoints_flow(auth_user_and_headers):
    user, headers = auth_user_and_headers

    # 1. Get initial budgets summary
    res_get = client.get("/api/v1/budgets", headers=headers)
    assert res_get.status_code == 200
    data = res_get.json()
    assert "items" in data
    assert "total_budget" in data
    assert "total_spent" in data

    # 2. Create / Set budget limit for category
    res_set = client.post("/api/v1/budgets", json={
        "category": "Alimentation",
        "monthly_limit": 450.0
    }, headers=headers)
    assert res_set.status_code == 200
    set_data = res_set.json()
    assert set_data["budget"]["category"] == "Alimentation"
    assert set_data["budget"]["monthly_limit"] == 450.0

    # 3. Update budget limit
    res_update = client.post("/api/v1/budgets", json={
        "category": "Alimentation",
        "monthly_limit": 500.0
    }, headers=headers)
    assert res_update.status_code == 200
    assert res_update.json()["budget"]["monthly_limit"] == 500.0

def test_projects_endpoints_flow(auth_user_and_headers):
    user, headers = auth_user_and_headers

    # 1. Create a new financial project
    res_create = client.post("/api/v1/projects", json={
        "name": "Voyage Japon 2027",
        "target_amount": 4000.0,
        "current_amount": 500.0,
        "monthly_contribution": 200.0,
        "deadline": "2027-06-01",
        "category": "Voyages",
        "project_type": "savings"
    }, headers=headers)
    assert res_create.status_code == 200
    proj = res_create.json()
    assert proj["name"] == "Voyage Japon 2027"
    assert proj["targetAmount"] == 4000.0
    assert proj["currentAmount"] == 500.0
    project_id = proj["id"]

    # 2. Get list of projects
    res_list = client.get("/api/v1/projects", headers=headers)
    assert res_list.status_code == 200
    list_data = res_list.json()
    assert isinstance(list_data, list)
    assert any(p["id"] == project_id for p in list_data)

    # 3. Add funds to project
    res_funds = client.post(f"/api/v1/projects/{project_id}/funds", json={
        "amount": 300.0
    }, headers=headers)
    assert res_funds.status_code == 200
    assert res_funds.json()["currentAmount"] == 800.0

    # 4. Update project details
    res_put = client.put(f"/api/v1/projects/{project_id}", json={
        "name": "Voyage Japon & Corée 2027",
        "target_amount": 4500.0
    }, headers=headers)
    assert res_put.status_code == 200
    assert res_put.json()["name"] == "Voyage Japon & Corée 2027"
    assert res_put.json()["targetAmount"] == 4500.0

    # 5. Delete project
    res_del = client.delete(f"/api/v1/projects/{project_id}", headers=headers)
    assert res_del.status_code == 200

def test_rates_and_categories_endpoints(auth_user_and_headers):
    user, headers = auth_user_and_headers

    # Rates endpoint
    res_rates = client.get("/api/v1/rates/mortgage", headers=headers)
    assert res_rates.status_code == 200
    rates_data = res_rates.json()
    assert "market_rates" in rates_data
    assert "reference_rates" in rates_data
    assert "livret_a_rate" in rates_data["reference_rates"]

    # Categories endpoint
    res_cats = client.get("/api/v1/categories", headers=headers)
    assert res_cats.status_code == 200
    cats_data = res_cats.json()
    assert "categories" in cats_data
    assert len(cats_data["categories"]) > 0
