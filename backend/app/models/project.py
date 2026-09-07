from sqlalchemy import Column, String, Float, DateTime
from datetime import datetime
from app.core.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    project_type = Column(String, default="savings")  # savings, real_estate, general
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0)
    monthly_contribution = Column(Float, default=0.0)
    deadline = Column(String, nullable=False)
    category = Column(String, default="Général")
    status = Column(String, default="in_progress")  # future, in_progress, completed, paused
    linked_account_id = Column(String, nullable=True)
    real_estate_data = Column(String, nullable=True)  # JSON encoded data for real estate loan parameters
    created_at = Column(DateTime, default=datetime.utcnow)
