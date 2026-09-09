from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union
import json

class Settings(BaseSettings):
    PROJECT_NAME: str = "Finly API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Secret Key for JWT Tokens and AES-256 Fernet Encryption
    SECRET_KEY: str = "finly-local-secure-encryption-key-2026-very-secret"
    
    # Database
    DATABASE_URL: str = "sqlite:///./data/finly.db"
    
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
