from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from typing import List, Optional
import io
import zipfile
from app.schemas.processor import TextProcessRequest, TextProcessResponse
from app.services.text_processor import TextProcessor
from app.services.export_handler import ExportHandler
from app.services.batch_processor import BatchProcessor
from app.services.deduplicator import PointDeduplicator
from app.utils.security_utils import FileUploadValidator

router = APIRouter(prefix="/processor", tags=["Text Processing"])

@router.post("/process-text", response_model=TextProcessResponse)
def process_text_endpoint(payload: TextProcessRequest):
    """Processes structured text using cycle-based extraction and optional deduplication"""
    try:
        processor = TextProcessor()
        processed = processor.process_text(payload.text, payload.points_per_cycle)
        
        stats = None
        if payload.deduplication_enabled:
            # Apply deduplication logic exactly as in original Streamlit
            lines = processed.split('\n')
            dedup_lines = []
            current_section_points = []
            original_points_count = 0
            
            for line in lines:
                if line.strip().startswith('Cycle'):
                    if current_section_points:
                        original_points_count += len(current_section_points)
                        dedup_points = PointDeduplicator.deduplicate_points_exact(current_section_points)
                        dedup_lines.extend(dedup_points)
                        current_section_points = []
                    dedup_lines.append(line)
                elif line.strip() and not line.strip().startswith(('Cycle', '=')):
                    current_section_points.append(line)
                else:
                    if current_section_points:
                        original_points_count += len(current_section_points)
                        dedup_points = PointDeduplicator.deduplicate_points_exact(current_section_points)
                        dedup_lines.extend(dedup_points)
                        current_section_points = []
                    if line.strip():
                        dedup_lines.append(line)
            
            if current_section_points:
                original_points_count += len(current_section_points)
                dedup_points = PointDeduplicator.deduplicate_points_exact(current_section_points)
                dedup_lines.extend(dedup_points)
            
            processed = '\n'.join(dedup_lines)
            deduplicated_count = len([l for l in dedup_lines if l.strip() and not l.strip().startswith(('Cycle', '='))])
            stats = {
                "original_count": original_points_count,
                "deduplicated_count": deduplicated_count,
                "removed_count": original_points_count - deduplicated_count
            }

        return TextProcessResponse(processed_text=processed, stats=stats)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.post("/export-docx")
def export_docx_endpoint(text: str = Form(...), filename: str = Form("processed_text.docx")):
    """Generates and streams a Word (.docx) document from the input text"""
    try:
        handler = ExportHandler()
        docx_file = handler.generate_docx(text)
        return StreamingResponse(
            docx_file,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export-pdf")
def export_pdf_endpoint(text: str = Form(...), filename: str = Form("processed_text.pdf")):
    """Generates and streams a PDF (.pdf) document from the input text"""
    try:
        handler = ExportHandler()
        pdf_file = handler.generate_pdf(text)
        return StreamingResponse(
            pdf_file,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-process")
async def batch_process_endpoint(
    files: List[UploadFile] = File(...),
    points_per_cycle: int = Form(2),
    deduplication_enabled: bool = Form(False)
):
    """Processes multiple uploaded files in parallel, returning processed texts and document formats"""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    files_list = []
    for file in files:
        # Validate file size & extension
        content = await file.read()
        is_valid, err = FileUploadValidator.validate_text_upload(len(content), file.filename)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"File {file.filename} invalid: {err}")
        
        files_list.append((file.filename, content))
        
    try:
        batch_processor = BatchProcessor()
        results = batch_processor.process_files(
            files_list, 
            points_per_cycle, 
            dedup_enabled=deduplication_enabled
        )
        
        # Structure payload response
        serialized_results = []
        for result in results:
            for fname, (text, _, _) in result.items():
                serialized_results.append({
                    "filename": fname,
                    "text": text,
                    "is_error": text.startswith("Error")
                })
        return {"results": serialized_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-export-zip")
async def batch_export_zip_endpoint(
    files: List[UploadFile] = File(...),
    points_per_cycle: int = Form(2),
    deduplication_enabled: bool = Form(False)
):
    """Processes uploaded files and bundles all texts, PDFs, and DOCXs in a ZIP file"""
    files_list = []
    for file in files:
        content = await file.read()
        files_list.append((file.filename, content))
        
    try:
        batch_processor = BatchProcessor()
        results = batch_processor.process_files(
            files_list, 
            points_per_cycle, 
            dedup_enabled=deduplication_enabled
        )
        
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
            for result in results:
                for fname, (text, docx_bytes, pdf_bytes) in result.items():
                    if text.startswith("Error") or not docx_bytes or not pdf_bytes:
                        continue
                    zip_file.writestr(f"{fname}.txt", text)
                    zip_file.writestr(f"{fname}.docx", docx_bytes)
                    zip_file.writestr(f"{fname}.pdf", pdf_bytes)
                    
        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=batch_processed_files.zip"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
