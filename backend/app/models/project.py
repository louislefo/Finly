from sqlalchemy import Column, String, Float, DateTime
from datetime import datetime
from app.core.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0)
    deadline = Column(String, nullable=False)
    category = Column(String, default="Général")
    status = Column(String, default="in_progress")
    created_at = Column(DateTime, default=datetime.utcnow)
