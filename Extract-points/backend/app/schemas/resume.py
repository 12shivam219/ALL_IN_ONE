from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime

class BookmarkDetectResponse(BaseModel):
    bookmarks: List[str]
    count: int

class BookmarkMappingRequest(BaseModel):
    processed_text: str
    custom_mapping: Dict[str, str] = Field(..., description="Map cycle numbers (as strings) to bookmarks")
    unused_handling: str = Field("keep", description="keep, repeat, or clear")

class BookmarkProfileCreate(BaseModel):
    profile_name: str
    resume_name: str
    bookmarks: List[str]
    mapping: Dict[str, str]

class BookmarkProfileResponse(BaseModel):
    id: int
    profile_name: str
    resume_name: Optional[str]
    bookmarks: List[str]
    mapping: Dict[str, str]
    created_at: datetime

    class Config:
        from_attributes = True

class ResumeCatalogItem(BaseModel):
    name: str
    path: Optional[str] = None
    source: str
    file_id: Optional[str] = None
    person_name: Optional[str] = None
    technologies: List[str]
    job_roles: List[str]
    bookmarks: List[str]
    added_date: Optional[str] = None

class CatalogSummaryResponse(BaseModel):
    total_resumes: int
    local_resumes: int
    gdrive_resumes: int
    unique_technologies: List[str]
    job_roles: List[str]
