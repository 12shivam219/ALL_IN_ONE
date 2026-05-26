#!/usr/bin/env python3
"""E2E test to verify point injection on bookmarkless resumes."""

import io
import sys
from pathlib import Path
from docx import Document

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.resume_injector import ResumeInjector
from app.services.resume_catalog import ResumeCatalog
from test_bookmark_recovery_unit import create_bookmarkless_document

def run_e2e_test():
    print("=" * 65)
    print("E2E Testing Point Injection on Bookmarkless Resume")
    print("=" * 65)
    
    catalog = ResumeCatalog()
    injector = ResumeInjector()
    
    resumes = catalog.list_resumes()
    if not resumes:
        print("[ERROR] No resumes in catalog.")
        return
        
    ref_name = resumes[0]['name']
    ref_path = catalog.get_local_resume_path(ref_name)
    print(f"Using template resume: {ref_name}")
    
    # 1. Create a bookmarkless document in memory
    bookmarkless_io = create_bookmarkless_document(ref_path)
    
    # 2. Define mock processed points organized by cycle
    mock_processed_text = (
        "Cycle 1:\n"
        "- Did some Java programming for Harland.\n\n"
        "Cycle 2:\n"
        "- Built a React UI for CVS.\n\n"
        "Cycle 3:\n"
        "- Developed spring boot APIs for KPMG.\n\n"
        "Cycle 4:\n"
        "- Programmed databases for First Citizen.\n"
    )
    
    # Custom mapping to map cycles to bookmarks:
    # 1 -> Harland_Responsibilities
    # 2 -> CVS_Responsibilities
    # 3 -> KPMG_Responsibilities
    # 4 -> First_Citizen_Responsibilities
    custom_mapping = {
        1: "Harland_Responsibilities",
        2: "CVS_Responsibilities",
        3: "KPMG_Responsibilities",
        4: "First_Citizen_Responsibilities"
    }
    
    print("\nTriggering inject_points_into_resume on bookmarkless template...")
    try:
        updated_doc_io, injections = injector.inject_points_into_resume(
            resume_bytes=bookmarkless_io,
            processed_text=mock_processed_text,
            custom_mapping=custom_mapping,
            unused_handling="keep"
        )
        print("[SUCCESS] Injection completed successfully!")
        print(f"Injections summary: {injections}")
        
        # Verify the content of the injected document
        updated_doc = Document(updated_doc_io)
        all_text = "\n".join([p.text for p in updated_doc.paragraphs])
        
        print("\nVerifying injected texts:")
        expected_points = [
            "Did some Java programming for Harland.",
            "Built a React UI for CVS.",
            "Developed spring boot APIs for KPMG.",
            "Programmed databases for First Citizen."
        ]
        
        verified = True
        for point in expected_points:
            if point in all_text:
                print(f"  [PASS] Found: '{point}'")
            else:
                print(f"  [FAIL] Missing: '{point}'")
                verified = False
                
        if verified:
            print("\n[SUCCESS] E2E Integration Verification Passed!")
        else:
            print("\n[ERROR] E2E Integration Verification Failed.")
            
    except Exception as e:
        print(f"\n[ERROR] Injection failed with exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_e2e_test()
