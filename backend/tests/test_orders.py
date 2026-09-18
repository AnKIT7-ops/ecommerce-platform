"""Checkout, order history and the order lifecycle."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Product

SHIPPING = {
    "shipping_full_name": "Test Customer",
    "shipping_address_line1": "1 Example Street",
    "shipping_city": "Pune",
    "shipping_postal_code": "411001",
    "shipping_country": "India",
}


def _add_to_cart(
    client: TestClient, headers: dict[str, str], product: Product, quantity: int = 1
) -> None:
    response = client.post(
        "/api/cart/items",
        json={"product_id": product.id, "quantity": quantity},
        headers=headers,
    )
    assert response.status_code == 201, response.text


# --- Checkout ---------------------------------------------------------------


def test_checkout_requires_authentication(client: TestClient) -> None:
    assert client.post("/api/orders", json=SHIPPING).status_code == 401


def test_checkout_with_empty_cart_is_rejected(
    client: TestClient, customer_headers: dict[str, str]
) -> None:
    response = client.post("/api/orders", json=SHIPPING, headers=customer_headers)
    assert response.status_code == 400


def test_checkout_requires_shipping_details(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    _add_to_cart(client, customer_headers, product)
    response = client.post("/api/orders", json={}, headers=customer_headers)
    assert response.status_code == 422


def test_checkout_creates_a_pending_order(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    _add_to_cart(client, customer_headers, product, quantity=2)

    response = client.post("/api/orders", json=SHIPPING, headers=customer_headers)
    assert response.status_code == 201

    order = response.json()
    assert order["status"] == "pending"
    assert order["total_amount"] == "99.90"  # 49.95 x 2
    assert len(order["items"]) == 1
    assert order["items"][0]["quantity"] == 2
    assert order["items"][0]["unit_price"] == "49.95"
    assert order["items"][0]["line_total"] == "99.90"


def test_checkout_snapshots_the_product_name(
    client: TestClient, customer_headers: dict[str, str], admin_headers: dict[str, str],
    product: Product,
) -> None:
    """Renaming a product afterwards must not rewrite order history."""
    _add_to_cart(client, customer_headers, product)
    order = client.post("/api/orders", json=SHIPPING, headers=customer_headers).json()
    original_name = order["items"][0]["product_name"]

    client.put(f"/api/products/{product.id}", json={"name": "Renamed Later"}, headers=admin_headers)

    refetched = client.get(f"/api/orders/{order['id']}", headers=customer_headers).json()
    assert refetched["items"][0]["product_name"] == original_name != "Renamed Later"


def test_checkout_decrements_stock(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    starting_stock = product.stock_quantity
    _add_to_cart(client, customer_headers, product, quantity=3)
    client.post("/api/orders", json=SHIPPING, headers=customer_headers)

    remaining = client.get(f"/api/products/{product.id}").json()["stock_quantity"]
    assert remaining == starting_stock - 3


def test_checkout_empties_the_cart(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    _add_to_cart(client, customer_headers, product)
    client.post("/api/orders", json=SHIPPING, headers=customer_headers)

    assert client.get("/api/cart", headers=customer_headers).json()["total_items"] == 0


def test_checkout_totals_multiple_lines(
    client: TestClient, customer_headers: dict[str, str], products: list[Product]
) -> None:
    _add_to_cart(client, customer_headers, products[0], quantity=2)  # 19.99 x2 = 39.98
    _add_to_cart(client, customer_headers, products[2], quantity=1)  # 89.50
    _add_to_cart(client, customer_headers, products[3], quantity=1)  # 129.00

    order = client.post("/api/orders", json=SHIPPING, headers=customer_headers).json()
    assert Decimal(order["total_amount"]) == Decimal("258.48")


def test_checkout_is_rejected_when_stock_ran_out_after_adding_to_cart(
    client: TestClient, customer_headers: dict[str, str], product: Product, db_session: Session
) -> None:
    _add_to_cart(client, customer_headers, product, quantity=5)

    # Someone else bought the stock in the meantime.
    product.stock_quantity = 2
    db_session.commit()

    response = client.post("/api/orders", json=SHIPPING, headers=customer_headers)
    assert response.status_code == 409


def test_failed_checkout_leaves_the_cart_intact(
    client: TestClient, customer_headers: dict[str, str], product: Product, db_session: Session
) -> None:
    """The whole checkout is one transaction, so a rejection rolls everything back."""
    _add_to_cart(client, customer_headers, product, quantity=5)
    product.stock_quantity = 1
    db_session.commit()

    client.post("/api/orders", json=SHIPPING, headers=customer_headers)

    cart = client.get("/api/cart", headers=customer_headers).json()
    assert cart["total_items"] == 5
    assert client.get("/api/orders", headers=customer_headers).json()["total"] == 0


def test_failed_checkout_does_not_decrement_any_stock(
    client: TestClient,
    customer_headers: dict[str, str],
    products: list[Product],
    db_session: Session,
) -> None:
    """The first line must not stay decremented when a later line fails."""
    cheap, expensive = products[0], products[3]
    _add_to_cart(client, customer_headers, cheap, quantity=1)
    _add_to_cart(client, customer_headers, expensive, quantity=1)

    starting_cheap_stock = cheap.stock_quantity
    expensive.stock_quantity = 0
    db_session.commit()

    assert client.post("/api/orders", json=SHIPPING, headers=customer_headers).status_code == 409
    assert (
        client.get(f"/api/products/{cheap.id}").json()["stock_quantity"] == starting_cheap_stock
    )


def test_checkout_rejects_a_product_deactivated_after_adding(
    client: TestClient, customer_headers: dict[str, str], product: Product, db_session: Session
) -> None:
    _add_to_cart(client, customer_headers, product)
    product.is_active = False
    db_session.commit()

    assert client.post("/api/orders", json=SHIPPING, headers=customer_headers).status_code == 409


# --- Order retrieval --------------------------------------------------------


def test_order_history_lists_the_users_orders(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    _add_to_cart(client, customer_headers, product, quantity=2)
    client.post("/api/orders", json=SHIPPING, headers=customer_headers)

    body = client.get("/api/orders", headers=customer_headers).json()
    assert body["total"] == 1

    summary = body["items"][0]
    assert summary["status"] == "pending"
    assert summary["item_count"] == 2
    assert summary["total_amount"] == "99.90"


def test_order_history_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/orders").status_code == 401


def test_order_detail_returns_line_items(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    _add_to_cart(client, customer_headers, product)
    order_id = client.post("/api/orders", json=SHIPPING, headers=customer_headers).json()["id"]

    body = client.get(f"/api/orders/{order_id}", headers=customer_headers).json()
    assert body["id"] == order_id
    assert body["shipping_city"] == "Pune"
    assert len(body["items"]) == 1


def test_another_user_cannot_read_the_order(
    client: TestClient,
    customer_headers: dict[str, str],
    other_headers: dict[str, str],
    product: Product,
) -> None:
    """404, not 403 - a 403 would confirm the order id exists."""
    _add_to_cart(client, customer_headers, product)
    order_id = client.post("/api/orders", json=SHIPPING, headers=customer_headers).json()["id"]

    assert client.get(f"/api/orders/{order_id}", headers=other_headers).status_code == 404


def test_another_users_orders_are_not_listed(
    client: TestClient,
    customer_headers: dict[str, str],
    other_headers: dict[str, str],
    product: Product,
) -> None:
    _add_to_cart(client, customer_headers, product)
    client.post("/api/orders", json=SHIPPING, headers=customer_headers)

    assert client.get("/api/orders", headers=other_headers).json()["total"] == 0


def test_unknown_order_is_404(client: TestClient, customer_headers: dict[str, str]) -> None:
    assert client.get("/api/orders/999999", headers=customer_headers).status_code == 404


# --- Lifecycle --------------------------------------------------------------


def _place_order(client: TestClient, headers: dict[str, str], product: Product) -> int:
    _add_to_cart(client, headers, product)
    return client.post("/api/orders", json=SHIPPING, headers=headers).json()["id"]


def test_customer_cannot_set_order_status(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    order_id = _place_order(client, customer_headers, product)
    response = client.patch(
        f"/api/orders/{order_id}/status", json={"status": "confirmed"}, headers=customer_headers
    )
    assert response.status_code == 403


def test_admin_advances_order_status(
    client: TestClient,
    customer_headers: dict[str, str],
    admin_headers: dict[str, str],
    product: Product,
) -> None:
    order_id = _place_order(client, customer_headers, product)
    response = client.patch(
        f"/api/orders/{order_id}/status", json={"status": "confirmed"}, headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


def test_illegal_status_transition_is_rejected(
    client: TestClient,
    customer_headers: dict[str, str],
    admin_headers: dict[str, str],
    product: Product,
) -> None:
    order_id = _place_order(client, customer_headers, product)
    # pending -> delivered skips the whole pipeline.
    response = client.patch(
        f"/api/orders/{order_id}/status", json={"status": "delivered"}, headers=admin_headers
    )
    assert response.status_code == 409


def test_unknown_status_value_is_rejected(
    client: TestClient,
    customer_headers: dict[str, str],
    admin_headers: dict[str, str],
    product: Product,
) -> None:
    order_id = _place_order(client, customer_headers, product)
    response = client.patch(
        f"/api/orders/{order_id}/status", json={"status": "teleported"}, headers=admin_headers
    )
    assert response.status_code == 422


def test_cancelling_restores_stock(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    starting_stock = product.stock_quantity
    _add_to_cart(client, customer_headers, product, quantity=3)
    order_id = client.post("/api/orders", json=SHIPPING, headers=customer_headers).json()["id"]

    assert client.get(f"/api/products/{product.id}").json()["stock_quantity"] == starting_stock - 3

    response = client.post(f"/api/orders/{order_id}/cancel", headers=customer_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    assert client.get(f"/api/products/{product.id}").json()["stock_quantity"] == starting_stock


def test_cancelled_order_cannot_be_cancelled_again(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    order_id = _place_order(client, customer_headers, product)
    client.post(f"/api/orders/{order_id}/cancel", headers=customer_headers)

    assert (
        client.post(f"/api/orders/{order_id}/cancel", headers=customer_headers).status_code == 409
    )


def test_another_user_cannot_cancel_the_order(
    client: TestClient,
    customer_headers: dict[str, str],
    other_headers: dict[str, str],
    product: Product,
) -> None:
    order_id = _place_order(client, customer_headers, product)
    assert client.post(f"/api/orders/{order_id}/cancel", headers=other_headers).status_code == 404
