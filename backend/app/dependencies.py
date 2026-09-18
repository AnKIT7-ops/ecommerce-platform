"""Shared FastAPI dependencies."""

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.database import get_db
from app.models.user import User

DbDep = Annotated[Session, Depends(get_db)]

# Declared purely so Swagger renders a working "Authorize" button backed by the
# form-encoded /api/auth/token endpoint. HTTPBearer below does the real work.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    db: DbDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    oauth_token: Annotated[str | None, Depends(oauth2_scheme)] = None,
) -> User:
    """Resolve the authenticated user from a bearer access token."""
    token = credentials.credentials if credentials else oauth_token
    if not token:
        raise CREDENTIALS_EXCEPTION

    try:
        # expected_type="access" is the load-bearing part: without it a 7-day
        # refresh token would authenticate every request for a week.
        payload = decode_token(token, "access")
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise CREDENTIALS_EXCEPTION from exc

    user = db.get(User, user_id)
    if user is None:
        raise CREDENTIALS_EXCEPTION
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled",
        )
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_admin(current_user: CurrentUserDep) -> User:
    """Allow only administrators through.

    Customers keep read access to products and categories; writes are admin-only.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires administrator privileges",
        )
    return current_user


AdminDep = Annotated[User, Depends(require_admin)]
