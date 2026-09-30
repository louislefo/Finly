from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime
from datetime import datetime
from app.core.database import Base


class CategorizationRule(Base):
    __tablename__ = "categorization_rules"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    priority = Column(Integer, default=0, index=True)

    # Condition matchers
    pattern = Column(String, nullable=False, index=True)
    match_type = Column(String, default="contains")  # 'contains', 'exact', 'regex', 'starts_with', 'ends_with'
    apply_to_field = Column(String, default="all")   # 'all', 'raw_label', 'merchant_name'
    account_id = Column(String, nullable=True, index=True)  # Null = all accounts
    amount_type = Column(String, default="any")      # 'any', 'expense', 'income'
    min_amount = Column(Float, nullable=True)        # Minimum absolute amount
    max_amount = Column(Float, nullable=True)        # Maximum absolute amount

    # Automated actions
    category = Column(String, nullable=False)
    subcategory = Column(String, nullable=True)
    tags = Column(String, nullable=True)             # JSON list or comma-separated tags
    is_excluded_from_budget = Column(Boolean, default=False)
    mark_as_transfer = Column(Boolean, default=False)
    logo_url = Column(String, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
