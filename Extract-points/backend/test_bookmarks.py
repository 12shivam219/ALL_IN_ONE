#!/usr/bin/env python3
"""Test script to verify bookmark detection in resume files."""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.bookmark_manager import BookmarkManager
from app.services.resume_catalog import ResumeCatalog

def test_bookmark_detection():
    """Test that bookmarks can be detected in resume files."""
    print("=" * 60)
    print("Testing Bookmark Detection")
    print("=" * 60)
    
    catalog = ResumeCatalog()
    bm_manager = BookmarkManager()
    
    resumes = catalog.list_resumes()
    
    for resume in resumes:
        print(f"\n📄 Testing: {resume['name']}")
        
        # Get file path
        resolved_path = catalog.get_local_resume_path(resume['name'])
        if not resolved_path or not resolved_path.exists():
            print(f"   ❌ File not found: {resolved_path}")
            continue
        
        print(f"   📂 File: {resolved_path}")
        
        try:
            # Detect bookmarks
            bookmarks = bm_manager.detect_bookmarks(resolved_path)
            print(f"   🔖 Bookmarks found: {len(bookmarks)}")
            
            if bookmarks:
                for bm in bookmarks:
                    print(f"      - {bm}")
                print(f"   ✅ SUCCESS")
            else:
                print(f"   ⚠️  No bookmarks found (this may be okay if resume uses different structure)")
        except Exception as e:
            print(f"   ❌ Error detecting bookmarks: {e}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    test_bookmark_detection()
