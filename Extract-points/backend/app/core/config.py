import os
from pathlib import Path
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl

class Settings(BaseSettings):
    PROJECT_NAME: str = "Resume Processor SaaS"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "super_secret_key_change_me_in_production_1234567890")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    
    # DB (fallback to SQLite locally for simplified onboarding)
    DATABASE_URL: str = "sqlite:///./resume_processor.db"
    
    # Third Party API Keys
    GROQ_API_KEY: Optional[str] = None
    
    # InsForge Integration
    INSFORGE_API_KEY: Optional[str] = None
    INSFORGE_OSS_HOST: Optional[str] = None
    
    # Storage Config
    # If paths are relative, base them on the workspace root (one level up from backend)
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    LOCAL_RESUMES_FOLDER: Path = BASE_DIR / "resumes"
    UPLOAD_RESUMES_FOLDER: Path = BASE_DIR / "resumes_uploaded"
    AUTOMATION_OUTPUT_FOLDER: Path = BASE_DIR / "automation_output"
    
    # Cloud Storage Integrations
    GOOGLE_DRIVE_FOLDER_ID: Optional[str] = None
    ONEDRIVE_FOLDER_PATH: str = "/Resumes"
    DROPBOX_ACCESS_TOKEN: Optional[str] = None
    GOOGLE_CREDENTIALS_FILE: str = "credentials.json"
    
    # Email SMTP Config
    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    # SendGrid
    SENDGRID_API_KEY: Optional[str] = None
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173", 
        "http://127.0.0.1:5173", 
        "http://localhost:5174", 
        "http://127.0.0.1:5174", 
        "http://localhost:5175", 
        "http://127.0.0.1:5175", 
        "http://localhost:3000"
    ]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()

# Ensure folders exist
settings.LOCAL_RESUMES_FOLDER.mkdir(parents=True, exist_ok=True)
settings.UPLOAD_RESUMES_FOLDER.mkdir(parents=True, exist_ok=True)
settings.AUTOMATION_OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)
