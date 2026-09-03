from sqlalchemy import Column, String, DateTime
from datetime import datetime
from app.core.database import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)
    parent_id = Column(String, nullable=True, index=True)
    parent_name = Column(String, nullable=True)
    icon = Column(String, default="Tag")
    color = Column(String, default="#818cf8")
    created_at = Column(DateTime, default=datetime.utcnow)
