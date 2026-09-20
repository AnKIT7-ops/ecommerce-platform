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
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import hash_password
from app.database import get_db
from app.main import app
from app.models import Cart, CartItem, Order, OrderStatus, Product, User, UserRole
from app.schemas.order import OrderCreate
from app.services.checkout import create_order_from_cart
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
                full_name=f"Racer {index}",
                role=UserRole.CUSTOMER,
            )
            for index, email in enumerate(
                ("racer1@example.com", "racer2@example.com"), start=1
            )
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


def test_concurrent_cancel_restocks_exactly_once(live_engine: Engine) -> None:
    """Two overlapping cancellations must credit the catalogue once.

    The damaging interleaving is precise, so it is staged rather than raced:
    session B reads the order while it is still PENDING, session A then cancels
    and commits, and only afterwards does B act on what it read. A status check
    made against B's own view therefore still sees PENDING.

    The fix is that the status change is a conditional UPDATE. B's UPDATE waits
    on A's row lock, then matches zero rows and is rejected, so the restock
    never runs twice.
    """
    from app.api.orders import cancel_order

    product_id = _seed_race(live_engine, stock=5)
    factory = sessionmaker(bind=live_engine, expire_on_commit=False)

    with factory() as setup:
        user_id = setup.execute(
            select(User.id).where(User.email == "racer1@example.com")
        ).scalar_one()
        cart = Cart(user_id=user_id)
        setup.add(cart)
        setup.flush()
        setup.add(CartItem(cart_id=cart.id, product_id=product_id, quantity=2))
        setup.commit()

        order = create_order_from_cart(
            setup, user_id, OrderCreate(**SHIPPING)
        )
        order_id = order.id

    with factory() as setup:
        assert setup.execute(
            select(Product.stock_quantity).where(Product.id == product_id)
        ).scalar_one() == 3, "checkout must take the two units first"

    db_a = factory()
    db_b = factory()
    try:
        user_a = db_a.get(User, user_id)
        user_b = db_b.get(User, user_id)
        assert user_a is not None and user_b is not None

        # B loads the order while it is still PENDING, and keeps it referenced.
        # The reference is load-bearing: SQLAlchemy's identity map holds weak
        # references, so without it the instance would be collected and B's next
        # SELECT would silently return fresh, already-cancelled data - which is
        # not the interleaving being tested. Inside a real request the handler's
        # own local variable holds the order for exactly this window.
        stale_order = db_b.get(Order, order_id)
        assert stale_order is not None
        assert stale_order.status is OrderStatus.PENDING

        # A cancels and commits.
        cancel_order(order_id, user_a, db_a)

        # B's view has not moved on: this is the window the guard has to close.
        assert stale_order.status is OrderStatus.PENDING

        # B now acts on the order it read before A committed.
        with pytest.raises(HTTPException) as raised:
            cancel_order(order_id, user_b, db_b)
        assert raised.value.status_code == 409
    finally:
        db_a.close()
        db_b.close()

    with factory() as check:
        stock = check.execute(
            select(Product.stock_quantity).where(Product.id == product_id)
        ).scalar_one()
        status_value = check.execute(
            select(Order.status).where(Order.id == order_id)
        ).scalar_one()

    assert stock == 5, f"the two units must be returned once, not twice (got {stock})"
    assert status_value is OrderStatus.CANCELLED
