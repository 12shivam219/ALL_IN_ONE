from fastapi import APIRouter, HTTPException, Depends, Form, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import json
import os
from pathlib import Path
from app.services.automation_workflow import AutomationWorkflow
from app.core.config import settings

router = APIRouter(prefix="/automation", tags=["Resume Automation Workflow"])

def _format_workflow_logs(workflow_log: list) -> list:
    """Convert structured log objects to formatted strings for frontend rendering."""
    formatted_logs = []
    for log_entry in workflow_log:
        if isinstance(log_entry, dict):
            step = log_entry.get('step', 'Unknown')
            status = log_entry.get('status', '?')
            details = log_entry.get('details', '')
            # Format: "[STEP] STATUS: details"
            formatted = f"[{step}] {status}: {details}" if details else f"[{step}] {status}"
            formatted_logs.append(formatted)
        else:
            # Already a string
            formatted_logs.append(str(log_entry))
    return formatted_logs

def _parse_tech_stacks(raw_tech_stacks: str) -> Optional[list]:
    """Parse reviewed tech stacks from JSON array or comma-separated text."""
    if not raw_tech_stacks:
        return None

    try:
        parsed = json.loads(raw_tech_stacks)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass

    return [tech.strip() for tech in raw_tech_stacks.split(",") if tech.strip()]

def _initialize_email_if_needed(workflow: AutomationWorkflow, email_provider: str, email_config: str):
    if email_provider == "none":
        return

    try:
        if email_provider == "sendgrid" and email_config:
            config_dict = json.loads(email_config)
        else:
            config_dict = {}

        success, msg = workflow.initialize_custom_email(email_provider, **config_dict)
        if not success:
            raise HTTPException(status_code=400, detail=msg)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid email configuration JSON payload")

@router.post("/prepare")
def prepare_automation_endpoint(
    job_title: str = Form(...),
    job_description: str = Form(...),
    points_per_tech: int = Form(3),
    recruiter_email: str = Form(...),
    personal_message: str = Form(""),
    override_resume: Optional[str] = Form(None)
):
    """Validates input, extracts tech stacks, and returns them for user review."""
    workflow = AutomationWorkflow()
    success, result = workflow.prepare_workflow(
        job_description=job_description,
        job_title=job_title,
        points_per_tech=points_per_tech,
        recruiter_email=recruiter_email,
        personal_message=personal_message,
        override_resume=override_resume
    )

    response_data = {
        "success": success,
        "selected_resume": result.get("selected_resume"),
        "match_score": result.get("match_score", 0),
        "tech_stacks": result.get("tech_stacks", []),
        "logs": _format_workflow_logs(workflow.workflow_log),
        "errors": result.get("errors", [])
    }

    if not success:
        error_msg = result.get("errors", ["Automation preparation failed"])[0] if result.get("errors") else "Automation preparation failed"
        raise HTTPException(status_code=500, detail=error_msg)

    return response_data

@router.post("/generate-points")
def generate_points_for_review_endpoint(
    job_title: str = Form(...),
    job_description: str = Form(...),
    points_per_tech: int = Form(3),
    recruiter_email: str = Form(...),
    personal_message: str = Form(""),
    override_resume: Optional[str] = Form(None),
    tech_stacks: str = Form(""),
    points_per_cycle: int = Form(1)
):
    """Generates points and cycle text, returning both for user review before injection."""
    workflow = AutomationWorkflow()
    reviewed_tech_stacks = _parse_tech_stacks(tech_stacks)
    success, result = workflow.generate_points_for_review(
        job_description=job_description,
        job_title=job_title,
        points_per_tech=points_per_tech,
        recruiter_email=recruiter_email,
        personal_message=personal_message,
        override_resume=override_resume,
        reviewed_tech_stacks=reviewed_tech_stacks,
        points_per_cycle=points_per_cycle
    )

    response_data = {
        "success": success,
        "selected_resume": result.get("selected_resume"),
        "match_score": result.get("match_score", 0),
        "tech_stacks": result.get("tech_stacks", []),
        "generated_text": result.get("generated_text", ""),
        "processed_points": result.get("processed_points", ""),
        "logs": _format_workflow_logs(workflow.workflow_log),
        "errors": result.get("errors", [])
    }

    if not success:
        error_msg = result.get("errors", ["Point generation failed"])[0] if result.get("errors") else "Point generation failed"
        raise HTTPException(status_code=500, detail=error_msg)

    return response_data

