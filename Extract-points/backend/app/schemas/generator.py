from pydantic import BaseModel, Field
from typing import List, Optional

class TechExtractRequest(BaseModel):
    job_description: str = Field(..., min_length=50)

class TechExtractResponse(BaseModel):
    technologies: List[str]

class PointsGenerateRequest(BaseModel):
    job_description: str
    job_title: str
    technologies: List[str]
    points_per_tech: int = Field(3, ge=1, le=5)

class PointsGenerateResponse(BaseModel):
    generated_text: str

class PipelineRequest(BaseModel):
    job_description: str = Field(..., min_length=50)
    job_title: str = Field(..., min_length=2)
    points_per_tech: int = Field(3, ge=1, le=5)

class PipelineResponse(BaseModel):
    technologies: List[str]
    generated_text: str
