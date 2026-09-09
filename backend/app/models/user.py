from sqlalchemy import Column, String, DateTime, Boolean, Integer
from datetime import datetime
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="member")
    is_active = Column(Boolean, default=True)
    auto_sync_enabled = Column(Boolean, default=False)
    sync_interval_hours = Column(Integer, default=12)
    sync_time = Column(String, default="08:00")
    created_at = Column(DateTime, default=datetime.utcnow)
