import json
import os
import logging
import io
import requests
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from app.core.config import settings
from app.database.connection import SessionLocal
from app.models.resume import Resume as ResumeModel
from app.models.job_application import JobApplication as JobApplicationModel

logger = logging.getLogger(__name__)

class ResumeCatalog:
    """Manages resume catalog using DB and InsForge OSS storage."""
    
    def __init__(self, db=None):
        """Initialize resume catalog with database session and InsForge OSS configuration."""
        self.db = db
        self.LOCAL_RESUMES_FOLDER = settings.LOCAL_RESUMES_FOLDER
        self.api_key = settings.INSFORGE_API_KEY
        self.oss_host = settings.INSFORGE_OSS_HOST
        self.bucket_name = "resumes"

    def _get_db(self):
        if self.db is not None:
            return self.db
        return SessionLocal()

    def _to_dict(self, resume: ResumeModel) -> Dict:
        return {
            "name": resume.filename,
            "path": resume.s3_path or f"resumes/{resume.filename}",
            "source": "local",  # Mark as local to stay compatible with frontend UI flow
            "file_id": None,
            "person_name": resume.person_name or "Generic",
            "technologies": resume.technologies or [],
            "job_roles": resume.job_roles or [],
            "bookmarks": resume.bookmarks or [],
            "added_date": resume.created_at.strftime("%Y-%m-%d") if resume.created_at else "2026-05-25"
        }

    def _validate_filename_format(self, file_path: Path) -> Tuple[bool, str, Optional[str], Optional[List[str]]]:
        """Validate filename format and extract metadata.
        Returns: (is_valid, error_message, person_name, technologies)
        """
        filename = file_path.name
        name_parts = file_path.stem.split('_')
        
        # Validate format: PersonName_Tech1_Tech2_...
        if len(name_parts) < 2:
            return False, f"❌ Invalid format: '{filename}' must be 'PersonName_Tech1_Tech2...'. Example: 'John_Python_React.docx'", None, None
        
        person_name = name_parts[0]
        technologies = name_parts[1:]
        
        # Validate person name (alphanumeric and hyphens only)
        if not person_name.replace('-', '').isalnum():
            return False, f"❌ Invalid person name: '{person_name}' contains special characters", None, None
        
        # Validate each technology is alphanumeric with dots/hyphens/pluses allowed
        for tech in technologies:
            if not all(c.isalnum() or c in ['.', '-', '+', '#'] for c in tech):
                return False, f"❌ Invalid technology: '{tech}' contains invalid characters. Use only alphanumeric, dots, hyphens, plus, or hash.", None, None
        
        return True, "", person_name, technologies

    def _check_resume_duplicate(self, person_name: str, technologies: List[str], exclude_id: Optional[int] = None) -> Tuple[bool, str]:
        """Check if resume with same person_name and technologies already exists."""
        db = self._get_db()
        should_close = (db is not self.db)
        try:
            techs_normalized = sorted([t.lower() for t in technologies])
            resumes = db.query(ResumeModel).all()
            for r in resumes:
                if exclude_id and r.id == exclude_id:
                    continue
                existing_techs = sorted([t.lower() for t in (r.technologies or [])])
                if r.person_name and r.person_name.lower() == person_name.lower() and existing_techs == techs_normalized:
                    return True, f"❌ Duplicate detected: Resume for {person_name} with same tech stack already exists: {r.filename}"
            return False, ""
        finally:
            if should_close:
                db.close()

    def _upload_file_to_oss(self, filename: str, file_bytes: bytes) -> str:
        """Upload file content to InsForge OSS bucket."""
        if not self.api_key or not self.oss_host:
            logger.warning("InsForge OSS is not configured. Skipping cloud upload.")
            return filename
            
        url = f"{self.oss_host}/api/storage/buckets/{self.bucket_name}/objects/{filename}"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        
        try:
            r = requests.put(url, headers=headers, files={"file": (filename, file_bytes)})
            if r.status_code in [200, 201]:
                logger.info(f"Successfully uploaded {filename} to InsForge OSS bucket '{self.bucket_name}'")
                return filename
            else:
                raise Exception(f"InsForge OSS upload failed (HTTP {r.status_code}): {r.text}")
        except Exception as e:
            logger.error(f"Error uploading to InsForge OSS: {e}")
            raise Exception(f"Failed to upload file to cloud storage: {str(e)}")

    def register_resume_from_local(self, file_path: str) -> Tuple[bool, str]:
        """Register a resume, upload to InsForge OSS, and save metadata to DB."""
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                return False, f"File not found: {file_path}"
            
            if not file_path.suffix.lower() in ['.docx', '.doc', '.pdf']:
                return False, "Only DOCX, DOC, or PDF files are supported"
            
            # Validate filename format
            is_valid, error_msg, person_name, technologies = self._validate_filename_format(file_path)
            if not is_valid:
                return False, error_msg
            
            filename = file_path.name
            
            # Check for duplicate person+tech combination in database
            is_dup, dup_msg = self._check_resume_duplicate(person_name, technologies)
            if is_dup:
                return False, dup_msg
            
            # Try to detect bookmarks
            from app.services.bookmark_manager import BookmarkManager
            try:
                bm_manager = BookmarkManager()
                bookmarks = bm_manager.detect_bookmarks(file_path)
            except Exception as e:
                logger.warning(f"Could not detect bookmarks: {e}")
                bookmarks = []

            # Read file bytes
            with open(file_path, 'rb') as f:
                file_bytes = f.read()

            # Upload to InsForge OSS
            self._upload_file_to_oss(filename, file_bytes)
            
            # Save to Database
            db = self._get_db()
            should_close = (db is not self.db)
            try:
                # Check if already in DB (to update or prevent collision)
                existing = db.query(ResumeModel).filter(ResumeModel.filename == filename).first()
                if existing:
                    existing.person_name = person_name
                    existing.technologies = technologies
                    existing.bookmarks = bookmarks
                    existing.size = len(file_bytes)
                    existing.s3_path = filename
                else:
                    db_resume = ResumeModel(
                        filename=filename,
                        s3_path=filename,
                        person_name=person_name,
                        technologies=technologies,
                        bookmarks=bookmarks,
                        job_roles=[],
                        size=len(file_bytes)
                    )
                    db.add(db_resume)
                db.commit()
            except Exception as e:
                db.rollback()
                raise e
            finally:
                if should_close:
                    db.close()
            
            return True, f"✅ Resume registered: {filename}"
        except Exception as e:
            logger.error(f"Error registering resume: {e}")
            return False, f"Error registering resume: {str(e)}"

    def auto_scan_local_folder(self) -> Tuple[int, List[str]]:
        """Auto-scan local resumes folder, upload to InsForge OSS, and sync database."""
        messages = []
        count = 0
        
        if not self.LOCAL_RESUMES_FOLDER.exists():
            self.LOCAL_RESUMES_FOLDER.mkdir(parents=True, exist_ok=True)
            messages.append("Resumes folder created")
            return 0, messages
        
        db = self._get_db()
        should_close = (db is not self.db)
        try:
            existing_filenames = {r.filename for r in db.query(ResumeModel).all()}
        finally:
            if should_close:
                db.close()
        
        for file_path in self.LOCAL_RESUMES_FOLDER.glob("*.docx"):
            filename = file_path.name
            if filename in existing_filenames:
                continue
            
            success, msg = self.register_resume_from_local(str(file_path))
            messages.append(msg)
            if success:
                count += 1
        
        return count, messages

    def register_resume_from_gdrive(self, file_id: str, filename: str) -> Tuple[bool, str]:
        """Register a resume from Google Drive."""
        try:
            file_path = Path(filename)
            is_valid, error_msg, person_name, technologies = self._validate_filename_format(file_path)
            if not is_valid:
                return False, error_msg
            
            db = self._get_db()
            should_close = (db is not self.db)
            try:
                # Check for duplicate person+tech combination
                is_dup, dup_msg = self._check_resume_duplicate(person_name, technologies)
                if is_dup:
                    return False, dup_msg

                # Check if already registered
                existing = db.query(ResumeModel).filter(ResumeModel.filename == filename).first()
                if existing:
                    return False, f"❌ Resume already registered: {filename}"

                db_resume = ResumeModel(
                    filename=filename,
                    s3_path=None,
                    person_name=person_name,
                    technologies=technologies,
                    bookmarks=[],
                    job_roles=[],
                    size=None
                )
                db.add(db_resume)
                db.commit()
            except Exception as e:
                db.rollback()
                raise e
            finally:
                if should_close:
                    db.close()
                    
            return True, f"✅ Resume registered from Google Drive: {filename}"
        except Exception as e:
            return False, f"Error: {str(e)}"

    def list_resumes(self) -> List[Dict]:
        db = self._get_db()
        should_close = (db is not self.db)
        try:
            resumes = db.query(ResumeModel).order_by(ResumeModel.filename).all()
            return [self._to_dict(r) for r in resumes]
        finally:
            if should_close:
                db.close()

    def get_resume_by_name(self, resume_name: str) -> Optional[Dict]:
        db = self._get_db()
        should_close = (db is not self.db)
        try:
            resume = db.query(ResumeModel).filter(ResumeModel.filename == resume_name).first()
            if resume:
                return self._to_dict(resume)
            return None
        finally:
            if should_close:
                db.close()

    def update_resume_metadata(self, resume_name: str, job_roles: List[str] = None) -> Tuple[bool, str]:
        db = self._get_db()
        should_close = (db is not self.db)
        try:
            resume = db.query(ResumeModel).filter(ResumeModel.filename == resume_name).first()
            if resume:
                if job_roles is not None:
                    resume.job_roles = job_roles
                db.commit()
                return True, "✅ Resume updated"
            return False, "Resume not found"
        except Exception as e:
            db.rollback()
            return False, f"Error updating resume: {str(e)}"
        finally:
            if should_close:
                db.close()

    def get_resumes_by_role(self, job_role: str) -> List[Dict]:
        db = self._get_db()
        should_close = (db is not self.db)
        try:
            role_lower = job_role.lower()
            resumes = db.query(ResumeModel).all()
            matching = []
            for r in resumes:
                if r.job_roles and any(role_lower == role.lower() for role in r.job_roles):
                    matching.append(self._to_dict(r))
            return matching
        finally:
            if should_close:
                db.close()

    def get_resumes_by_tech(self, technology: str) -> List[Dict]:
        db = self._get_db()
        should_close = (db is not self.db)
        try:
            tech_lower = technology.lower()
            resumes = db.query(ResumeModel).all()
            matching = []
            for r in resumes:
                if r.technologies and any(tech_lower == tech.lower() for tech in r.technologies):
                    matching.append(self._to_dict(r))
            return matching
        finally:
            if should_close:
                db.close()

    def record_resume_usage(self, resume_name: str, job_title: str, job_description: str) -> Tuple[bool, str]:
        db = self._get_db()
        should_close = (db is not self.db)
        try:
            resume = db.query(ResumeModel).filter(ResumeModel.filename == resume_name).first()
            if not resume:
                return False, f"Resume not found: {resume_name}"
            
            job_app = JobApplicationModel(
                resume_id=resume.id,
                job_title=job_title,
                job_description=job_description,
                status="processed"
            )
            db.add(job_app)
            db.commit()
            logger.info(f"Recorded usage: {resume_name} for job {job_title}")
            return True, "✅ Resume usage recorded"
        except Exception as e:
            db.rollback()
            logger.error(f"Error recording resume usage: {e}")
            return False, f"Error recording usage: {str(e)}"
        finally:
            if should_close:
                db.close()

    def get_local_resume_path(self, resume_name: str) -> Optional[Path]:
        """Get local resume path fallback (for local development)."""
        path = self.LOCAL_RESUMES_FOLDER / resume_name
        if path.exists():
            return path
        return None

    def get_resume_bytes(self, resume_name: str) -> io.BytesIO:
        """Fetch resume bytes from InsForge OSS cloud storage or fall back to local folder."""
        # 1. Try InsForge OSS download
        if self.api_key and self.oss_host:
            url = f"{self.oss_host}/api/storage/buckets/{self.bucket_name}/objects/{resume_name}"
            headers = {"Authorization": f"Bearer {self.api_key}"}
            try:
                r = requests.get(url, headers=headers)
                if r.status_code == 200:
                    logger.info(f"Successfully downloaded {resume_name} from InsForge OSS")
                    return io.BytesIO(r.content)
            except Exception as e:
                logger.warning(f"Failed to download {resume_name} from cloud storage, falling back to local: {e}")

        # 2. Try Local Fallback
        local_path = self.get_local_resume_path(resume_name)
        if local_path and local_path.exists():
            with open(local_path, 'rb') as f:
                return io.BytesIO(f.read())

        raise Exception(f"Resume template '{resume_name}' not found in InsForge OSS or local resumes folder")

    def download_gdrive_resume(self, resume_name: str) -> Tuple[bool, any]:
        return False, "Google Drive is deprecated, use InsForge OSS cloud storage."

    def delete_resume(self, resume_name: str) -> Tuple[bool, str]:
        """Delete resume metadata from DB and object from InsForge OSS."""
        db = self._get_db()
        should_close = (db is not self.db)
        try:
            resume = db.query(ResumeModel).filter(ResumeModel.filename == resume_name).first()
            if not resume:
                return False, "Resume not found"
            
            # Delete from DB
            db.delete(resume)
            db.commit()
            
            # Try to delete from InsForge OSS (non-blocking, don't fail the DB delete)
            if self.api_key and self.oss_host:
                url = f"{self.oss_host}/api/storage/buckets/{self.bucket_name}/objects/{resume_name}"
                headers = {"Authorization": f"Bearer {self.api_key}"}
                try:
                    requests.delete(url, headers=headers)
                except Exception as e:
                    logger.warning(f"Could not delete {resume_name} from InsForge OSS: {e}")
                    
            return True, f"✅ Resume removed from catalog: {resume_name}"
        except Exception as e:
            db.rollback()
            return False, f"Error deleting resume: {str(e)}"
        finally:
            if should_close:
                db.close()

    def get_catalog_summary(self) -> Dict:
        db = self._get_db()
        should_close = (db is not self.db)
        try:
            resumes = db.query(ResumeModel).all()
            all_techs = set()
            all_roles = set()
            
            for resume in resumes:
                if resume.technologies:
                    all_techs.update(resume.technologies)
                if resume.job_roles:
                    all_roles.update(resume.job_roles)
            
            return {
                "total_resumes": len(resumes),
                "local_resumes": len(resumes), # In production everything is served as 'local' (meaning fully registered templates)
                "gdrive_resumes": 0,
                "unique_technologies": sorted(list(all_techs)),
                "job_roles": sorted(list(all_roles))
            }
        finally:
            if should_close:
                db.close()
