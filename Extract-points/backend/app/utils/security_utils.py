import re
from pathlib import Path
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class InputSanitizer:
    MAX_FILE_SIZE_RESUME = 10 * 1024 * 1024  # 10 MB
    MAX_FILE_SIZE_TEXT = 5 * 1024 * 1024     # 5 MB
    MAX_FILENAME_LENGTH = 255
    DANGEROUS_CHARS = r'[<>:"|?*\x00]'
    
    @staticmethod
    def validate_filename(filename: str, max_length: int = 255) -> Tuple[bool, str]:
        if not filename or not filename.strip():
            return False, "Filename cannot be empty"
        
        if len(filename) > max_length:
            return False, f"Filename too long (max {max_length} characters)"
        
        sanitized = re.sub(InputSanitizer.DANGEROUS_CHARS, '', filename)
        sanitized = sanitized.replace('..', '').replace('//', '')
        
        if '/' in sanitized or '\\' in sanitized or sanitized.startswith('.'):
            return False, "Filename contains invalid path characters"
        
        if not sanitized:
            return False, "Filename contains only invalid characters"
        
        return True, sanitized
    
    @staticmethod
    def validate_file_size(file_size: int, file_type: str = 'text') -> Tuple[bool, str]:
        max_size = InputSanitizer.MAX_FILE_SIZE_RESUME if file_type == 'resume' else InputSanitizer.MAX_FILE_SIZE_TEXT
        if file_size > max_size:
            max_mb = max_size / (1024 * 1024)
            return False, f"File too large. Maximum: {max_mb:.1f} MB"
        if file_size == 0:
            return False, "File is empty"
        return True, ""
    
    @staticmethod
    def sanitize_error_message(error: Exception, user_facing: bool = True) -> str:
        error_str = str(error)
        if user_facing:
            sensitive_patterns = [
                r'password', r'api[_-]?key', r'token', r'secret',
                r'database[_-]?url', r'credentials', r'/Users/', r'C:\\', r'@'
            ]
            for pattern in sensitive_patterns:
                if re.search(pattern, error_str, re.IGNORECASE):
                    return "An error occurred. Please check your input and try again."
        return error_str

class FileUploadValidator:
    ALLOWED_RESUME_TYPES = {'.docx'}
    ALLOWED_TEXT_TYPES = {'.txt'}
    
    @staticmethod
    def validate_resume_upload(file_size: int, filename: str) -> Tuple[bool, str]:
        is_valid, msg = InputSanitizer.validate_filename(filename)
        if not is_valid:
            return False, f"Invalid filename: {msg}"
        
        file_ext = Path(filename).suffix.lower()
        if file_ext not in FileUploadValidator.ALLOWED_RESUME_TYPES:
            return False, "Only .docx files allowed for resumes"
        
        is_valid, msg = InputSanitizer.validate_file_size(file_size, file_type='resume')
        if not is_valid:
            return False, msg
        
        return True, ""
    
    @staticmethod
    def validate_text_upload(file_size: int, filename: str) -> Tuple[bool, str]:
        is_valid, msg = InputSanitizer.validate_filename(filename)
        if not is_valid:
            return False, f"Invalid filename: {msg}"
        
        file_ext = Path(filename).suffix.lower()
        if file_ext not in FileUploadValidator.ALLOWED_TEXT_TYPES:
            return False, "Only .txt files allowed for text"
        
        is_valid, msg = InputSanitizer.validate_file_size(file_size, file_type='text')
        if not is_valid:
            return False, msg
        
        return True, ""
