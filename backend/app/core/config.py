from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Finly API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Secret Key for JWT Tokens and AES-256 Fernet Encryption
    SECRET_KEY: str = "finly-local-secure-encryption-key-2026-very-secret"
    
    # Database
    DATABASE_URL: str = "sqlite:///./finly.db"
    
    # CORS (Allow all local network and tunnel origins for mobile access)
    CORS_ORIGINS: List[str] = ["*"]
    
    # Sync Interval
    SYNC_INTERVAL_HOURS: int = 6

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
