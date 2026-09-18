"""Database engine, session factory and declarative base."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    # Without this, FastAPI serializing a response after commit triggers a full
    # re-SELECT of every attribute it touches.
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """Request-scoped database session.

    Deliberately does not commit or rollback: ``Session.close()`` already rolls
    back any pending transaction, and committing here would persist half-finished
    work when a handler raises. Services commit explicitly when they are done.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
