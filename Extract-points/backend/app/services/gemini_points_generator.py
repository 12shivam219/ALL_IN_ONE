import logging
import os
import re
from typing import List, Tuple

from groq import Groq

from app.core.config import settings

logger = logging.getLogger(__name__)


class GeminiPointsGenerator:
    """Generate resume points from job descriptions using Groq API."""

    def __init__(self, api_key: str = None):
        """Initialize Groq API client."""
        try:
            if api_key is None:
                api_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")

            if not api_key:
                raise ValueError("Groq API key not found. Please set GROQ_API_KEY in .env file or configuration")

            self.client = Groq(api_key=api_key)
            self.model = "llama-3.3-70b-versatile"
        except Exception as e:
            logger.error(f"Failed to initialize Groq: {str(e)}")
            raise ValueError(f"Invalid Groq API key or initialization failed: {str(e)}")

    def extract_tech_stacks(self, job_description: str) -> List[str]:
        """Extract tech stacks from job description using Groq."""
        if not job_description or not job_description.strip():
            raise ValueError("Job description cannot be empty")

        try:
            prompt = f"""Extract all technologies, programming languages, frameworks, tools, and platforms mentioned in this job description.

Return ONLY a comma-separated list of technologies (no explanations, no numbering, no bullets).

Job Description:
{job_description}

Return format example: Node.js, React, MongoDB, Python, Docker, AWS"""

            message = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.3,
                max_tokens=500,
            )

            response_text = message.choices[0].message.content
            if not response_text:
                raise ValueError("No tech stacks found in response")

            tech_stacks = [tech.strip() for tech in response_text.split(",")]
            tech_stacks = [tech for tech in tech_stacks if tech]
            if not tech_stacks:
                raise ValueError("No technologies could be extracted from the job description")

            return tech_stacks
        except Exception as e:
            logger.error(f"Error extracting tech stacks: {str(e)}")
            raise

    def generate_points(
        self,
        job_description: str,
        job_title: str,
        tech_stacks: List[str],
        num_points: int,
    ) -> str:
        """Generate resume bullet points using Groq."""
        if not job_title or not job_title.strip():
            raise ValueError("Job title cannot be empty")

        if not tech_stacks:
            raise ValueError("No tech stacks provided")

        if num_points < 1:
            raise ValueError("Number of points must be at least 1")

        try:
            tech_stacks_str = ", ".join(tech_stacks)

            prompt = f"""Generate {num_points} detailed, specific, and professional bullet points for my resume highlighting my experience as a {job_title}.

CRITICAL: You MUST generate points for ALL {len(tech_stacks)} technologies listed below. Do not skip any technology.

Format EXACTLY as shown:

TechName1
- Bullet point 1
- Bullet point 2
- Bullet point 3

TechName2
- Bullet point 1
- Bullet point 2
- Bullet point 3

RULES:
1. Each technology name must be on its own line (just the name, no symbols)
2. Each bullet point must start with a dash and space (- )
3. Each bullet point should be 1-2 sentences, specific and detailed
4. Mention the technology name in each bullet point when relevant
5. Include specific frameworks, versions, or related technologies
6. Focus on achievements, implementations, and business impact
7. Use professional language appropriate for {job_title} role
8. Each tech stack MUST have exactly {num_points} bullet points
9. GENERATE POINTS FOR ALL TECHNOLOGIES - DO NOT SKIP ANY

Technologies to cover ({len(tech_stacks)} total):
{tech_stacks_str}

Job description context:
{job_description}

Generate complete resume bullet points for ALL {len(tech_stacks)} technologies:"""

            message = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.7,
                max_tokens=8000,
            )

            response_text = message.choices[0].message.content
            if not response_text:
                raise ValueError("No content generated from Groq")

            return response_text.strip()
        except Exception as e:
            logger.error(f"Error generating points: {str(e)}")
            raise

    def process_job_description(
        self,
        job_description: str,
        job_title: str,
        num_points: int,
    ) -> Tuple[List[str], str]:
        """Complete pipeline: extract tech stacks and generate points."""
        tech_stacks = self.extract_tech_stacks(job_description)
        points = self.generate_points(
            job_description,
            job_title,
            tech_stacks,
            num_points,
        )
        return tech_stacks, points


class PointsValidator:
    """Validate and format generated points."""

    @staticmethod
    def validate_points(points: str) -> Tuple[bool, str]:
        if not points or not points.strip():
            return False, "Generated points are empty"
        if len(points) < 50:
            return False, "Generated points seem too short"
        return True, ""

    @staticmethod
    def format_points_for_display(points: str) -> str:
        return points.strip()

    @staticmethod
    def extract_bullet_points(points: str) -> List[str]:
        lines = points.split("\n")
        bullet_points = []

        for line in lines:
            line = line.strip()
            if line and re.match(r"^(?:\u2022|\u00e2\u20ac\u00a2|-|\*|\+|\u25e6|\d+\.)\s*", line):
                bullet_points.append(line)

        return bullet_points if bullet_points else lines
