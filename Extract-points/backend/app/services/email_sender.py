import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email.utils import formatdate
import os
import logging
from typing import List, Optional
import io
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailSender:
    """Base email sender class"""
    def send_email(self, recipient: str, subject: str, body: str, 
                   attachments: List[tuple] = None, from_name: str = None) -> bool:
        raise NotImplementedError

class GmailSender(EmailSender):
    """Gmail SMTP sender using App Password"""
    
    def __init__(self, sender_email: str, app_password: str):
        self.sender_email = sender_email
        self.app_password = app_password
        self.smtp_server = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
    
    def send_email(self, recipient: str, subject: str, body: str, 
                   attachments: List[tuple] = None, from_name: str = None) -> bool:
        try:
            msg = MIMEMultipart()
            msg['From'] = f"{from_name} <{self.sender_email}>" if from_name else self.sender_email
            msg['To'] = recipient
            msg['Subject'] = subject
            msg['Date'] = formatdate(localtime=True)
            
            msg.attach(MIMEText(body, 'plain'))
            
            if attachments:
                for filename, file_content in attachments:
                    self._attach_file(msg, filename, file_content)
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender_email, self.app_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {recipient}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {recipient}: {e}")
            return False
    
    def _attach_file(self, msg: MIMEMultipart, filename: str, file_content: io.BytesIO):
        try:
            part = MIMEBase('application', 'octet-stream')
            if isinstance(file_content, io.BytesIO):
                file_content.seek(0)
                payload = file_content.read()
            else:
                payload = file_content
            
            part.set_payload(payload)
            from email import encoders
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename={filename}')
            msg.attach(part)
        except Exception as e:
            logger.error(f"Failed to attach file {filename}: {e}")

class OutlookSender(EmailSender):
    """Outlook/Microsoft 365 SMTP sender"""
    
    def __init__(self, sender_email: str, password: str):
        self.sender_email = sender_email
        self.password = password
        self.smtp_server = "smtp-mail.outlook.com"
        self.smtp_port = 587
    
    def send_email(self, recipient: str, subject: str, body: str, 
                   attachments: List[tuple] = None, from_name: str = None) -> bool:
        try:
            msg = MIMEMultipart()
            msg['From'] = f"{from_name} <{self.sender_email}>" if from_name else self.sender_email
            msg['To'] = recipient
            msg['Subject'] = subject
            msg['Date'] = formatdate(localtime=True)
            
            msg.attach(MIMEText(body, 'plain'))
            
            if attachments:
                for filename, file_content in attachments:
                    self._attach_file(msg, filename, file_content)
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender_email, self.password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {recipient}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {recipient}: {e}")
            return False
    
    def _attach_file(self, msg: MIMEMultipart, filename: str, file_content: io.BytesIO):
        try:
            part = MIMEBase('application', 'octet-stream')
            if isinstance(file_content, io.BytesIO):
                file_content.seek(0)
                payload = file_content.read()
            else:
                payload = file_content
            
            part.set_payload(payload)
            from email import encoders
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename={filename}')
            msg.attach(part)
        except Exception as e:
            logger.error(f"Failed to attach file {filename}: {e}")

class SendGridSender(EmailSender):
    """SendGrid API sender"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.SENDGRID_API_KEY
        if not self.api_key:
            logger.error("SendGrid API key not found.")
    
    def send_email(self, recipient: str, subject: str, body: str, 
                   attachments: List[tuple] = None, from_name: str = None, 
                   from_email: str = None) -> bool:
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
            import base64
            
            if not self.api_key:
                logger.error("SendGrid not configured properly")
                return False
            
            mail = Mail(
                from_email=(from_email or settings.SMTP_USER or "noreply@example.com", from_name or "Resume Sender"),
                to_emails=recipient,
                subject=subject,
                plain_text_content=body
            )
            
            if attachments:
                for filename, file_content in attachments:
                    if isinstance(file_content, io.BytesIO):
                        file_content.seek(0)
                        content = base64.b64encode(file_content.read()).decode()
                    else:
                        content = base64.b64encode(file_content).decode()
                    
                    attachment = Attachment(
                        FileContent(content),
                        FileName(filename),
                        FileType('application/octet-stream'),
                        Disposition('attachment')
                    )
                    mail.add_attachment(attachment)
            
            sg = SendGridAPIClient(self.api_key)
            response = sg.send(mail)
            logger.info(f"Email sent successfully to {recipient} via SendGrid")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via SendGrid: {e}")
            return False

def get_email_sender(provider: str = "gmail", **config) -> Optional[EmailSender]:
    provider = provider.lower()
    
    if provider == "gmail":
        sender_email = config.get('sender_email') or settings.SMTP_USER
        app_password = config.get('app_password') or settings.SMTP_PASSWORD
        if sender_email and app_password:
            return GmailSender(sender_email, app_password)
        return None
    
    elif provider == "outlook":
        sender_email = config.get('sender_email') or settings.SMTP_USER
        password = config.get('password') or settings.SMTP_PASSWORD
        if sender_email and password:
            return OutlookSender(sender_email, password)
        return None
    
    elif provider == "sendgrid":
        api_key = config.get('api_key') or settings.SENDGRID_API_KEY
        return SendGridSender(api_key)
    
    return None
