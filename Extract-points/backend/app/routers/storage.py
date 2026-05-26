from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import StreamingResponse
from typing import Optional
from app.services.cloud_storage_manager import get_cloud_storage_manager
import io

router = APIRouter(prefix="/storage", tags=["Cloud Storage Integrations"])

@router.post("/list")
def list_cloud_files(provider: str = Form("onedrive"), folder: str = Form("Resumes")):
    """Retrieves file details from selected OneDrive, Google Drive, or Dropbox folders"""
    try:
        storage = get_cloud_storage_manager(provider)
        files = storage.list_files(folder)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/download")
def download_cloud_file(
    provider: str = Form("onedrive"), 
    file_id_or_path: str = Form(...)
):
    """Streams a file from cloud storage back to the web browser"""
    try:
        storage = get_cloud_storage_manager(provider)
        file_io = storage.download_file(file_id_or_path)
        
        if not file_io or len(file_io.getvalue()) == 0:
            raise HTTPException(status_code=404, detail="File content could not be retrieved")
            
        filename = file_id_or_path.split("/")[-1].split("\\")[-1]
        return StreamingResponse(
            file_io,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
