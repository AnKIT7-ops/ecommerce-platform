"""Password hashing and JWT token handling."""

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
import jwt

from app.config import settings

#: bcrypt refuses inputs longer than this many *bytes* (not characters).
BCRYPT_MAX_BYTES = 72

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt.

    Raises ``ValueError`` if the password exceeds bcrypt's 72-byte limit;
    request schemas validate this first so clients get a 422 rather than a 500.
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored hash.

    bcrypt >= 4.1 *raises* on an over-long password instead of truncating, so an
    attacker posting a 200-character password would turn a failed login into a
    500 without this guard.
    """
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _create_token(subject: str | int, token_type: TokenType, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        # Must be a string: consumers and the JWT spec both expect `sub` to be one.
        "sub": str(subject),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(subject: str | int) -> str:
    return _create_token(
        subject, "access", timedelta(minutes=settings.access_token_expire_minutes)
    )


def create_refresh_token(subject: str | int) -> str:
    return _create_token(subject, "refresh", timedelta(days=settings.refresh_token_expire_days))


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    """Decode and validate a JWT, enforcing its type.

    The type check is not optional: access and refresh tokens are signed with
    the same key and algorithm, so without it a 7-day refresh token would be
    accepted anywhere an access token is.

    Raises ``jwt.InvalidTokenError`` (or a subclass) on any failure.
    """
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"expected a {expected_type} token")
    if not payload.get("sub"):
        raise jwt.InvalidTokenError("token is missing a subject")
    return payload
