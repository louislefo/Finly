from sqlalchemy import Column, String, DateTime
from datetime import datetime
from app.core.database import Base

class MerchantRule(Base):
    __tablename__ = "merchant_rules"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    merchant_pattern = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False)
    subcategory = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
