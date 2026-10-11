import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime
from app.core.database import Base


class Loan(Base):
    __tablename__ = "loans"

    id = Column(String, primary_key=True, index=True, default=lambda: f"loan_{uuid.uuid4().hex[:12]}")
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    loan_type = Column(String, default="mortgage")  # mortgage, student, auto, consumer, personal, other
    lender_name = Column(String, nullable=True)
    principal_amount = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False)  # annual rate in percent e.g. 3.45
    insurance_rate = Column(Float, default=0.30)  # annual insurance rate in percent e.g. 0.30
    duration_months = Column(Integer, nullable=False)  # e.g. 240 (20 years) or 300 (25 years)
    start_date = Column(String, nullable=False)  # YYYY-MM or YYYY-MM-DD
    monthly_payment = Column(Float, nullable=True)  # total installment including insurance
    rate_type = Column(String, default="fixed")  # fixed, variable
    linked_project_id = Column(String, nullable=True)
    linked_account_id = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
