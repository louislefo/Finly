import pytest
import uuid
from app.core.database import SessionLocal
from app.models.user import User
from app.models.bank_connection import BankConnection
from app.services.sync_service import sync_service
from app.main import auto_migrate_sqlite

auto_migrate_sqlite()

@pytest.mark.asyncio
async def test_sync_reports_missing_password_error():
    db = SessionLocal()
    # Create test user
    user_id = f"usr_{uuid.uuid4().hex[:10]}"
    user = User(
        id=user_id,
        email=f"err_test_{uuid.uuid4().hex[:6]}@finly.local",
        hashed_password="hashed_pw",
        full_name="Sync Error Tester",
        role="member",
    )
    db.add(user)
    db.commit()

    # Create connection without password (e.g. BoursoBank skipped password)
    conn = BankConnection(
        id=f"conn_{uuid.uuid4().hex[:8]}",
        user_id=user.id,
        module_name="bourso",
        bank_name="BoursoBank",
        login="12345678",
        password=None,
        backend_name=f"bourso_{uuid.uuid4().hex[:6]}",
        status="connected",
    )
    db.add(conn)
    db.commit()

    # Run sync
    res = await sync_service.sync_all_active_accounts(
        db=db,
        user_id=user.id,
    )

    assert res["status"] in ["error", "warning"]
    assert len(res["errors"]) >= 1
    found = next((e for e in res["errors"] if e["connection_id"] == conn.id), None)
    assert found is not None
    assert found["status"] == "reconnect_required"
    assert "Mot de passe" in found["message"]

    # Verify that in database conn.status was updated to reconnect_required
    db.refresh(conn)
    assert conn.status == "reconnect_required"

    # Cleanup
    db.delete(conn)
    db.delete(user)
    db.commit()
    db.close()
