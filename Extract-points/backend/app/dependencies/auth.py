from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
from app.core import security
from app.database.connection import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> Optional[User]:
    """Dependency to retrieve the currently logged-in user from JWT"""
    if not token:
        # For simplicity, if auth header is missing in this local SaaS setup, we can allow access
        # but in production, we throw an error. Let's make it throw a credentials exception
        # if they attempt to access protected endpoints.
        # But we'll return a mock or first user if database has users, or None.
        # Let's make it throw a clean HTTP exception for secure routes.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    email = security.decode_token(token)
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

def get_optional_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> Optional[User]:
    """Dependency that returns None instead of raising an error if user is unauthenticated"""
    if not token:
        return None
    try:
        email = security.decode_token(token)
        if email is None:
            return None
        return db.query(User).filter(User.email == email).first()
    except Exception:
        return None
