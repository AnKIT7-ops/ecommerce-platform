"""JWT token schemas."""

from pydantic import BaseModel

from app.schemas.user import UserRead


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthResponse(TokenPair):
    """Token pair plus the authenticated user, so the client avoids a second call."""

    user: UserRead


class RefreshRequest(BaseModel):
    refresh_token: str
