"""User and authentication schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
)

from app.core.security import BCRYPT_MAX_BYTES
from app.models.user import UserRole


# A bare ``min_length=1`` counts characters, so "   " would pass and store a
# blank-looking name. Stripping first means whitespace-only input fails.
FullName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]


def _validate_password_bytes(value: str) -> str:
    """Reject passwords bcrypt cannot hash.

    A Pydantic ``max_length`` counts characters, so a 40-character password of
    CJK or emoji still exceeds bcrypt's 72-*byte* ceiling and would raise deep
    in the hashing call. Checking bytes here turns that into a clean 422.
    """
    if len(value.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValueError(f"password must be at most {BCRYPT_MAX_BYTES} bytes when UTF-8 encoded")
    return value


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="At least 8 characters, max 72 bytes")
    full_name: FullName

    @field_validator("password")
    @classmethod
    def _password_fits_bcrypt(cls, v: str) -> str:
        return _validate_password_bytes(v)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    """Public user representation. Never includes password_hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None
    role: UserRole
    is_active: bool
    created_at: datetime


class UserUpdate(BaseModel):
    # Required when present. The column stays nullable for accounts created
    # before the name was mandatory, so UserRead still tolerates None.
    full_name: FullName
