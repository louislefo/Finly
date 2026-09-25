import os
import sys
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union
import json


def get_default_data_dir() -> str:
    """Get system standard persistent application data directory."""
    if os.environ.get("FINLY_DATA_DIR"):
        return os.environ["FINLY_DATA_DIR"]

    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        return os.path.join(base, "Finly")
    elif sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/Finly")
    else:
        return os.path.expanduser("~/.local/share/finly")


def get_default_database_url() -> str:
    """Get database URL with fallback to standard OS user data directory."""
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]

    data_dir = get_default_data_dir()
    try:
        os.makedirs(data_dir, exist_ok=True)
    except Exception:
        pass
    db_file = os.path.join(data_dir, "finly.db")
    posix_path = Path(db_file).as_posix()
    return f"sqlite:///{posix_path}"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Finly API"
    VERSION: str = os.environ.get("FINLY_VERSION", "1.0.0")
    API_V1_STR: str = "/api/v1"
    
    # Secret Key for JWT Tokens and AES-256 Fernet Encryption
    SECRET_KEY: str = "finly-local-secure-encryption-key-2026-very-secret"
    
    # Persistent Data Directory
    DATA_DIR: str = get_default_data_dir()

    # Database
    DATABASE_URL: str = get_default_database_url()
    
    # CORS (Allow all local network and tunnel origins for mobile access)
    CORS_ORIGINS: Union[List[str], str] = ["*"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]
    
    # Sync Interval
    SYNC_INTERVAL_HOURS: int = 6

    # Superuser Configuration
    FIRST_SUPERUSER_EMAIL: str = "admin@finly.local"
    FIRST_SUPERUSER_PASSWORD: str = "admin"
    FIRST_SUPERUSER_NAME: str = "Administrateur"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

