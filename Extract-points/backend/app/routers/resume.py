from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
import io
import json
import zipfile
from app.database.connection import get_db
from app.models.profile import BookmarkProfile
from app.models.resume import Resume
from app.schemas.resume import BookmarkDetectResponse, CatalogSummaryResponse, BookmarkProfileResponse, BookmarkProfileCreate
from app.services.resume_catalog import ResumeCatalog
from app.services.resume_injector import ResumeInjector
from app.services.bookmark_manager import BookmarkManager
from app.services.batch_resume_injector import BatchResumeInjector
from app.dependencies.auth import get_optional_current_user
from app.utils.security_utils import FileUploadValidator

router = APIRouter(prefix="/resume", tags=["Resumes & Bookmarks"])

@router.post("/detect-bookmarks", response_model=BookmarkDetectResponse)
async def detect_bookmarks_endpoint(file: UploadFile = File(...)):
    """Uploads a DOCX template and returns a list of its Word bookmark tags"""
    content = await file.read()
    is_valid, err = FileUploadValidator.validate_resume_upload(len(content), file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err)
        
    try:
        bm_manager = BookmarkManager()
        modified_bytes, bookmarks, metadata = bm_manager.ensure_bookmarks_from_reference(io.BytesIO(content))
        return BookmarkDetectResponse(bookmarks=bookmarks, count=len(bookmarks))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read or recover bookmarks: {str(e)}")

@router.post("/inject")
async def inject_points_endpoint(
    file: UploadFile = File(...),
    processed_text: str = Form(...),
    custom_mapping: str = Form(""),  # JSON string of Dict[str, str]
    unused_handling: str = Form("keep")  # keep, repeat, clear
):
    """Injects cycle-extracted points into a Word resume template at specific bookmarks"""
    content = await file.read()
    is_valid, err = FileUploadValidator.validate_resume_upload(len(content), file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err)
        
    try:
        mapping_dict = {}
        if custom_mapping:
            mapping_dict = json.loads(custom_mapping)
            # Convert string keys to int for cycle numbers
            mapping_dict = {int(k): v for k, v in mapping_dict.items()}
            
        injector = ResumeInjector()
        updated_resume, injections = injector.inject_points_into_resume(
            io.BytesIO(content),
            processed_text,
            custom_mapping=mapping_dict,
            unused_handling=unused_handling
        )
        
        # Stream modified DOCX back
        return StreamingResponse(
            updated_resume,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": "attachment; filename=Resume_Updated.docx",
                "X-Injections-Summary": json.dumps(injections)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/catalog", response_model=List[dict])
def list_catalog_resumes(db: Session = Depends(get_db)):
    """Lists registered resumes in the catalog metadata (from database)"""
    catalog = ResumeCatalog(db)
    # Scan folder first to sync
    catalog.auto_scan_local_folder()
    return catalog.list_resumes()

@router.get("/catalog/summary", response_model=CatalogSummaryResponse)
def get_catalog_summary(db: Session = Depends(get_db)):
    """Gets aggregate statistics of the current resume catalog"""
    catalog = ResumeCatalog(db)
    catalog.auto_scan_local_folder()
    return catalog.get_catalog_summary()

@router.post("/catalog/upload")
async def upload_to_catalog(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Uploads a resume file, saves to OSS, and registers in database"""
    content = await file.read()
    is_valid, err = FileUploadValidator.validate_resume_upload(len(content), file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err)
        
    catalog = ResumeCatalog(db)
    
    # Save the file to LOCAL_RESUMES_FOLDER (local caching fallback)
    target_path = catalog.LOCAL_RESUMES_FOLDER / file.filename
    try:
        with open(target_path, 'wb') as f:
            f.write(content)
            
        success, message = catalog.register_resume_from_local(str(target_path))
        if not success:
            raise HTTPException(status_code=400, detail=message)
        return {"message": message, "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/catalog/{name}")
def delete_from_catalog(name: str, db: Session = Depends(get_db)):
    """Deletes a resume from the catalog index and OSS storage"""
    catalog = ResumeCatalog(db)
    success, message = catalog.delete_resume(name)
    if not success:
        raise HTTPException(status_code=404, detail=message)
    return {"message": message}

# Bookmark Profiles Endpoints
@router.get("/profiles", response_model=List[dict])
def list_profiles():
    """Lists saved bookmark mapping profiles"""
    bm_manager = BookmarkManager()
    return bm_manager.list_profiles()

@router.get("/profiles/{name}", response_model=dict)
def get_profile(name: str):
    """Loads a saved bookmark mapping profile including its cycle mapping"""
    bm_manager = BookmarkManager()
    profile = bm_manager.load_profile(name)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Profile '{name}' not found")
    return profile

@router.post("/profiles")
def save_profile(profile: BookmarkProfileCreate):
    """Saves a bookmark mapping profile to disk"""
    bm_manager = BookmarkManager()
    success = bm_manager.save_profile(
        profile.profile_name,
        profile.bookmarks,
        # Convert str keys back to int for service layer
        {int(k): v for k, v in profile.mapping.items()},
        profile.resume_name
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save profile")
    return {"message": f"Profile '{profile.profile_name}' saved successfully"}

@router.delete("/profiles/{name}")
def delete_profile(name: str):
    """Deletes a saved profile"""
    bm_manager = BookmarkManager()
    success = bm_manager.delete_profile(name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Profile '{name}' not found")
    return {"message": f"Profile '{name}' deleted successfully"}

# Batch Inject
@router.post("/batch-inject")
async def batch_inject_endpoint(
    files: List[UploadFile] = File(...),
    texts: List[UploadFile] = File(...),
    mapping: str = Form(...)  # JSON string of Dict[text_filename, resume_filename]
):
    """Injects multiple texts into multiple templates and bundles all output Word files in a ZIP archive"""
    try:
        mapping_dict = json.loads(mapping)
        
        # Read text files
        text_files_list = []
        for tf in texts:
            content = await tf.read()
            text_files_list.append((tf.filename, content))
            
        # Read resume templates
        resume_files_list = []
        for rf in files:
            content = await rf.read()
            resume_files_list.append((rf.filename, content))
            
        batch_injector = BatchResumeInjector()
        
        # Validate files
        valid_res, err, resume_data = batch_injector.validate_resume_files(resume_files_list)
        if not valid_res:
            raise HTTPException(status_code=400, detail=err)
            
        valid_txt, err, text_data = batch_injector.validate_text_files(text_files_list)
        if not valid_txt:
            raise HTTPException(status_code=400, detail=err)
            
        # Execute injection
        results, errors = batch_injector.inject_batch(text_data, resume_data, mapping_dict)
        
        # Create ZIP download
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
            for pair, (file_bytes, _, out_name) in results.items():
                zip_file.writestr(out_name, file_bytes)
                
        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=batch_injected_resumes.zip",
                "X-Errors-Summary": json.dumps(errors)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
