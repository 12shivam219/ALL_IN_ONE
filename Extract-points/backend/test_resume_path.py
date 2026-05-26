#!/usr/bin/env python3
"""Test script to verify resume file path resolution."""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings
from app.services.resume_catalog import ResumeCatalog

def test_path_resolution():
    """Test that resume paths resolve correctly."""
    print("=" * 60)
    print("Testing Resume Path Resolution")
    print("=" * 60)
    
    # Check BASE_DIR
    print(f"\n1. BASE_DIR: {settings.BASE_DIR}")
    print(f"   BASE_DIR exists: {settings.BASE_DIR.exists()}")
    
    # Check LOCAL_RESUMES_FOLDER
    print(f"\n2. LOCAL_RESUMES_FOLDER: {settings.LOCAL_RESUMES_FOLDER}")
    print(f"   LOCAL_RESUMES_FOLDER exists: {settings.LOCAL_RESUMES_FOLDER.exists()}")
    
    # List files in folder
    if settings.LOCAL_RESUMES_FOLDER.exists():
        files = list(settings.LOCAL_RESUMES_FOLDER.glob("*.docx"))
        print(f"   Files found: {len(files)}")
        for f in files:
            print(f"     - {f.name} (size: {f.stat().st_size} bytes)")
    
    # Test catalog loading
    print(f"\n3. Loading Resume Catalog...")
    catalog = ResumeCatalog()
    resumes = catalog.list_resumes()
    print(f"   Catalog entries: {len(resumes)}")
    
    for resume in resumes:
        print(f"\n   Resume: {resume['name']}")
        print(f"     - Person: {resume.get('person_name')}")
        print(f"     - Technologies: {resume.get('technologies')}")
        print(f"     - Catalog path: {resume.get('path')}")
        
        # Try to resolve path
        resolved_path = catalog.get_local_resume_path(resume['name'])
        print(f"     - Resolved path: {resolved_path}")
        print(f"     - File exists: {resolved_path.exists() if resolved_path else False}")
        
        if resolved_path and resolved_path.exists():
            print(f"     - File size: {resolved_path.stat().st_size} bytes")
            print(f"     ✅ SUCCESS")
        else:
            print(f"     ❌ FAILED - File not found!")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    test_path_resolution()
