"""Concurrent checkout must not oversell.

This module cannot use the shared ``db_session`` fixture. That fixture pins
every session to a single connection inside one transaction, so two "concurrent"
checkouts would serialize and the race being tested could not occur. These
tests therefore use real, separate sessions against the test database and clean
up with TRUNCATE afterwards.
"""

from __future__ import annotations

import threading
from collections.abc import Generator
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import hash_password
from app.database import get_db
from app.main import app
from app.models import Order, Product, User, UserRole
from tests.conftest import ALL_TABLES

SHIPPING = {
    "shipping_full_name": "Racer",
    "shipping_address_line1": "1 Example Street",
    "shipping_city": "Pune",
    "shipping_postal_code": "411001",
    "shipping_country": "India",
}


@pytest.fixture
def live_engine(
    test_engine_config: tuple[str, dict[str, str]], engine: Engine
) -> Generator[Engine, None, None]:
    """A real engine with a real pool, plus TRUNCATE cleanup.

    Depends on ``engine`` only to guarantee migrations have already run.
    """
    url, connect_args = test_engine_config
    live = create_engine(url, connect_args=connect_args, pool_size=5, max_overflow=5)

    def truncate() -> None:
        with live.begin() as conn:
            conn.execute(text(f"TRUNCATE {ALL_TABLES} RESTART IDENTITY CASCADE"))

    truncate()
    try:
        yield live
    finally:
        truncate()
        live.dispose()


@pytest.fixture
def live_client(live_engine: Engine) -> Generator[TestClient, None, None]:
    """TestClient backed by genuinely independent sessions per request."""
    factory = sessionmaker(bind=live_engine, autocommit=False, autoflush=False,
                           expire_on_commit=False)

    def override_get_db() -> Generator[Session, None, None]:
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def _seed_race(live_engine: Engine, stock: int) -> int:
    """One product with the given stock, and two shoppers who each want one."""
    factory = sessionmaker(bind=live_engine, expire_on_commit=False)
    with factory() as db:
        product = Product(
            name="Last One Left",
            slug="last-one-left",
            price=Decimal("10.00"),
            stock_quantity=stock,
            is_active=True,
        )
        db.add(product)
        db.add_all(
            User(
                email=email,
                password_hash=hash_password("racerpassword1"),
                role=UserRole.CUSTOMER,
            )
            for email in ("racer1@example.com", "racer2@example.com")
        )
        db.commit()
        return product.id


def _login(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"email": email, "password": "racerpassword1"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_concurrent_checkout_never_oversells(
    live_engine: Engine, live_client: TestClient
) -> None:
    """Two shoppers race for the last unit. Exactly one wins."""
    product_id = _seed_race(live_engine, stock=1)

    headers = [_login(live_client, email) for email in ("racer1@example.com", "racer2@example.com")]
    for header in headers:
        response = live_client.post(
            "/api/cart/items", json={"product_id": product_id, "quantity": 1}, headers=header
        )
        assert response.status_code == 201, response.text

    results: dict[int, int] = {}
    # Line both threads up so they hit the UPDATE as close together as possible.
    barrier = threading.Barrier(len(headers))

    def checkout(index: int, header: dict[str, str]) -> None:
        client = TestClient(app)
        barrier.wait()
        results[index] = client.post("/api/orders", json=SHIPPING, headers=header).status_code

    threads = [
        threading.Thread(target=checkout, args=(i, h)) for i, h in enumerate(headers)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(results.values()) == [201, 409], results

    factory = sessionmaker(bind=live_engine)
    with factory() as db:
        stock = db.execute(
            select(Product.stock_quantity).where(Product.id == product_id)
        ).scalar_one()
        order_count = db.execute(select(Order)).scalars().all()

    assert stock == 0, "stock must never go negative"
    assert len(order_count) == 1, "exactly one order may be created"


def test_concurrent_checkout_allows_both_when_stock_suffices(
    live_engine: Engine, live_client: TestClient
) -> None:
    """The guard must reject oversell without rejecting legitimate concurrency."""
    product_id = _seed_race(live_engine, stock=2)

    headers = [_login(live_client, email) for email in ("racer1@example.com", "racer2@example.com")]
    for header in headers:
        live_client.post(
            "/api/cart/items", json={"product_id": product_id, "quantity": 1}, headers=header
        )

    results: dict[int, int] = {}
    barrier = threading.Barrier(len(headers))

    def checkout(index: int, header: dict[str, str]) -> None:
        client = TestClient(app)
        barrier.wait()
        results[index] = client.post("/api/orders", json=SHIPPING, headers=header).status_code

    threads = [threading.Thread(target=checkout, args=(i, h)) for i, h in enumerate(headers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(results.values()) == [201, 201], results

    factory = sessionmaker(bind=live_engine)
    with factory() as db:
        stock = db.execute(
            select(Product.stock_quantity).where(Product.id == product_id)
        ).scalar_one()
    assert stock == 0
