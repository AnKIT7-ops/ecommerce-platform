"""URL slug generation."""

import re
import unicodedata

from sqlalchemy import func, select
from sqlalchemy.orm import Session

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    """Turn arbitrary text into a lowercase, hyphen-separated slug."""
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    return _NON_ALNUM.sub("-", ascii_only.lower()).strip("-") or "item"


def unique_slug(db: Session, model: type, value: str, exclude_id: int | None = None) -> str:
    """Slugify ``value``, appending -2, -3, ... until it is free on ``model``."""
    base = slugify(value)
    candidate = base
    suffix = 1

    while True:
        stmt = select(func.count()).select_from(model).where(model.slug == candidate)
        if exclude_id is not None:
            stmt = stmt.where(model.id != exclude_id)
        if db.execute(stmt).scalar_one() == 0:
            return candidate
        suffix += 1
        candidate = f"{base}-{suffix}"
