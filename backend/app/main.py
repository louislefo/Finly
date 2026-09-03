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

            # Check transactions
            res = conn.execute(text("PRAGMA table_info(transactions)")).fetchall()
            cols = [r[1] for r in res]
            if "user_id" not in cols:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN user_id TEXT"))
            if "subcategory" not in cols:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN subcategory TEXT"))
            if "is_user_classified" not in cols:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN is_user_classified BOOLEAN DEFAULT 0"))

            # Check projects
            res = conn.execute(text("PRAGMA table_info(projects)")).fetchall()
            cols = [r[1] for r in res]
            if "user_id" not in cols:
                conn.execute(text("ALTER TABLE projects ADD COLUMN user_id TEXT"))

            conn.commit()
    except Exception as e:
        print(f"[Auto-Migrate] Note: {e}")

auto_migrate_sqlite()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[Startup] Initialisation de Finly API (Categories dynamiques + Sous-categories)...")
    auto_migrate_sqlite()
    yield
    # Shutdown
    print("[Shutdown] Fermeture de Finly API.")

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
