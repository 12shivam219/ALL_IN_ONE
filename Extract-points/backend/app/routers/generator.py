from fastapi import APIRouter, HTTPException, Depends, status
from app.schemas.generator import TechExtractRequest, TechExtractResponse, PointsGenerateRequest, PointsGenerateResponse, PipelineRequest, PipelineResponse
from app.services.gemini_points_generator import GeminiPointsGenerator, PointsValidator
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/generator", tags=["AI Points Generation"])

def get_points_generator():
    """Dependency to retrieve points generator helper configured with API keys"""
    try:
        return GeminiPointsGenerator()
    except ValueError as e:
        logger.warning(f"Could not load generator: {str(e)}")
        # Raise HTTP 400 with helpful configuration setup instructions
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Groq API key not configured. Please set GROQ_API_KEY in backend .env file. Visit https://console.groq.com/keys to get a free key."
        )

@router.post("/extract-tech", response_model=TechExtractResponse)
def extract_tech_endpoint(payload: TechExtractRequest, generator: GeminiPointsGenerator = Depends(get_points_generator)):
    """Extracts critical technologies, frameworks, and programming languages from a job description"""
    try:
        techs = generator.extract_tech_stacks(payload.job_description)
        return TechExtractResponse(technologies=techs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-points", response_model=PointsGenerateResponse)
def generate_points_endpoint(payload: PointsGenerateRequest, generator: GeminiPointsGenerator = Depends(get_points_generator)):
    """Generates professional bullet points for each technology aligned with the target job title"""
    try:
        points = generator.generate_points(
            payload.job_description,
            payload.job_title,
            payload.technologies,
            payload.points_per_tech
        )
        return PointsGenerateResponse(generated_text=points)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pipeline", response_model=PipelineResponse)
def pipeline_endpoint(payload: PipelineRequest, generator: GeminiPointsGenerator = Depends(get_points_generator)):
    """Orchestrates both technology extraction and bullet point generation in a single HTTP request"""
    try:
        techs, points = generator.process_job_description(
            payload.job_description,
            payload.job_title,
            payload.points_per_tech
        )
        return PipelineResponse(technologies=techs, generated_text=points)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
