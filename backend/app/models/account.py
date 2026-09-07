from sqlalchemy import Column, String, Float, DateTime
from datetime import datetime
from app.core.database import Base

class Account(Base):
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    backend_name = Column(String, nullable=True)
    bank_account_id = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    iban = Column(String, nullable=True)
    account_type = Column(String, default="Compte Courant")
    balance = Column(Float, default=0.0)
    currency = Column(String, default="EUR")
    bank_name = Column(String, default="Banque")
    color = Column(String, default="from-indigo-600 to-blue-600")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