@router.post("/finalize")
def finalize_reviewed_automation_endpoint(
    job_title: str = Form(...),
    job_description: str = Form(...),
    points_per_tech: int = Form(3),
    recruiter_email: str = Form(...),
    processed_points: str = Form(...),
    personal_message: str = Form(""),
    override_resume: Optional[str] = Form(None),
    email_provider: str = Form("none"),
    email_config: str = Form(""),
    tech_stacks: str = Form("")
):
    """Injects the user-reviewed cycle text and optionally sends email."""
    workflow = AutomationWorkflow()
    _initialize_email_if_needed(workflow, email_provider, email_config)
    reviewed_tech_stacks = _parse_tech_stacks(tech_stacks)
    success, result = workflow.finalize_reviewed_workflow(
        job_description=job_description,
        job_title=job_title,
        points_per_tech=points_per_tech,
        recruiter_email=recruiter_email,
        processed_points=processed_points,
        personal_message=personal_message,
        override_resume=override_resume,
        reviewed_tech_stacks=reviewed_tech_stacks
    )

    response_data = {
        "success": success,
        "selected_resume": result.get("selected_resume"),
        "match_score": result.get("match_score", 0),
        "email_sent": result.get("email_sent", False),
        "resume_file_path": result.get("resume_file_path"),
        "tech_stacks": result.get("tech_stacks", []),
        "log_file": result.get("log_file"),
        "logs": _format_workflow_logs(workflow.workflow_log),
        "errors": result.get("errors", [])
    }

    if not success:
        error_msg = result.get("errors", ["Automation finalization failed"])[0] if result.get("errors") else "Automation finalization failed"
        raise HTTPException(status_code=500, detail=error_msg)

    return response_data

@router.post("/run")
def run_automation_endpoint(
    job_title: str = Form(...),
    job_description: str = Form(...),
    points_per_tech: int = Form(3),
    recruiter_email: str = Form(...),
    personal_message: str = Form(""),
    override_resume: Optional[str] = Form(None),
    email_provider: str = Form("none"),  # gmail, outlook, sendgrid, none
    email_config: str = Form(""),         # JSON string of config credentials
    tech_stacks: str = Form(""),          # JSON array or comma-separated reviewed tech list
    points_per_cycle: int = Form(1)
):
    """Executes the one-click resume automation pipeline: Match -> AI Generate -> Inject -> Send"""
    workflow = AutomationWorkflow()
    
    _initialize_email_if_needed(workflow, email_provider, email_config)
            
    reviewed_tech_stacks = _parse_tech_stacks(tech_stacks)

    # 2. Run workflow
    success, result = workflow.run_workflow(
        job_description=job_description,
        job_title=job_title,
        points_per_tech=points_per_tech,
        recruiter_email=recruiter_email,
        personal_message=personal_message,
        override_resume=override_resume,
        reviewed_tech_stacks=reviewed_tech_stacks,
        points_per_cycle=points_per_cycle
    )
    
    # Format workflow logs to strings for frontend rendering
    formatted_logs = _format_workflow_logs(workflow.workflow_log)
    
    # Structure output response
    response_data = {
        "success": success,
        "selected_resume": result.get("selected_resume"),
        "match_score": result.get("match_score", 0),
        "email_sent": result.get("email_sent", False),
        "resume_file_path": result.get("resume_file_path"),
        "tech_stacks": result.get("tech_stacks", []),
        "log_file": result.get("log_file"),
        "logs": formatted_logs,
        "errors": result.get("errors", [])
    }
    
    if not success:
        # Return error response with proper message string
        error_msg = result.get("errors", ["Unknown error"])[0] if result.get("errors") else "Automation execution failed"
        raise HTTPException(
            status_code=500, 
            detail=error_msg
        )
        
    return response_data

@router.get("/download")
def download_automated_file(filepath: str):
    """Downloads the generated resume from the automation output directory"""
    try:
        # Prevent path traversal attacks
        resolved_path = Path(filepath).resolve()
        allowed_base = Path(settings.AUTOMATION_OUTPUT_FOLDER).resolve()
        
        # Verify filepath resides inside automation output directory
        try:
            resolved_path.relative_to(allowed_base)
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied to requested file path")
            
        if not resolved_path.exists() or not resolved_path.is_file():
            raise HTTPException(status_code=404, detail="Requested file not found")
            
        from urllib.parse import quote
        filename = resolved_path.name
        # Use RFC 5987 encoding for filename in Content-Disposition to prevent Starlette latin-1 encoding crashes
        encoded_filename = quote(filename)
        headers = {
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
        
        def iterfile():
            with open(resolved_path, mode="rb") as file_like:
                yield from file_like
                
        return StreamingResponse(
            iterfile(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers=headers
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
