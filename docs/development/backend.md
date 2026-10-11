# Backend Engineering

This document outlines the architecture, code conventions, testing practices, and dependency patterns used in the Finly Python backend.

---

## Directory Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── endpoints/          # REST route handlers
│   │   │   ├── admin.py        # System stats, users, maintenance
│   │   │   ├── assistant.py    # AI chat & provider endpoints
│   │   │   ├── auth.py         # Login, registration, tokens
│   │   │   ├── budgets.py      # Envelope budgets & cashflow
│   │   │   ├── investments.py  # Stock & portfolio positions
│   │   │   ├── loans.py        # Debt tracking & amortization
│   │   │   ├── sync.py         # Banking sync & reconciliation
│   │   │   ├── woob.py         # Interactive challenge management
│   │   │   └── ...
│   │   └── router.py           # Combined API router (/api/v1)
│   ├── core/
│   │   ├── config.py           # Pydantic BaseSettings
│   │   ├── database.py         # SQLAlchemy Engine & SessionLocal
│   │   ├── security.py         # Bcrypt & JWT token utilities
│   │   └── seed.py             # Multi-month demo dataset seeder
│   ├── models/                 # SQLAlchemy ORM declarative models
│   ├── services/               # Decoupled business logic
│   │   ├── loan_service.py     # Amortization mathematics
│   │   ├── llm_provider_service.py # Multi-provider AI interface
│   │   ├── sync_service.py     # Bank reconciliation engine
│   │   └── woob_service.py     # Direct bank protocol scraper
│   ├── scheduler/              # APScheduler background workers
│   └── main.py                 # FastAPI application root & lifespan
└── tests/                      # Pytest automated test suite
```

---

## Dependency Injection Patterns

FastAPI dependency injection is utilized for session management and authorization:

### 1. Database Session Injection (`get_db`)
Yields an isolated SQLAlchemy session per HTTP request and guarantees session closure:

```python
from fastapi import Depends
from sqlalchemy.orm import Session
from app.core.database import get_db

@router.get("/accounts")
def list_accounts(db: Session = Depends(get_db)):
    return db.query(Account).all()
```

### 2. User Authentication (`get_current_user`)
Validates incoming JWT bearer tokens, checks token revocation, and injects the active `User` model:

```python
from app.core.security import get_current_user
from app.models.user import User

@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email, "role": current_user.role}
```

### 3. Administrator Authorization (`get_current_admin_user`)
Enforces role verification, raising an HTTP 403 Forbidden exception if `user.role != "admin"`:

```python
from app.core.security import get_current_admin_user

@router.post("/maintenance/vacuum")
def trigger_vacuum(admin: User = Depends(get_current_admin_user)):
    ...
```

---

## Testing with Pytest

Finly maintains comprehensive test coverage across endpoints, business logic services, and mathematical calculation models.

### Running the Test Suite

```bash
cd backend
pytest
```

To run a specific test suite with verbose output:

```bash
pytest tests/test_loans.py -v
```

### Test Suite Inventory

| Test Module | Coverage Scope |
| :--- | :--- |
| `test_admin_endpoints.py` | Admin metrics, VACUUM, user impersonation, demo seeding. |
| `test_assistant.py` | RAG context assembly, vector indexing, conversation history. |
| `test_auth_endpoints.py` | User registration, bcrypt verification, JWT signing, shorthand login. |
| `test_budgets_projects_endpoints.py` | Envelope calculations, deposit filtering, milestone tracking. |
| `test_categorization_rules.py` | Contains, exact, and regex rule matching precedence. |
| `test_investments.py` | Stock PRU computations, capital gain calculations, portfolio sector breakdowns. |
| `test_llm_providers.py` | Ollama auto-discovery, Cloud LLM failovers, API key validation. |
| `test_loans.py` | Annuity installment math, amortization schedule validation, early repayment simulation. |
| `test_woob_interactive_and_health.py` | 2FA challenge transitions, regional bank persistence, module update statuses. |
