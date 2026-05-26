#!/usr/bin/env python3
"""Test script to verify bookmark recovery logic (Unicode-safe and set-comparison valid)."""

import io
import sys
from pathlib import Path
from docx import Document

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.bookmark_manager import BookmarkManager
from app.services.resume_catalog import ResumeCatalog

def create_bookmarkless_document(original_path) -> io.BytesIO:
    """Load docx, remove all bookmarks XML elements, and return in-memory file."""
    doc = Document(original_path)
    
    # Track element removal
    bookmark_starts = []
    bookmark_ends = []
    
    for element in doc.element.iter():
        if 'bookmarkStart' in element.tag:
            bookmark_starts.append(element)
        elif 'bookmarkEnd' in element.tag:
            bookmark_ends.append(element)
            
    for el in bookmark_starts:
        el.getparent().remove(el)
    for el in bookmark_ends:
        el.getparent().remove(el)
        
    out = io.BytesIO()
    doc.save(out)
    out.seek(0)
    return out

def run_test():
    print("=" * 65)
    print("Testing Auto-Bookmark Recovery Logic")
    print("=" * 65)
    
    catalog = ResumeCatalog()
    bm_manager = BookmarkManager()
    
    # 1. Get a template file with bookmarks
    resumes = catalog.list_resumes()
    if not resumes:
        print("[ERROR] No resumes registered in catalog.")
        return
        
    ref_name = resumes[0]['name']
    ref_path = catalog.get_local_resume_path(ref_name)
    print(f"Using reference resume: {ref_name} ({ref_path})")
    
    # Verify it has bookmarks
    orig_bookmarks = bm_manager.detect_bookmarks(ref_path)
    print(f"Original bookmarks in reference: {orig_bookmarks}")
    if not orig_bookmarks:
        print("[ERROR] Reference resume has no bookmarks.")
        return
        
    # 2. Create a copy of the document without any bookmarks
    print("\nDynamically stripping bookmarks to create test target...")
    bookmarkless_io = create_bookmarkless_document(ref_path)
    
    # Verify it now has no bookmarks
    cleared_bookmarks = bm_manager.detect_bookmarks(bookmarkless_io)
    print(f"Bookmarks after stripping: {cleared_bookmarks}")
    if cleared_bookmarks:
        print("[ERROR] Failed to strip bookmarks completely.")
        return
    print("[SUCCESS] Target document successfully prepared (0 bookmarks).")
    
    # 3. Perform bookmark recovery
    print("\nRunning ensure_bookmarks_from_reference on the bookmarkless document...")
    bookmarkless_io.seek(0)
    recovered_io, recovered_bookmarks, metadata = bm_manager.ensure_bookmarks_from_reference(bookmarkless_io)
    
    # 4. Assertions and metadata print
    print("\nResult Metadata:")
    for k, v in metadata.items():
        if k == 'matches':
            print("  matches:")
            for item in v:
                print(f"    - {item}")
        else:
            print(f"  {k}: {v}")
            
    print(f"\nRecovered bookmarks (input order): {recovered_bookmarks}")
    
    # Check if recovery worked
    if metadata.get("auto_created") is True and len(recovered_bookmarks) > 0:
        print("[SUCCESS] Bookmarks successfully recovered and injected!")
        
        # Verify the XML output has the bookmarks
        double_check = bm_manager.detect_bookmarks(recovered_io)
        print(f"Double-check detection on recovered file: {double_check}")
        # Note: XML ordering might differ based on document structure, so we compare as sets
        if set(double_check) == set(recovered_bookmarks):
            print("[SUCCESS] Double-check verification passed.")
        else:
            print("[ERROR] Double-check verification failed.")
    else:
        print("[ERROR] Bookmarks could not be recovered.")

if __name__ == "__main__":
    run_test()
