from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.connection import Base

class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    resume_id = Column(Integer, ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True)
    job_title = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    job_description = Column(Text, nullable=False)
    generated_points = Column(Text, nullable=True)
    recruiter_email = Column(String(255), nullable=True)
    status = Column(String(50), default="processed")  # processed, email_sent, failed
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="job_applications")
    resume = relationship("Resume", back_populates="job_applications")
