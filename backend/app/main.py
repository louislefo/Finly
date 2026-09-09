from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base
import app.models  # Import all models to register in Base.metadata
from app.api.router import api_router

# Create database tables automatically
Base.metadata.create_all(bind=engine)

def auto_migrate_sqlite():
    """Ensure missing columns in existing SQLite tables are added automatically."""
    try:
        with engine.connect() as conn:
            # Check bank_connections
            res = conn.execute(text("PRAGMA table_info(bank_connections)")).fetchall()
            cols = [r[1] for r in res]
            if "password" not in cols:
                conn.execute(text("ALTER TABLE bank_connections ADD COLUMN password TEXT"))
            if "user_id" not in cols:
                conn.execute(text("ALTER TABLE bank_connections ADD COLUMN user_id TEXT"))

            # Check accounts
            res = conn.execute(text("PRAGMA table_info(accounts)")).fetchall()
            cols = [r[1] for r in res]
            if "user_id" not in cols:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN user_id TEXT"))
            if "created_at" not in cols:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN created_at DATETIME"))
            if "updated_at" not in cols:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN updated_at DATETIME"))
            if "color" not in cols:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN color TEXT DEFAULT 'from-indigo-600 to-blue-600'"))

            # Check transactions
            res = conn.execute(text("PRAGMA table_info(transactions)")).fetchall()
            cols = [r[1] for r in res]
            if "user_id" not in cols:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN user_id TEXT"))
            if "subcategory" not in cols:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN subcategory TEXT"))
            if "is_user_classified" not in cols:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN is_user_classified BOOLEAN DEFAULT 0"))
            if "is_excluded_from_budget" not in cols:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN is_excluded_from_budget BOOLEAN DEFAULT 0"))
            if "project_id" not in cols:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN project_id TEXT"))
            if "logo_url" not in cols:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN logo_url TEXT"))
            if "status" not in cols:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'confirmed'"))

            # Check projects
            res = conn.execute(text("PRAGMA table_info(projects)")).fetchall()
            cols = [r[1] for r in res]
            if "user_id" not in cols:
                conn.execute(text("ALTER TABLE projects ADD COLUMN user_id TEXT"))
            if "project_type" not in cols:
                conn.execute(text("ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT 'savings'"))
            if "monthly_contribution" not in cols:
                conn.execute(text("ALTER TABLE projects ADD COLUMN monthly_contribution FLOAT DEFAULT 0.0"))
            if "linked_account_id" not in cols:
                conn.execute(text("ALTER TABLE projects ADD COLUMN linked_account_id TEXT"))
            if "real_estate_data" not in cols:
                conn.execute(text("ALTER TABLE projects ADD COLUMN real_estate_data TEXT"))

            # Check merchant_rules
            res = conn.execute(text("PRAGMA table_info(merchant_rules)")).fetchall()
            cols = [r[1] for r in res]
            if "logo_url" not in cols:
                conn.execute(text("ALTER TABLE merchant_rules ADD COLUMN logo_url TEXT"))

            # Check users
            res = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            cols = [r[1] for r in res]
            if "is_active" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            if "auto_sync_enabled" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN auto_sync_enabled BOOLEAN DEFAULT 0"))
            if "sync_interval_hours" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN sync_interval_hours INTEGER DEFAULT 12"))
            if "sync_time" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN sync_time TEXT DEFAULT '08:00'"))

            conn.commit()
    except Exception as e:
        print(f"[Auto-Migrate] Note: {e}")

auto_migrate_sqlite()

from app.scheduler.cron_jobs import start_scheduler, shutdown_scheduler
from app.core.seed import init_db_superuser

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[Startup] Initialisation de Finly API (Categories dynamiques + Superuser)...")
    auto_migrate_sqlite()
    try:
        init_db_superuser()
    except Exception as e:
        print(f"[Seed Error]: {e}")
    try:
        start_scheduler()
    except Exception as e:
        print(f"[Scheduler Startup Error]: {e}")
    yield
    # Shutdown
    print("[Shutdown] Fermeture de Finly API.")
    try:
        shutdown_scheduler()
    except Exception as e:
        print(f"[Scheduler Shutdown Error]: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

# CORS middleware for Next.js frontend and mobile access
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "project": "Finly API",
        "version": settings.VERSION,
        "features": "Categories, Subcategories, AES-256 Fernet, Multi-User Auth",
    }
