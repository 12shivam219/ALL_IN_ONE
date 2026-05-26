from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.database.connection import get_db
from app.models.job_application import JobApplication
from app.schemas.email import EmailSendRequest, EmailHistoryResponse
from app.services.email_sender import get_email_sender
from app.services.cloud_storage_manager import get_cloud_storage_manager
from app.services.resume_catalog import ResumeCatalog
from app.dependencies.auth import get_optional_current_user
import io

router = APIRouter(prefix="/email", tags=["Email Campaigns"])

# Global in-memory list for fallback/session tracking
in_memory_email_history = []

def send_email_in_background(
    request_data: EmailSendRequest,
    db_app_id: Optional[int] = None,
    db_session: Optional[Session] = None
):
    """Background task to fetch attachment and dispatch email"""
    recipient_emails = request_data.recipients
    success_count = 0
    failed_recipients = []
    
    try:
        # 1. Download file from cloud storage
        storage = get_cloud_storage_manager(request_data.cloud_provider)
        
        # In cloud list, path is stored in 'path' or ID is stored in 'id'
        # Let's resolve the path/id. OneDrive uses 'path', Google uses 'id', Dropbox uses 'path'
        # We can look up in local catalog first or download directly
        catalog = ResumeCatalog(db_session)
        
        file_content = None
        try:
            file_content = catalog.get_resume_bytes(request_data.resume_name)
        except Exception:
            pass
        
        if not file_content:
            # Fallback: attempt to query storage path directly if passed as filename
            # This is common in tab 6
            files = storage.list_files()
            selected = None
            for f in files:
                if f['name'] == request_data.resume_name:
                    selected = f
                    break
            
            if selected:
                file_content = storage.download_file(selected.get('id') or selected.get('path'))
                
        if not file_content:
            logger_err = f"Failed to download resume file: {request_data.resume_name}"
            # Update DB status to failed
            _update_db_status(db_app_id, "failed", db_session)
            return
            
        # 2. Get email sender
        sender = get_email_sender(request_data.email_provider, **request_data.config)
        if not sender:
            # Update DB status to failed
            _update_db_status(db_app_id, "failed", db_session)
            return
            
        # 3. Send email to each recipient
        for recipient in recipient_emails:
            # Reset BytesIO pointer for each attachment dispatch
            file_content.seek(0)
            attachments = [(request_data.resume_name, file_content)]
            
            success = sender.send_email(
                recipient=recipient,
                subject=request_data.subject,
                body=request_data.body,
                attachments=attachments
            )
            
            log_item = {
                "recipient": recipient,
                "resume": request_data.resume_name,
                "timestamp": datetime.utcnow(),
                "status": "Success" if success else "Failed"
            }
            in_memory_email_history.append(log_item)
            
            if success:
                success_count += 1
            else:
                failed_recipients.append(recipient)
                
        # 4. Update status in db
        final_status = "email_sent" if success_count == len(recipient_emails) else "partial_success" if success_count > 0 else "failed"
        _update_db_status(db_app_id, final_status, db_session)
        
    except Exception as e:
        _update_db_status(db_app_id, f"failed: {str(e)}", db_session)

def _update_db_status(app_id: Optional[int], status: str, db: Optional[Session]):
    if app_id and db:
        try:
            job_app = db.query(JobApplication).filter(JobApplication.id == app_id).first()
            if job_app:
                job_app.status = status
                db.commit()
        except Exception:
            pass

@router.post("/send")
def send_email_endpoint(
    payload: EmailSendRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_optional_current_user)
):
    """Dispatches resumes asynchronously to lists of recruiters via selected cloud and email configs"""
    user_id = current_user.id if current_user else None
    
    # Pre-record a job application record in database to log the operation
    job_app = JobApplication(
        user_id=user_id,
        job_title=payload.subject,
        job_description=payload.body,
        recruiter_email=", ".join(payload.recipients),
        status="sending",
    )
    db.add(job_app)
    db.commit()
    db.refresh(job_app)
    
    # Spawn background task
    background_tasks.add_task(
        send_email_in_background,
        payload,
        job_app.id,
        db
    )
    
    return {"message": "Email dispatch started in background", "job_application_id": job_app.id}

@router.get("/history", response_model=List[EmailHistoryResponse])
def get_email_history(db: Session = Depends(get_db), current_user: Any = Depends(get_optional_current_user)):
    """Retrieves list of previous email campaigns and delivery status"""
    # Fetch from SQL DB first if user is authenticated
    if current_user:
        apps = db.query(JobApplication).filter(
            JobApplication.user_id == current_user.id,
            JobApplication.status.in_(["email_sent", "sending", "failed", "partial_success"])
        ).order_by(JobApplication.created_at.desc()).all()
        
        db_history = []
        for app in apps:
            emails = [e.strip() for e in app.recruiter_email.split(",") if e.strip()]
            for email in emails:
                db_history.append(EmailHistoryResponse(
                    recipient=email,
                    resume=app.job_title,  # Using title as resume identifier
                    timestamp=app.created_at,
                    status="Success" if app.status == "email_sent" else "Sending" if app.status == "sending" else "Failed"
                ))
        return db_history
        
    # Return in-memory logs for guest sessions
    # Convert dates to ISO for response model serialization
    serialized = []
    for log in in_memory_email_history:
        serialized.append(EmailHistoryResponse(
            recipient=log["recipient"],
            resume=log["resume"],
            timestamp=log["timestamp"],
            status=log["status"]
        ))
    return serialized

@router.delete("/history")
def clear_email_history(db: Session = Depends(get_db), current_user: Any = Depends(get_optional_current_user)):
    """Clears history logs"""
    global in_memory_email_history
    in_memory_email_history = []
    
    if current_user:
        db.query(JobApplication).filter(
            JobApplication.user_id == current_user.id
        ).delete()
        db.commit()
        
    return {"message": "Email history logs cleared"}
