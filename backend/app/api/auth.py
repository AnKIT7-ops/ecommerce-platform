"""Authentication routes."""

from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.security import create_access_token, create_refresh_token, decode_token
from app.dependencies import CurrentUserDep, DbDep
from app.models.user import User
from app.schemas.token import AuthResponse, RefreshRequest, TokenPair
from app.schemas.user import UserCreate, UserLogin, UserRead, UserUpdate
from app.services.users import authenticate_user, create_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _issue_tokens(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserRead.model_validate(user),
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: DbDep) -> AuthResponse:
    """Create a customer account and sign the user straight in.

    New accounts are always role=customer; administrators are provisioned by the
    seed script, never through this endpoint.
    """
    user = create_user(db, data)
    return _issue_tokens(user)


@router.post("/login")
def login(credentials: UserLogin, db: DbDep) -> AuthResponse:
    """Exchange email and password for an access/refresh token pair."""
    user = authenticate_user(db, credentials.email, credentials.password)
    return _issue_tokens(user)


@router.post("/token", include_in_schema=True)
def login_form(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbDep,
) -> TokenPair:
    """Form-encoded login backing the Swagger "Authorize" button.

    Same credentials as /login (send the email as `username`); this variant
    exists so /docs can authenticate without copy-pasting a token by hand.
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh")
def refresh_tokens(data: RefreshRequest, db: DbDep) -> TokenPair:
    """Trade a valid refresh token for a fresh token pair."""
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(data.refresh_token, "refresh")
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise invalid from exc

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise invalid

    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me")
def read_current_user(current_user: CurrentUserDep) -> UserRead:
    """Return the authenticated user's profile."""
    return UserRead.model_validate(current_user)


@router.patch("/me")
def update_current_user(data: UserUpdate, current_user: CurrentUserDep, db: DbDep) -> UserRead:
    """Update the authenticated user's own profile."""
    if data.full_name is not None:
        current_user.full_name = data.full_name
    db.commit()
    db.refresh(current_user)
    return UserRead.model_validate(current_user)
