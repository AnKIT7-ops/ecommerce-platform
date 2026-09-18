"""Pytest fixtures.

Tests run against a real PostgreSQL database (``ecommerce_test_db`` by default),
not SQLite: the application relies on NUMERIC semantics, ``RETURNING`` on
UPDATE and real transaction isolation, none of which SQLite reproduces
faithfully.

Schema is built by running the Alembic migrations, so the migrations themselves
are exercised on every test run rather than being assumed correct.

Isolation uses SQLAlchemy 2.0's ``join_transaction_mode="create_savepoint"``.
The application code calls ``session.commit()`` in several places; with this
mode those commits land on a savepoint, and the outer transaction rollback in
the fixture still discards everything.
"""

from __future__ import annotations

from collections.abc import Generator
from decimal import Decimal

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, make_url, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from alembic import command
from app.config import settings
from app.core.security import hash_password
from app.database import get_db
from app.main import app
from app.models import Category, Product, User, UserRole

BACKEND_DIR = __import__("pathlib").Path(__file__).resolve().parent.parent

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "adminpassword1"
CUSTOMER_EMAIL = "customer@example.com"
CUSTOMER_PASSWORD = "customerpassword1"
OTHER_EMAIL = "other@example.com"
OTHER_PASSWORD = "otherpassword1"

ALL_TABLES = "users, categories, products, carts, cart_items, orders, order_items"


#: Schema used when a dedicated test *database* cannot be created.
FALLBACK_SCHEMA = "ecommerce_test"


def _test_database_url() -> str:
    if settings.test_database_url:
        return settings.test_database_url
    url = make_url(settings.database_url)
    return str(url.set(database=f"{url.database}_test"))


def _try_create_database(url_str: str) -> bool:
    """Create the test database if possible.

    Returns False when the configured role lacks CREATEDB, which is normal for
    a least-privilege application user. The caller then falls back to schema
    isolation inside the existing database.
    """
    url = make_url(url_str)
    admin_engine = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")

    try:
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": url.database},
            ).scalar()
            if exists:
                return True
            # The identifier cannot be parameterised, but it comes from our own
            # configuration rather than from any request input.
            conn.execute(text(f'CREATE DATABASE "{url.database}"'))
            return True
    except OperationalError:
        return False  # cannot even reach the maintenance database
    except ProgrammingError:
        return False  # permission denied to create database
    finally:
        admin_engine.dispose()


@pytest.fixture(scope="session")
def test_engine_config() -> tuple[str, dict[str, str]]:
    """Resolve where tests run: a dedicated database, or an isolated schema.

    Preferring a separate database keeps the development data untouchable. When
    the application role has no CREATEDB privilege we fall back to a dedicated
    schema in the same database and pin ``search_path`` to it, which gives the
    same isolation - the connection cannot even see the public tables.
    """
    target_url = _test_database_url()

    if _try_create_database(target_url):
        return target_url, {}

    fallback_engine = create_engine(settings.database_url, isolation_level="AUTOCOMMIT")
    try:
        with fallback_engine.connect() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{FALLBACK_SCHEMA}"'))
    finally:
        fallback_engine.dispose()

    print(
        f"\n[tests] No CREATEDB privilege; using schema '{FALLBACK_SCHEMA}' in "
        f"{make_url(settings.database_url).database} instead.\n"
        f"[tests] For a fully separate test database, run as a superuser:\n"
        f"[tests]   ALTER ROLE {make_url(settings.database_url).username} CREATEDB;"
    )
    return settings.database_url, {"options": f"-csearch_path={FALLBACK_SCHEMA}"}


@pytest.fixture(scope="session")
def engine(test_engine_config: tuple[str, dict[str, str]]) -> Generator[Engine, None, None]:
    """Session-wide engine bound to a freshly migrated test schema."""
    url, connect_args = test_engine_config

    alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    # Escaped because alembic.ini values go through configparser interpolation.
    alembic_cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    if connect_args:
        alembic_cfg.attributes["connect_args"] = connect_args

    command.upgrade(alembic_cfg, "head")

    test_engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)
    yield test_engine
    test_engine.dispose()


@pytest.fixture
def db_session(engine: Engine) -> Generator[Session, None, None]:
    """A session whose writes are always rolled back.

    Everything the test and the request handlers do happens inside one outer
    transaction on one connection; rolling that back at teardown leaves the
    database untouched.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection,
        # The application uses expire_on_commit=False, which is correct for a
        # session that lives for exactly one request. This one is deliberately
        # shared across several requests within a test, so objects must be
        # re-read after each commit or assertions would see stale rows.
        expire_on_commit=True,
        join_transaction_mode="create_savepoint",
    )

    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """TestClient wired to the same transaction as ``db_session``."""

    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            # In production get_db() ends every request with session.close(),
            # which discards anything the handler flushed but did not commit.
            # The shared test session must not be closed, so roll back instead:
            # without this a failed request would leave its flushed rows
            # visible to the next request inside the same transaction, and
            # tests could not tell a rolled-back write from a persisted one.
            db_session.rollback()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# --- Data fixtures ----------------------------------------------------------


@pytest.fixture
def admin_user(db_session: Session) -> User:
    user = User(
        email=ADMIN_EMAIL,
        password_hash=hash_password(ADMIN_PASSWORD),
        full_name="Test Admin",
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def customer_user(db_session: Session) -> User:
    user = User(
        email=CUSTOMER_EMAIL,
        password_hash=hash_password(CUSTOMER_PASSWORD),
        full_name="Test Customer",
        role=UserRole.CUSTOMER,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def other_user(db_session: Session) -> User:
    user = User(
        email=OTHER_EMAIL,
        password_hash=hash_password(OTHER_PASSWORD),
        role=UserRole.CUSTOMER,
    )
    db_session.add(user)
    db_session.commit()
    return user


def auth_headers(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def admin_headers(client: TestClient, admin_user: User) -> dict[str, str]:
    return auth_headers(client, ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture
def customer_headers(client: TestClient, customer_user: User) -> dict[str, str]:
    return auth_headers(client, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)


@pytest.fixture
def other_headers(client: TestClient, other_user: User) -> dict[str, str]:
    return auth_headers(client, OTHER_EMAIL, OTHER_PASSWORD)


@pytest.fixture
def category(db_session: Session) -> Category:
    item = Category(name="Peripherals", slug="peripherals", description="Input devices")
    db_session.add(item)
    db_session.commit()
    return item


@pytest.fixture
def product(db_session: Session, category: Category) -> Product:
    item = Product(
        name="Drift Wireless Mouse",
        slug="drift-wireless-mouse",
        description="Silent switches and an 8000 DPI sensor",
        price=Decimal("49.95"),
        stock_quantity=10,
        category_id=category.id,
        is_active=True,
    )
    db_session.add(item)
    db_session.commit()
    return item


@pytest.fixture
def products(db_session: Session, category: Category) -> list[Product]:
    """A small catalogue with predictable names, prices and stock levels."""
    rows = [
        ("Alpha Keyboard", "alpha-keyboard", "19.99", 5),
        ("Beta Monitor", "beta-monitor", "199.00", 0),
        ("Gamma Headset", "gamma-headset", "89.50", 3),
        ("Delta Webcam", "delta-webcam", "129.00", 7),
    ]
    items = [
        Product(
            name=name,
            slug=slug,
            description=f"{name} description",
            price=Decimal(price),
            stock_quantity=stock,
            category_id=category.id,
            is_active=True,
        )
        for name, slug, price, stock in rows
    ]
    db_session.add_all(items)
    db_session.commit()
    return items
