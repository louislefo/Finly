from sqlalchemy import Column, String, Float, DateTime
from datetime import datetime
from app.core.database import Base

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, index=True)
    monthly_limit = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
