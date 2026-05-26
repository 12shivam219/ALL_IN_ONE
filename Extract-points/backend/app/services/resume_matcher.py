import logging
import json
import re
from typing import Dict, List, Optional, Tuple

from app.services.gemini_points_generator import GeminiPointsGenerator
from app.services.resume_catalog import ResumeCatalog

logger = logging.getLogger(__name__)

# Tech stack synonyms mapping for better matching
TECH_SYNONYMS = {
    "node": ["node.js", "nodejs"],
    "node.js": ["node", "nodejs"],
    "nodejs": ["node", "node.js"],
    "js": ["javascript", "typescript"],
    "javascript": ["js", "typescript"],
    "typescript": ["js", "javascript"],
    "py": ["python"],
    "python": ["py"],
    "ts": ["typescript"],
    "react": ["reactjs", "react.js"],
    "reactjs": ["react", "react.js"],
    "react.js": ["react", "reactjs"],
    "vue": ["vuejs", "vue.js"],
    "vuejs": ["vue", "vue.js"],
    "vue.js": ["vue", "vuejs"],
    "angular": ["angularjs"],
    "angularjs": ["angular"],
    "dotnet": ["dot.net", ".net", "csharp", "c#"],
    "dot.net": ["dotnet", ".net", "csharp", "c#"],
    ".net": ["dotnet", "dot.net", "csharp", "c#"],
    "csharp": ["c#", "dotnet", "dot.net", ".net"],
    "c#": ["csharp", "dotnet", "dot.net", ".net"],
    "sql": ["t-sql", "mysql", "postgresql", "postgres"],
    "postgres": ["postgresql", "sql"],
    "postgresql": ["postgres", "sql"],
    "k8s": ["kubernetes"],
    "kubernetes": ["k8s"],
    "aws": ["amazon", "amazon web services"],
    "gcp": ["google cloud", "google cloud platform"],
    "azure": ["microsoft azure"],
}

def _are_techs_equivalent(tech1: str, tech2: str) -> bool:
    """Check if two technologies are equivalent (exact or synonym match)."""
    tech1_lower = tech1.lower()
    tech2_lower = tech2.lower()
    
    if tech1_lower == tech2_lower:
        return True
    
    if tech1_lower in TECH_SYNONYMS:
        return tech2_lower in TECH_SYNONYMS[tech1_lower]
    
    if tech2_lower in TECH_SYNONYMS:
        return tech1_lower in TECH_SYNONYMS[tech2_lower]
    
    return False


