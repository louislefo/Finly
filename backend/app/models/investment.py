from sqlalchemy import Column, String, Float, DateTime
from datetime import datetime
from app.core.database import Base

class InvestmentHolding(Base):
    __tablename__ = "investment_holdings"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    account_id = Column(String, nullable=True, index=True)
    symbol = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    asset_type = Column(String, default="stock")  # stock, etf, crypto, commodity, fund
    quantity = Column(Float, default=0.0)
    buy_price = Column(Float, default=0.0)  # Average purchase price (PRU)
    current_price = Column(Float, default=0.0)
    currency = Column(String, default="EUR")
    sector = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
