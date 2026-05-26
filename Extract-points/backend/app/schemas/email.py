from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

class EmailSendRequest(BaseModel):
    recipients: List[EmailStr] = Field(..., description="Recipients list")
    subject: str = Field(..., description="Email subject line")
    body: str = Field(..., description="Email body content")
    cloud_provider: str = Field("onedrive", description="onedrive, google, or dropbox")
    resume_name: str = Field(..., description="Name of the resume to send")
    email_provider: str = Field("gmail", description="gmail, outlook, or sendgrid")
    
    # Provider authentication config (sent dynamically from frontend to avoid storing passwords on disk)
    config: Dict[str, Any] = Field(default_factory=dict, description="Provider auth credentials")

class EmailHistoryResponse(BaseModel):
    recipient: str
    resume: str
    timestamp: datetime
    status: str

    class Config:
        from_attributes = True