class ResumeMatcher:
    """Matches job descriptions or reviewed tech stacks to the best resume."""

    def __init__(self):
        self.catalog = ResumeCatalog()
        try:
            self.points_generator = GeminiPointsGenerator()
        except Exception as e:
            logger.warning(f"Could not initialize points generator: {e}")
            self.points_generator = None

    def extract_job_tech_stacks(self, job_description: str) -> Tuple[bool, List[str], str]:
        """Extract tech stacks from job description using the configured LLM provider."""
        if not self.points_generator:
            return False, [], "Points generator not initialized"

        try:
            tech_stacks = self.points_generator.extract_tech_stacks(job_description)
            logger.info(f"Extracted {len(tech_stacks)} technologies from job description")
            return True, tech_stacks, f"Extracted {len(tech_stacks)} technologies"
        except Exception as e:
            logger.error(f"Error extracting tech stacks: {e}")
            return False, [], f"Error extracting tech stacks: {str(e)}"

    def calculate_match_score(self, job_techs: List[str], resume_techs: List[str]) -> float:
        """Calculate match score between job technologies and resume technologies.
        
        Scoring: 
        - Exact/synonym match: 100 points
        - Substring match: 50 points
        - Max score normalized to 100%
        """
        if not job_techs or not resume_techs:
            return 0.0

        exact_matches = 0
        partial_matches = set()  # Use set to avoid double counting

        # Single pass: check each job tech against all resume techs
        for job_tech in job_techs:
            matched = False
            
            # Check for exact or synonym matches
            for resume_tech in resume_techs:
                if _are_techs_equivalent(job_tech, resume_tech):
                    exact_matches += 1
                    matched = True
                    break
            
            # If no exact match, check for substring matches
            if not matched:
                job_tech_lower = job_tech.lower()
                for resume_tech in resume_techs:
                    resume_tech_lower = resume_tech.lower()
                    if (job_tech_lower in resume_tech_lower or resume_tech_lower in job_tech_lower):
                        partial_matches.add(job_tech)  # Track by job_tech to avoid duplicates
                        break

        total_score = (exact_matches * 100) + (len(partial_matches) * 50)
        max_score = len(job_techs) * 100
        match_percentage = (total_score / max_score) * 100 if max_score > 0 else 0

        return min(match_percentage, 100.0)

    def _rank_all_resumes(self, job_description: str, job_title: str = "", job_techs: Optional[List[str]] = None) -> List[Dict]:
        """Rank all available resumes using LLM semantic matching, falling back to string match if needed."""
        all_resumes = self.catalog.list_resumes()
        if not all_resumes:
            return []

        # Get programmatic tech stacks as fallback metadata
        if not job_techs:
            success, extracted_techs, _ = self.extract_job_tech_stacks(job_description)
            job_techs = extracted_techs if success else []

        if self.points_generator:
            try:
                resumes_data = []
                for r in all_resumes:
                    resumes_data.append({
                        "name": r["name"],
                        "person_name": r.get("person_name", "Unknown"),
                        "technologies": r.get("technologies", [])
                    })

                active_techs_str = f"Active reviewed technologies: {', '.join(job_techs)}\n" if job_techs else ""

                prompt = f"""You are an expert HR applicant tracking system (ATS).
Review the Job Title and Job Description, and rank the candidate resume templates based on how closely their technologies align with the primary requirements of the job.

Job Title: {job_title}
Job Description:
{job_description}

{active_techs_str}Available Resume Templates:
{json.dumps(resumes_data, indent=2)}

Rank the resumes from best match to worst match. Respond with ONLY a valid JSON array of objects (no markdown blocks, no formatting wrappers). Each object must contain:
- name: the filename of the resume (exact match from the list)
- score: a matching percentage score from 0.0 to 100.0 (use the full 0 to 100 scale, e.g., 90.0, 75.0, 20.0, do NOT use 0.0 to 1.0) based on how well the candidate's tech stack fits the job (primary technologies get higher weights)
- explanation: a short 1-sentence explanation of why this resume is placed at this rank.

Example format:
[
  {{"name": "John_React.docx", "score": 90.0, "explanation": "Strong React matches the primary frontend requirements."}},
  {{"name": "John_Java.docx", "score": 10.0, "explanation": "Java has no relevance to this frontend position."}}
]"""

                message = self.points_generator.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.points_generator.model,
                    temperature=0.1,
                    max_tokens=1000,
                )

                response_text = message.choices[0].message.content.strip()
                
                # Robust regex extraction of JSON array
                match = re.search(r"\[\s*\{.*\}\s*\]", response_text, re.DOTALL)
                if match:
                    json_str = match.group(0)
                else:
                    match_brackets = re.search(r"\[.*\]", response_text, re.DOTALL)
                    json_str = match_brackets.group(0) if match_brackets else response_text

                ranked_list = json.loads(json_str)
                scored_resumes = []
                resume_by_name = {r["name"]: r for r in all_resumes}

                for item in ranked_list:
                    name = item.get("name")
                    if name in resume_by_name:
                        resume = resume_by_name[name]
                        matching_techs = self._get_matching_techs(job_techs, resume.get("technologies", []))
                        missing_techs = self._get_missing_techs(job_techs, resume.get("technologies", []))

                        scored_resumes.append({
                            "resume": resume,
                            "score": float(item.get("score", 0.0)),
                            "job_techs": job_techs,
                            "matching_techs": matching_techs,
                            "missing_techs": missing_techs,
                            "explanation": item.get("explanation", "")
                        })

                if scored_resumes:
                    return scored_resumes
            except Exception as e:
                logger.error(f"Error in LLM resume ranking: {e}. Falling back to programmatic matching.")

        # Programmatic Fallback
        scored_resumes = []
        for resume in all_resumes:
            resume_techs = resume.get("technologies", [])
            score = self.calculate_match_score(job_techs, resume_techs)
            scored_resumes.append({
                "resume": resume,
                "score": score,
                "job_techs": job_techs,
                "matching_techs": self._get_matching_techs(job_techs, resume_techs),
                "missing_techs": self._get_missing_techs(job_techs, resume_techs),
                "explanation": f"Programmatic match score based on {len(self._get_matching_techs(job_techs, resume_techs))} matching technology/technologies."
            })

        scored_resumes.sort(key=lambda x: x["score"], reverse=True)
        return scored_resumes

    def find_best_resume_from_techs(
        self,
        job_techs: List[str],
        job_title: str = "",
        job_description: str = "",
    ) -> Tuple[bool, Optional[Dict], str]:
        """Find the best matching resume using an already-reviewed tech stack list."""
        if not job_techs:
            return False, None, "No technologies provided for resume matching"

        if job_description:
            ranked_resumes = self._rank_all_resumes(job_description, job_title, job_techs)
            if ranked_resumes:
                best_match = ranked_resumes[0]
                message = (
                    "Best match found!\n"
                    f"Resume: {best_match['resume']['name']}\n"
                    f"Match Score: {best_match['score']:.1f}%\n"
                    f"Explanation: {best_match.get('explanation', '')}\n"
                    f"Matching Technologies: {', '.join(best_match['matching_techs']) if best_match['matching_techs'] else 'None'}\n"
                    f"Missing Technologies: {', '.join(best_match['missing_techs'][:3]) if best_match['missing_techs'] else 'None'}"
                )
                return True, best_match, message

        # Fallback to programmatic matching
        all_resumes = self.catalog.list_resumes()
        if not all_resumes:
            return False, None, "No resumes in catalog. Please register resumes first."

        scored_resumes = []
        for resume in all_resumes:
            resume_techs = resume.get("technologies", [])
            score = self.calculate_match_score(job_techs, resume_techs)

            scored_resumes.append({
                "resume": resume,
                "score": score,
                "job_techs": job_techs,
                "matching_techs": self._get_matching_techs(job_techs, resume_techs),
                "missing_techs": self._get_missing_techs(job_techs, resume_techs),
                "explanation": f"Programmatic match score: {score:.1f}%"
            })

        scored_resumes.sort(key=lambda x: x["score"], reverse=True)
        if not scored_resumes:
            return False, None, "Could not find matching resume"

        best_match = scored_resumes[0]
        message = (
            "Best match found!\n"
            f"Resume: {best_match['resume']['name']}\n"
            f"Match Score: {best_match['score']:.1f}%\n"
            f"Explanation: {best_match['explanation']}\n"
            f"Matching Technologies: {', '.join(best_match['matching_techs']) if best_match['matching_techs'] else 'None'}\n"
            f"Missing Technologies: {', '.join(best_match['missing_techs'][:3]) if best_match['missing_techs'] else 'None'}"
        )
        return True, best_match, message

    def find_best_resume(
        self,
        job_description: str,
        job_title: str = "",
    ) -> Tuple[bool, Optional[Dict], str]:
        """Find the best matching resume for a job description using semantic LLM ranking."""
        ranked_resumes = self._rank_all_resumes(job_description, job_title)
        if not ranked_resumes:
            return False, None, "No resumes in catalog"

        best_match = ranked_resumes[0]
        message = (
            "Best match found!\n"
            f"Resume: {best_match['resume']['name']}\n"
            f"Match Score: {best_match['score']:.1f}%\n"
            f"Explanation: {best_match.get('explanation', '')}\n"
            f"Matching Technologies: {', '.join(best_match['matching_techs']) if best_match['matching_techs'] else 'None'}\n"
            f"Missing Technologies: {', '.join(best_match['missing_techs'][:3]) if best_match['missing_techs'] else 'None'}"
        )
        return True, best_match, message

    def get_alternative_resumes(
        self,
        job_description: str,
        top_n: int = 3,
    ) -> Tuple[bool, List[Dict], str]:
        """Get alternative resume options ranked by match score."""
        ranked_resumes = self._rank_all_resumes(job_description)
        if not ranked_resumes:
            return False, [], "No resumes in catalog"

        return True, ranked_resumes[:top_n], f"Found {len(ranked_resumes[:top_n])} alternative resumes"

    def _get_matching_techs(self, job_techs: List[str], resume_techs: List[str]) -> List[str]:
        """Get list of technologies that match between job and resume."""
        matching = []
        
        for job_tech in job_techs:
            for i, resume_tech in enumerate(resume_techs):
                # Check for exact/synonym match
                if _are_techs_equivalent(job_tech, resume_tech):
                    matching.append(resume_techs[i])
                    break
                # Check for substring match
                job_lower = job_tech.lower()
                resume_lower = resume_tech.lower()
                if job_lower in resume_lower or resume_lower in job_lower:
                    matching.append(resume_techs[i])
                    break
        
        return list(set(matching))

    def _get_missing_techs(self, job_techs: List[str], resume_techs: List[str]) -> List[str]:
        """Get list of technologies from job that are missing in resume."""
        missing = []
        
        for job_tech in job_techs:
            found = False
            
            # Check for exact/synonym match first
            for resume_tech in resume_techs:
                if _are_techs_equivalent(job_tech, resume_tech):
                    found = True
                    break
            
            # If no exact match, check for substring match
            if not found:
                job_lower = job_tech.lower()
                for resume_tech in resume_techs:
                    resume_lower = resume_tech.lower()
                    if job_lower in resume_lower or resume_lower in job_lower:
                        found = True
                        break
            
            if not found:
                missing.append(job_tech)
        
        return missing
