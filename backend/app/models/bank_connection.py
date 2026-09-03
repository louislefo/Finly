from sqlalchemy import Column, String, DateTime
from datetime import datetime
from app.core.database import Base

class BankConnection(Base):
    __tablename__ = "bank_connections"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    module_name = Column(String, nullable=False)
    bank_name = Column(String, nullable=False)
    login = Column(String, nullable=False)
    password = Column(String, nullable=True)  # Stocké chiffré en AES-256 Fernet
    backend_name = Column(String, nullable=False, unique=True)
    status = Column(String, default="connected")
    created_at = Column(DateTime, default=datetime.utcnow)
    last_synced_at = Column(DateTime, nullable=True)
