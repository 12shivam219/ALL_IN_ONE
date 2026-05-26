from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.connection import Base

class BookmarkProfile(Base):
    __tablename__ = "bookmark_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    profile_name = Column(String(255), nullable=False)
    resume_name = Column(String(255), nullable=True)
    bookmarks = Column(JSON, default=list)       # All bookmarks in resume
    mapping = Column(JSON, default=dict)         # Cycle number to bookmark mapping
    created_at = Column(DateTime, default=datetime.utcnow)

    # Note: user relationship can be added if needed
