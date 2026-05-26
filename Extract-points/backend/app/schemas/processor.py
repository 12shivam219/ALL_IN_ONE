from pydantic import BaseModel, Field
from typing import List, Optional

class TextProcessRequest(BaseModel):
    text: str = Field(..., description="Structured text containing headings and bullet points")
    points_per_cycle: int = Field(2, ge=1, le=10, description="Points per heading per cycle")
    deduplication_enabled: bool = Field(False, description="Whether to filter duplicate bullet points")

class TextProcessResponse(BaseModel):
    processed_text: str
    stats: Optional[dict] = None

class BatchProcessPasteRequest(BaseModel):
    batch_text: str = Field(..., description="Texts separated by triple-dash '---'")
    points_per_cycle: int = Field(2, ge=1, le=10)
    deduplication_enabled: bool = Field(False)
