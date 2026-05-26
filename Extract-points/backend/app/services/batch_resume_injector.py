import io
import logging
from typing import Dict, List, Tuple, Optional
from pathlib import Path
from app.services.resume_injector import ResumeInjector
from app.utils.security_utils import FileUploadValidator, InputSanitizer

logger = logging.getLogger(__name__)

class BatchResumeInjector:
    """Manages batch injection of multiple text files into multiple resume templates."""
    
    def __init__(self):
        self.injector = ResumeInjector()
    
    def validate_injection_compatibility(self, resume_bookmarks: List[str], processed_text: str) -> Tuple[bool, List[str]]:
        """Pre-validate that resume bookmarks are compatible with text content.
        
        Checks if processed text has sections that match bookmark structure.
        Returns: (is_compatible, missing_bookmarks)
        """
        if not resume_bookmarks:
            return False, []
        
        # Extract section headers from processed text (usually start with 'Cycle')
        text_sections = set()
        for line in processed_text.split('\n'):
            line_strip = line.strip()
            if line_strip.startswith('Cycle') or line_strip.startswith('Experience') or line_strip.startswith('Skills'):
                text_sections.add(line_strip.split()[0] if line_strip.split() else "")
        
        # Check if we have at least some content to inject
        if not text_sections:
            return False, []
        
        # Check for critical bookmarks that should exist
        critical_bookmarks = [bm for bm in resume_bookmarks if any(x in bm.lower() for x in ['cycle', 'experience', 'skills', 'project'])]
        
        if not critical_bookmarks:
            return False, ["No suitable injection points (Cycle/Experience/Skills/Project bookmarks) found"]
        
        return True, []
    
    def validate_resume_files(self, resume_files: List[Tuple[str, bytes]]) -> Tuple[bool, str, Dict]:
        """
        Validate uploaded resume files.
        resume_files: List of (filename, file_bytes)
        """
        if not resume_files:
            return False, "No resume files uploaded", {}
        
        if len(resume_files) > 20:
            return False, "Maximum 20 resume files allowed", {}
        
        resume_data = {}
        for filename, content in resume_files:
            try:
                # Security checks
                is_valid, error_msg = FileUploadValidator.validate_resume_upload(len(content), filename)
                if not is_valid:
                    return False, f"❌ {filename}: {error_msg}", {}
                
                is_valid, sanitized_filename = InputSanitizer.validate_filename(Path(filename).stem)
                if not is_valid:
                    return False, f"❌ Invalid filename: {sanitized_filename}", {}
                
                resume_bytes = io.BytesIO(content)
                resume_bytes.seek(0)
                
                # Detect bookmarks
                from app.services.bookmark_manager import BookmarkManager
                bm_manager = BookmarkManager()
                bookmarks = bm_manager.detect_bookmarks(resume_bytes)
                
                if not bookmarks:
                    return False, f"❌ {filename}: No bookmarks found", {}
                
                resume_data[sanitized_filename] = {
                    'bytes': resume_bytes,
                    'bookmarks': bookmarks,
                    'original_name': filename
                }
            except Exception as e:
                return False, f"❌ {filename}: {str(e)}", {}
        
        return True, "", resume_data
    
    def validate_text_files(self, text_files: List[Tuple[str, bytes]]) -> Tuple[bool, str, Dict]:
        """
        Validate uploaded text files.
        text_files: List of (filename, file_bytes)
        """
        if not text_files:
            return False, "No text files uploaded", {}
        
        if len(text_files) > 20:
            return False, "Maximum 20 text files allowed", {}
        
        text_data = {}
        for filename, content in text_files:
            try:
                is_valid, error_msg = FileUploadValidator.validate_text_upload(len(content), filename)
                if not is_valid:
                    return False, f"❌ {filename}: {error_msg}", {}
                
                is_valid, sanitized_filename = InputSanitizer.validate_filename(Path(filename).stem)
                if not is_valid:
                    return False, f"❌ Invalid filename: {sanitized_filename}", {}
                
                try:
                    text_content = content.decode('utf-8')
                except UnicodeDecodeError:
                    try:
                        text_content = content.decode('latin-1')
                    except UnicodeDecodeError:
                        text_content = content.decode('utf-8', errors='replace')
                
                text_data[sanitized_filename] = {
                    'content': text_content,
                    'original_name': filename
                }
            except Exception as e:
                sanitized_error = InputSanitizer.sanitize_error_message(e, user_facing=True)
                return False, f"❌ {filename}: {sanitized_error}", {}
        
        return True, "", text_data
    
    def inject_batch(
        self,
        text_data: Dict,
        resume_data: Dict,
        mapping: Dict[str, str]
    ) -> Tuple[Dict, List[str]]:
        """
        Perform batch injection with pre-validation of compatibility.
        mapping: Dict with {text_filename: resume_filename}
        """
        results = {}
        errors = []
        
        for text_name, resume_name in mapping.items():
            try:
                if text_name not in text_data:
                    errors.append(f"⚠️ Text file '{text_name}' not found in uploaded files")
                    continue
                
                if resume_name not in resume_data:
                    errors.append(f"⚠️ Resume file '{resume_name}' not found in uploaded files")
                    continue
                
                text_content = text_data[text_name]['content']
                resume_bytes = resume_data[resume_name]['bytes']
                resume_bytes.seek(0)
                
                # Pre-validate bookmark compatibility
                resume_bookmarks = resume_data[resume_name].get('bookmarks', [])
                is_compatible, missing = self.validate_injection_compatibility(resume_bookmarks, text_content)
                
                if not is_compatible:
                    error_detail = f"Bookmark compatibility check failed. {missing[0] if missing else 'No compatible bookmarks found'}"
                    errors.append(f"⚠️ {text_name} → {resume_name}: {error_detail}")
                    logger.warning(f"Skipping injection due to incompatibility: {error_detail}")
                    continue
                
                injected_resume, injection_summary = self.injector.inject_points_into_resume(
                    resume_bytes,
                    text_content,
                    custom_mapping=None
                )
                
                text_orig = Path(text_data[text_name]['original_name']).stem
                resume_orig = Path(resume_data[resume_name]['original_name']).stem
                output_name = f"{resume_orig}_with_{text_orig}_injected.docx"
                
                pair_key = f"{text_name} → {resume_name}"
                results[pair_key] = (
                    injected_resume.getvalue(),
                    injection_summary,
                    output_name
                )
            except ValueError as e:
                errors.append(f"❌ {text_name} → {resume_name}: Format error - {str(e)}")
            except Exception as e:
                errors.append(f"❌ {text_name} → {resume_name}: {type(e).__name__} - {str(e)}")
        
        return results, errors
    
    def generate_summary(self, results: Dict, errors: List) -> Dict:
        summary = {
            'total_pairs': len(results) + len(errors),
            'successful': len(results),
            'failed': len(errors),
            'injection_details': {}
        }
        for pair_name, (_, injection_data, _) in results.items():
            summary['injection_details'][pair_name] = len(injection_data)
        return summary
