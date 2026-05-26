import io
import json
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from app.core.config import settings
from app.services.email_sender import GmailSender, get_email_sender
from app.services.gemini_points_generator import GeminiPointsGenerator
from app.services.resume_catalog import ResumeCatalog
from app.services.resume_injector import ResumeInjector
from app.services.resume_matcher import ResumeMatcher
from app.services.text_processor import TextProcessor

logger = logging.getLogger(__name__)


class AutomationWorkflow:
    """Orchestrates the complete resume automation workflow."""

    def __init__(self):
        self.catalog = ResumeCatalog()
        self.matcher = ResumeMatcher()
        self.points_generator = GeminiPointsGenerator()
        self.injector = ResumeInjector()
        self.text_processor = TextProcessor()
        self.email_sender = None

        self.workflow_log = []
        self.output_folder = settings.AUTOMATION_OUTPUT_FOLDER
        self.output_folder.mkdir(parents=True, exist_ok=True)

    def log_step(self, step: str, status: str, details: str = ""):
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "step": step,
            "status": status,
            "details": details,
        }
        self.workflow_log.append(log_entry)
        logger.info(f"[{step}] {status}: {details}")

    def save_workflow_log(self, job_title: str):
        try:
            log_filename = f"workflow_log_{job_title}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            log_path = self.output_folder / log_filename

            with open(log_path, "w") as f:
                json.dump(self.workflow_log, f, indent=2)

            logger.info(f"Workflow log saved: {log_path}")
            return str(log_path)
        except Exception as e:
            logger.error(f"Error saving workflow log: {e}")
            return None

    def validate_inputs(
        self,
        job_description: str,
        job_title: str,
        points_per_tech: int,
        recruiter_email: str,
        personal_message: str = "",
    ) -> Tuple[bool, str]:
        if not job_description or len(job_description.strip()) < 50:
            return False, "Job description too short (min 50 characters)"

        if not job_title or len(job_title.strip()) < 2:
            return False, "Job title is required"

        if not isinstance(points_per_tech, int) or points_per_tech < 1 or points_per_tech > 10:
            return False, "Points per technology must be 1-10"

        if not recruiter_email or "@" not in recruiter_email:
            return False, "Invalid recruiter email address"

        return True, "All inputs validated"

    def generate_default_message(self, job_title: str, person_name: str = "Candidate") -> str:
        return f"""Hi there,

Thank you for the opportunity to discuss the {job_title} position.

I have relevant experience with the technologies and skills mentioned in the job description. I would be very interested in learning more about this opportunity and how my background aligns with your team's needs.

I'm attaching my resume for your review and would welcome the chance to speak with you further.

Best regards,
{person_name}"""

    def initialize_email(self, gmail_address: str, app_password: str) -> Tuple[bool, str]:
        try:
            self.email_sender = GmailSender(gmail_address, app_password)
            self.log_step("Email Setup", "SUCCESS", f"Gmail initialized: {gmail_address}")
            return True, "Gmail configured successfully"
        except Exception as e:
            self.log_step("Email Setup", "FAILED", str(e))
            return False, f"Failed to initialize Gmail: {str(e)}"

    def initialize_custom_email(self, provider: str, **config) -> Tuple[bool, str]:
        try:
            sender = get_email_sender(provider, **config)
            if not sender:
                raise ValueError("Failed to obtain sender instance from config")

            self.email_sender = sender
            self.log_step("Email Setup", "SUCCESS", f"{provider.upper()} email sender initialized")
            return True, f"{provider.title()} configured successfully"
        except Exception as e:
            self.log_step("Email Setup", "FAILED", str(e))
            return False, f"Failed to configure {provider}: {str(e)}"

    def _selected_resume_payload(self, selected_resume: Dict) -> Dict:
        return {
            "name": selected_resume["name"],
            "person_name": selected_resume.get("person_name"),
            "technologies": selected_resume.get("technologies", []),
        }

    def _select_resume(
        self,
        job_description: str,
        job_title: str,
        override_resume: Optional[str] = None,
        reviewed_tech_stacks: Optional[List[str]] = None,
    ) -> Tuple[bool, Optional[Dict], float, str]:
        if override_resume:
            selected_resume = self.catalog.get_resume_by_name(override_resume)
            if not selected_resume:
                return False, None, 0.0, f"Resume not found: {override_resume}"
            return True, selected_resume, 100.0, f"Using specified resume: {override_resume}"

        if reviewed_tech_stacks is not None:
            success, best_match, match_msg = self.matcher.find_best_resume_from_techs(
                reviewed_tech_stacks,
                job_title,
                job_description=job_description,
            )
        else:
            success, best_match, match_msg = self.matcher.find_best_resume(
                job_description,
                job_title,
            )

        if not success or not best_match:
            return False, None, 0.0, match_msg

        return True, best_match["resume"], best_match["score"], match_msg

    def _normalize_label(self, value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "", value.lower())

    def _strip_bullet_marker(self, line: str) -> str:
        return re.sub(r"^(?:\u2022|\u00e2\u20ac\u00a2|-|\*|\+|\d+\.|\([a-z0-9]\))\s*", "", line.strip(), flags=re.IGNORECASE)

    def _match_tech_label(
        self,
        label: str,
        normalized_to_tech: Dict[str, str],
        allow_contains: bool = True,
    ) -> Optional[str]:
        normalized_label = self._normalize_label(label)
        if not normalized_label:
            return None

        exact_match = normalized_to_tech.get(normalized_label)
        if exact_match:
            return exact_match

        # Prefer longer names first so JavaScript wins over Java.
        for normalized_tech, tech in sorted(normalized_to_tech.items(), key=lambda item: len(item[0]), reverse=True):
            if len(normalized_tech) < 3:
                continue
            if normalized_label.startswith(normalized_tech):
                return tech
            if allow_contains and (normalized_tech in normalized_label or normalized_label in normalized_tech):
                return tech

        return None

    def _strip_leading_tech_prefix(self, point: str, tech: str) -> str:
        tech_pattern = re.escape(tech)
        cleaned = re.sub(
            rf"^\s*{tech_pattern}\s*(?:[:\-\u2013\u2014]\s*)",
            "",
            point,
            flags=re.IGNORECASE,
        ).strip()
        return cleaned or point

    def _format_generated_points_as_tech_cycles(
        self,
        generated_text: str,
        tech_stacks: List[str],
        points_per_cycle: int = 1,
    ) -> Tuple[str, int]:
        """
        Convert LLM output into cycles that distribute points across all technologies.

        Distribution algorithm:
        - Parse LLM output to extract points grouped by technology
        - Calculate total cycles = ceil(max_points_in_any_tech / points_per_cycle)
        - For each cycle, extract N points from EACH technology
        - Result: Each cycle contains points from multiple technologies

        Example with 2 techs (PHP, Angular) each with 2 points, points_per_cycle=1:
        - Cycle 1: Point 1 from PHP + Point 1 from Angular
        - Cycle 2: Point 2 from PHP + Point 2 from Angular
        """
        if not isinstance(points_per_cycle, int) or points_per_cycle < 1:
            raise ValueError("points_per_cycle must be a positive integer")

        ordered_techs = []
        seen_techs = set()
        for tech in tech_stacks:
            cleaned_tech = tech.strip() if tech else ""
            normalized_tech = self._normalize_label(cleaned_tech)
            if cleaned_tech and normalized_tech not in seen_techs:
                ordered_techs.append(cleaned_tech)
                seen_techs.add(normalized_tech)
        normalized_to_tech = {self._normalize_label(tech): tech for tech in ordered_techs}
        points_by_tech = {tech: [] for tech in ordered_techs}
        fallback_sections = []
        current_tech = None

        # Parse LLM output to extract points by technology
        for raw_line in generated_text.splitlines():
            line = raw_line.strip()
            if not line:
                continue

            is_bullet = bool(re.match(r"^(?:\u2022|\u00e2\u20ac\u00a2|-|\*|\+|\d+\.|\([a-z0-9]\))\s*", line, re.IGNORECASE))
            heading_candidate = self._strip_bullet_marker(line).rstrip(":")
            normalized_line = self._normalize_label(heading_candidate)
            matched_tech = self._match_tech_label(heading_candidate, normalized_to_tech)

            if matched_tech and len(heading_candidate) <= 80 and (not is_bullet or self._normalize_label(matched_tech) == normalized_line):
                current_tech = matched_tech
                continue

            if is_bullet and current_tech:
                point = self._strip_bullet_marker(line)
                if point:
                    points_by_tech[current_tech].append(point)
                continue

            if is_bullet:
                point = self._strip_bullet_marker(line)
                bullet_tech = self._match_tech_label(point[:120], normalized_to_tech, allow_contains=False)
                if point and bullet_tech:
                    points_by_tech[bullet_tech].append(self._strip_leading_tech_prefix(point, bullet_tech))
                    continue

            # If the model used non-tech headings, keep them so their points are not dropped.
            if not is_bullet and len(line) <= 80:
                current_tech = None
                fallback_sections.append((line, []))
            elif is_bullet and fallback_sections:
                point = self._strip_bullet_marker(line)
                if point:
                    fallback_sections[-1][1].append(point)

        # Main algorithm: Distribute points across cycles
        result = []
        point_groups = [(tech, points_by_tech.get(tech, [])) for tech in ordered_techs]
        point_groups.extend(
            (heading, points)
            for heading, points in fallback_sections
            if points
        )
        
        # Step 1: Find max points across all techs
        max_points = max((len(points) for _, points in point_groups), default=0)
        logger.info(f"[Distribution debug] max_points={max_points}, points_per_cycle={points_per_cycle}, tech_counts={[(tech, len(pts)) for tech, pts in point_groups]}")
        if max_points == 0:
            return "", 0
        
        # Step 2: Calculate total cycles needed
        total_cycles = (max_points + points_per_cycle - 1) // points_per_cycle  # Ceiling division
        
        # Step 3: For each cycle, extract N points from EACH technology
        for cycle_num in range(total_cycles):
            start_idx = cycle_num * points_per_cycle
            end_idx = start_idx + points_per_cycle
            
            result.append(f"Cycle {cycle_num + 1}:")
            
            # Extract N points from each technology/section for this cycle.
            for _, group_points in point_groups:
                cycle_points = group_points[start_idx:min(end_idx, len(group_points))]
                
                if cycle_points:
                    result.extend(f"\u2022 {point}" for point in cycle_points)
        
        return "\n".join(result), total_cycles

    def prepare_workflow(
        self,
        job_description: str,
        job_title: str,
        points_per_tech: int,
        recruiter_email: str,
        personal_message: str = "",
        override_resume: Optional[str] = None,
    ) -> Tuple[bool, Dict]:
        """Validate, extract tech stacks, and select a resume before point generation."""
        result = {
            "success": False,
            "job_title": job_title,
            "selected_resume": None,
            "match_score": 0,
            "tech_stacks": [],
            "errors": [],
        }

        self.workflow_log = []

        self.log_step("Input Validation", "START", "")
        is_valid, msg = self.validate_inputs(
            job_description,
            job_title,
            points_per_tech,
            recruiter_email,
            personal_message,
        )
        if not is_valid:
            self.log_step("Input Validation", "FAILED", msg)
            result["errors"].append(msg)
            return False, result
        self.log_step("Input Validation", "SUCCESS", msg)

        self.log_step("Tech Stack Extraction", "START", "Extracting technologies from job description...")
        success, tech_stacks, extract_msg = self.matcher.extract_job_tech_stacks(job_description)
        if not success or not tech_stacks:
            self.log_step("Tech Stack Extraction", "FAILED", extract_msg)
            result["errors"].append(extract_msg or "Could not extract technologies from job description")
            return False, result
        self.log_step("Tech Stack Extraction", "SUCCESS", extract_msg)

        self.log_step("Resume Matching", "START", "Analyzing resume catalog...")
        success, selected_resume, match_score, match_msg = self._select_resume(
            job_description=job_description,
            job_title=job_title,
            override_resume=override_resume,
            reviewed_tech_stacks=tech_stacks,
        )
        if not success or not selected_resume:
            self.log_step("Resume Matching", "FAILED", match_msg)
            result["errors"].append(match_msg)
            return False, result

        self.log_step("Resume Matching", "SUCCESS", f"Match score: {match_score:.1f}%")
        result["success"] = True
        result["selected_resume"] = self._selected_resume_payload(selected_resume)
        result["match_score"] = match_score
        result["tech_stacks"] = tech_stacks
        return True, result

    def generate_points_for_review(
        self,
        job_description: str,
        job_title: str,
        points_per_tech: int,
        recruiter_email: str,
        personal_message: str = "",
        override_resume: Optional[str] = None,
        reviewed_tech_stacks: Optional[List[str]] = None,
        points_per_cycle: int = 1,
    ) -> Tuple[bool, Dict]:
        """Generate points and cycle text, then stop for user review before injection."""
        result = {
            "success": False,
            "job_title": job_title,
            "selected_resume": None,
            "match_score": 0,
            "tech_stacks": [],
            "generated_text": "",
            "processed_points": "",
            "errors": [],
        }

        self.workflow_log = []

        self.log_step("Input Validation", "START", "")
        is_valid, msg = self.validate_inputs(
            job_description,
            job_title,
            points_per_tech,
            recruiter_email,
            personal_message,
        )
        if not is_valid:
            self.log_step("Input Validation", "FAILED", msg)
            result["errors"].append(msg)
            return False, result
        self.log_step("Input Validation", "SUCCESS", msg)

        job_techs = [tech.strip() for tech in (reviewed_tech_stacks or []) if tech and tech.strip()]
        if not job_techs:
            self.log_step("Tech Stack Review", "FAILED", "At least one technology is required")
            result["errors"].append("At least one technology is required")
            return False, result
        result["tech_stacks"] = job_techs

        self.log_step("Resume Matching", "START", "Analyzing reviewed technologies...")
        success, selected_resume, match_score, match_msg = self._select_resume(
            job_description=job_description,
            job_title=job_title,
            override_resume=override_resume,
            reviewed_tech_stacks=job_techs,
        )
        if not success or not selected_resume:
            self.log_step("Resume Matching", "FAILED", match_msg)
            result["errors"].append(match_msg)
            return False, result
        self.log_step("Resume Matching", "SUCCESS", f"Match score: {match_score:.1f}%")
        result["selected_resume"] = self._selected_resume_payload(selected_resume)
        result["match_score"] = match_score

        self.log_step(
            "Points Generation",
            "START",
            f"Generating {points_per_tech} points per technology...",
        )
        try:
            generated_text = self.points_generator.generate_points(
                job_description=job_description,
                job_title=job_title,
                tech_stacks=job_techs,
                num_points=points_per_tech,
            )
            result["generated_text"] = generated_text
            self.log_step("Points Generation", "SUCCESS", f"Generated {len(generated_text)} characters of content")
        except Exception as e:
            msg = f"Error generating points: {str(e)}"
            self.log_step("Points Generation", "FAILED", msg)
            result["errors"].append(msg)
            return False, result

        self.log_step("Points Processing", "START", f"Converting generated points to Cycle format ({points_per_cycle} point(s) per technology per cycle)...")
        try:
            processed_points, cycle_count = self._format_generated_points_as_tech_cycles(
                generated_text,
                job_techs,
                points_per_cycle=points_per_cycle,
            )
            if not processed_points:
                logger.warning("Tech-cycle formatting failed; falling back to generic text processor")
                processed_points = self.text_processor.process_text(
                    generated_text,
                    points_per_cycle=points_per_cycle,
                )
                cycle_count = len(re.findall(r"^Cycle\s+\d+:", processed_points, flags=re.IGNORECASE | re.MULTILINE))
            result["processed_points"] = processed_points
            self.log_step("Points Processing", "SUCCESS", f"Points converted into {cycle_count} cycle(s) with proper technology distribution")
        except Exception as e:
            msg = f"Error processing points: {str(e)}"
            self.log_step("Points Processing", "FAILED", msg)
            result["errors"].append(msg)
            return False, result

        result["success"] = True
        return True, result

    def finalize_reviewed_workflow(
        self,
        job_description: str,
        job_title: str,
        points_per_tech: int,
        recruiter_email: str,
        processed_points: str,
        personal_message: str = "",
        override_resume: Optional[str] = None,
        reviewed_tech_stacks: Optional[List[str]] = None,
    ) -> Tuple[bool, Dict]:
        """Inject user-reviewed cycle text into the selected resume and optionally email it."""
        result = {
            "success": False,
            "job_title": job_title,
            "selected_resume": None,
            "updated_resume": None,
            "email_sent": False,
            "tech_stacks": [],
            "errors": [],
        }

        self.workflow_log = []

        self.log_step("Input Validation", "START", "")
        is_valid, msg = self.validate_inputs(
            job_description,
            job_title,
            points_per_tech,
            recruiter_email,
            personal_message,
        )
        if not is_valid:
            self.log_step("Input Validation", "FAILED", msg)
            result["errors"].append(msg)
            return False, result
        if not processed_points or not processed_points.strip():
            self.log_step("Input Validation", "FAILED", "Reviewed cycle points cannot be empty")
            result["errors"].append("Reviewed cycle points cannot be empty")
            return False, result
        self.log_step("Input Validation", "SUCCESS", msg)

        job_techs = [tech.strip() for tech in (reviewed_tech_stacks or []) if tech and tech.strip()]
        if not job_techs:
            self.log_step("Tech Stack Review", "FAILED", "At least one technology is required")
            result["errors"].append("At least one technology is required")
            return False, result
        result["tech_stacks"] = job_techs

        self.log_step("Resume Matching", "START", "Selecting resume for reviewed points...")
        success, selected_resume, match_score, match_msg = self._select_resume(
            job_description=job_description,
            job_title=job_title,
            override_resume=override_resume,
            reviewed_tech_stacks=job_techs,
        )
        if not success or not selected_resume:
            self.log_step("Resume Matching", "FAILED", match_msg)
            result["errors"].append(match_msg)
            return False, result
        self.log_step("Resume Matching", "SUCCESS", f"Match score: {match_score:.1f}%")
        result["selected_resume"] = self._selected_resume_payload(selected_resume)
        result["match_score"] = match_score

        if not personal_message or len(personal_message.strip()) < 5:
            person_name = selected_resume.get("person_name", "Candidate")
            personal_message = self.generate_default_message(job_title, person_name)
            self.log_step("Message Generation", "AUTO", f"Auto-generated message for {person_name}")
        else:
            self.log_step("Message Generation", "PROVIDED", "Using user-provided message")

        self.log_step("Resume Injection", "START", f"Injecting reviewed points into: {selected_resume['name']}")
        try:
            resume_bytes = self.catalog.get_resume_bytes(selected_resume["name"])

            updated_resume_bytes, _ = self.injector.inject_points_into_resume(
                resume_bytes=resume_bytes,
                processed_text=processed_points,
            )
            result["updated_resume"] = updated_resume_bytes.getvalue()
            self.log_step("Resume Injection", "SUCCESS", "Reviewed points successfully injected into resume")
        except Exception as e:
            msg = f"Error injecting points: {str(e)}"
            self.log_step("Resume Injection", "FAILED", msg)
            result["errors"].append(msg)
            return False, result

        try:
            person_name = selected_resume.get("person_name", "Candidate")
            safe_title = "".join(c if c.isalnum() or c in [' ', '_', '-'] else '-' for c in job_title)
            safe_title = re.sub(r'[-\s]+', '_', safe_title).strip('_')
            resume_filename = f"{safe_title}_{person_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
            resume_filepath = self.output_folder / resume_filename

            with open(resume_filepath, "wb") as f:
                f.write(updated_resume_bytes.getvalue())

            result["resume_file_path"] = str(resume_filepath)
            self.log_step("Resume Saving", "SUCCESS", f"Saved to: {resume_filepath}")
        except Exception as e:
            logger.error(f"Error saving resume: {e}")

        if self.email_sender:
            self.log_step("Email Sending", "START", f"Sending to: {recruiter_email}")
            try:
                person_name = selected_resume.get("person_name", "Candidate")
                subject = f"Resume - {job_title} - {person_name}"
                email_body = (
                    f"{personal_message}\n\n"
                    f"Position: {job_title}\n"
                    f"Resume: {person_name}\n"
                    f"Technologies: {', '.join(job_techs)}\n\n"
                    "Best regards"
                )

                updated_resume_bytes.seek(0)
                attachments = [(f"{person_name}_Resume.docx", updated_resume_bytes)]
                email_success = self.email_sender.send_email(
                    recipient=recruiter_email,
                    subject=subject,
                    body=email_body,
                    attachments=attachments,
                    from_name=person_name,
                )

                if email_success:
                    result["email_sent"] = True
                    self.log_step("Email Sending", "SUCCESS", f"Email sent to {recruiter_email}")
                else:
                    self.log_step("Email Sending", "FAILED", "Email send failed")
                    result["errors"].append("Failed to send email")
            except Exception as e:
                msg = f"Error sending email: {str(e)}"
                self.log_step("Email Sending", "FAILED", msg)
                result["errors"].append(msg)
        else:
            self.log_step("Email Sending", "SKIPPED", "Email not configured")

        result["success"] = True
        result["log_file"] = self.save_workflow_log(job_title)
        return True, result

    def run_workflow(
        self,
        job_description: str,
        job_title: str,
        points_per_tech: int,
        recruiter_email: str,
        personal_message: str = "",
        override_resume: Optional[str] = None,
        reviewed_tech_stacks: Optional[List[str]] = None,
        points_per_cycle: int = 1,
    ) -> Tuple[bool, Dict]:
        """Run complete automation workflow."""
        result = {
            "success": False,
            "job_title": job_title,
            "selected_resume": None,
            "extracted_points": None,
            "updated_resume": None,
            "email_sent": False,
            "errors": [],
        }

        self.workflow_log = []

        try:
            self.log_step("Input Validation", "START", "")
            is_valid, msg = self.validate_inputs(
                job_description,
                job_title,
                points_per_tech,
                recruiter_email,
                personal_message,
            )
            if not is_valid:
                self.log_step("Input Validation", "FAILED", msg)
                result["errors"].append(msg)
                return False, result
            self.log_step("Input Validation", "SUCCESS", msg)

            self.log_step("Tech Stack Review", "START", "Using reviewed technologies...")
            if reviewed_tech_stacks is None:
                success, job_techs, extract_msg = self.matcher.extract_job_tech_stacks(job_description)
                if not success or not job_techs:
                    self.log_step("Tech Stack Review", "FAILED", extract_msg)
                    result["errors"].append(extract_msg or "Could not extract technologies from job description")
                    return False, result
            else:
                job_techs = [tech.strip() for tech in reviewed_tech_stacks if tech and tech.strip()]
                if not job_techs:
                    self.log_step("Tech Stack Review", "FAILED", "At least one technology is required")
                    result["errors"].append("At least one technology is required")
                    return False, result
            self.log_step("Tech Stack Review", "SUCCESS", f"Using {len(job_techs)} technologies")
            result["tech_stacks"] = job_techs

            self.log_step("Resume Matching", "START", "Analyzing job technologies...")
            success, selected_resume, match_score, match_msg = self._select_resume(
                job_description=job_description,
                job_title=job_title,
                override_resume=override_resume,
                reviewed_tech_stacks=job_techs,
            )
            if not success or not selected_resume:
                self.log_step("Resume Matching", "FAILED", match_msg)
                result["errors"].append(match_msg)
                return False, result

            self.log_step("Resume Matching", "SUCCESS", f"Match score: {match_score:.1f}%")
            result["selected_resume"] = self._selected_resume_payload(selected_resume)
            result["match_score"] = match_score

            if not personal_message or len(personal_message.strip()) < 5:
                person_name = selected_resume.get("person_name", "Candidate")
                personal_message = self.generate_default_message(job_title, person_name)
                self.log_step("Message Generation", "AUTO", f"Auto-generated message for {person_name}")
            else:
                self.log_step("Message Generation", "PROVIDED", "Using user-provided message")

            self.log_step(
                "Points Generation",
                "START",
                f"Generating {points_per_tech} points per technology...",
            )
            try:
                generated_text = self.points_generator.generate_points(
                    job_description=job_description,
                    job_title=job_title,
                    tech_stacks=job_techs,
                    num_points=points_per_tech,
                )
                self.log_step("Points Generation", "SUCCESS", f"Generated {len(generated_text)} characters of content")
                result["extracted_points"] = generated_text
                result["generated_text"] = generated_text
            except Exception as e:
                msg = f"Error generating points: {str(e)}"
                self.log_step("Points Generation", "FAILED", msg)
                result["errors"].append(msg)
                return False, result

            self.log_step("Points Processing", "START", f"Converting generated points to Cycle format ({points_per_cycle} point(s) per technology per cycle)...")
            try:
                processed_points, cycle_count = self._format_generated_points_as_tech_cycles(
                    generated_text,
                    job_techs,
                    points_per_cycle=points_per_cycle,
                )
                if not processed_points:
                    logger.warning("Tech-cycle formatting failed; falling back to generic text processor")
                    processed_points = self.text_processor.process_text(
                        generated_text,
                        points_per_cycle=points_per_cycle,
                    )
                    cycle_count = len(re.findall(r"^Cycle\s+\d+:", processed_points, flags=re.IGNORECASE | re.MULTILINE))
                logger.info(f"Processed text (first 500 chars): {processed_points[:500]}")
                logger.info(f"Total processed text length: {len(processed_points)} chars")
                result["processed_points"] = processed_points
                self.log_step(
                    "Points Processing",
                    "SUCCESS",
                    f"Points converted into {cycle_count} tech-based cycle(s)",
                )
            except Exception as e:
                msg = f"Error processing points: {str(e)}"
                logger.error(f"Text processing failed: {e}", exc_info=True)
                logger.error(f"Generated text that failed: {generated_text[:1000]}")
                self.log_step("Points Processing", "FAILED", msg)
                result["errors"].append(msg)
                return False, result

            self.log_step("Resume Injection", "START", f"Injecting points into: {selected_resume['name']}")
            try:
                resume_bytes = self.catalog.get_resume_bytes(selected_resume["name"])

                updated_resume_bytes, _ = self.injector.inject_points_into_resume(
                    resume_bytes=resume_bytes,
                    processed_text=processed_points,
                )
                self.log_step("Resume Injection", "SUCCESS", "Points successfully injected into resume")
                result["updated_resume"] = updated_resume_bytes.getvalue()
            except Exception as e:
                msg = f"Error injecting points: {str(e)}"
                self.log_step("Resume Injection", "FAILED", msg)
                result["errors"].append(msg)
                return False, result

            try:
                person_name = selected_resume.get("person_name", "Candidate")
                safe_title = "".join(c if c.isalnum() or c in [' ', '_', '-'] else '-' for c in job_title)
                safe_title = re.sub(r'[-\s]+', '_', safe_title).strip('_')
                resume_filename = f"{safe_title}_{person_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
                resume_filepath = self.output_folder / resume_filename

                with open(resume_filepath, "wb") as f:
                    f.write(updated_resume_bytes.getvalue())

                self.log_step("Resume Saving", "SUCCESS", f"Saved to: {resume_filepath}")
                result["resume_file_path"] = str(resume_filepath)
            except Exception as e:
                logger.error(f"Error saving resume: {e}")

            if self.email_sender:
                self.log_step("Email Sending", "START", f"Sending to: {recruiter_email}")
                try:
                    person_name = selected_resume.get("person_name", "Candidate")
                    subject = f"Resume - {job_title} - {person_name}"
                    email_body = (
                        f"{personal_message}\n\n"
                        f"Position: {job_title}\n"
                        f"Resume: {person_name}\n"
                        f"Technologies: {', '.join(job_techs)}\n\n"
                        "Best regards"
                    )

                    updated_resume_bytes.seek(0)
                    attachments = [(f"{person_name}_Resume.docx", updated_resume_bytes)]
                    email_success = self.email_sender.send_email(
                        recipient=recruiter_email,
                        subject=subject,
                        body=email_body,
                        attachments=attachments,
                        from_name=person_name,
                    )

                    if email_success:
                        self.log_step("Email Sending", "SUCCESS", f"Email sent to {recruiter_email}")
                        result["email_sent"] = True
                    else:
                        self.log_step("Email Sending", "FAILED", "Email send failed")
                        result["errors"].append("Failed to send email")
                except Exception as e:
                    msg = f"Error sending email: {str(e)}"
                    self.log_step("Email Sending", "FAILED", msg)
                    result["errors"].append(msg)
            else:
                self.log_step("Email Sending", "SKIPPED", "Email not configured")

            result["success"] = True
            result["log_file"] = self.save_workflow_log(job_title)
            return True, result

        except Exception as e:
            msg = f"Unexpected error: {str(e)}"
            self.log_step("Workflow", "FAILED", msg)
            result["errors"].append(msg)
            logger.error(f"Workflow failed: {e}")
            return False, result
