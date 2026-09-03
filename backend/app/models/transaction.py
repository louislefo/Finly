from sqlalchemy import Column, String, Float, DateTime, Boolean
from datetime import datetime
from app.core.database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    bank_tx_id = Column(String, unique=True, index=True)
    account_id = Column(String, nullable=False, index=True)
    booking_date = Column(String, nullable=False, index=True)
    value_date = Column(String, nullable=True)
    booking_datetime = Column(DateTime, default=datetime.utcnow)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="EUR")
    raw_label = Column(String, nullable=False)
    merchant_name = Column(String, nullable=True)
    category = Column(String, default="Divers")
    subcategory = Column(String, nullable=True)
    is_user_classified = Column(Boolean, default=False)
    project_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
