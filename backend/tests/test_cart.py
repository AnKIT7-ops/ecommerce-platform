"""Shopping cart endpoints."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Product


def test_cart_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/cart").status_code == 401
    assert client.post("/api/cart/items", json={"product_id": 1}).status_code == 401
    assert client.delete("/api/cart").status_code == 401


def test_new_cart_is_empty(client: TestClient, customer_headers: dict[str, str]) -> None:
    body = client.get("/api/cart", headers=customer_headers).json()
    assert body["items"] == []
    assert body["total_items"] == 0
    assert body["subtotal"] == "0.00"


def test_add_item_returns_updated_cart(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    response = client.post(
        "/api/cart/items",
        json={"product_id": product.id, "quantity": 2},
        headers=customer_headers,
    )
    assert response.status_code == 201

    body = response.json()
    assert body["total_items"] == 2
    assert body["items"][0]["quantity"] == 2
    assert body["items"][0]["line_total"] == "99.90"  # 49.95 * 2
    assert body["subtotal"] == "99.90"


def test_adding_the_same_product_twice_merges_the_line(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    """The unique (cart_id, product_id) constraint means a repeat add increments."""
    client.post(
        "/api/cart/items", json={"product_id": product.id, "quantity": 2}, headers=customer_headers
    )
    body = client.post(
        "/api/cart/items", json={"product_id": product.id, "quantity": 3}, headers=customer_headers
    ).json()

    assert len(body["items"]) == 1
    assert body["items"][0]["quantity"] == 5


def test_subtotal_sums_multiple_lines(
    client: TestClient, customer_headers: dict[str, str], products: list[Product]
) -> None:
    client.post(
        "/api/cart/items",
        json={"product_id": products[0].id, "quantity": 2},  # 19.99 x2
        headers=customer_headers,
    )
    body = client.post(
        "/api/cart/items",
        json={"product_id": products[2].id, "quantity": 1},  # 89.50
        headers=customer_headers,
    ).json()

    assert Decimal(body["subtotal"]) == Decimal("129.48")


def test_add_beyond_stock_is_rejected(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    response = client.post(
        "/api/cart/items",
        json={"product_id": product.id, "quantity": product.stock_quantity + 1},
        headers=customer_headers,
    )
    assert response.status_code == 409


def test_incremental_adds_cannot_exceed_stock_in_total(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    """Stock is checked against the resulting quantity, not just the increment."""
    client.post(
        "/api/cart/items",
        json={"product_id": product.id, "quantity": product.stock_quantity},
        headers=customer_headers,
    )
    response = client.post(
        "/api/cart/items", json={"product_id": product.id, "quantity": 1}, headers=customer_headers
    )
    assert response.status_code == 409


def test_add_unknown_product_is_404(
    client: TestClient, customer_headers: dict[str, str]
) -> None:
    response = client.post(
        "/api/cart/items", json={"product_id": 999999, "quantity": 1}, headers=customer_headers
    )
    assert response.status_code == 404


def test_add_inactive_product_is_404(
    client: TestClient, customer_headers: dict[str, str], product: Product, db_session: Session
) -> None:
    product.is_active = False
    db_session.commit()

    response = client.post(
        "/api/cart/items", json={"product_id": product.id, "quantity": 1}, headers=customer_headers
    )
    assert response.status_code == 404


def test_zero_quantity_is_rejected(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    response = client.post(
        "/api/cart/items", json={"product_id": product.id, "quantity": 0}, headers=customer_headers
    )
    assert response.status_code == 422


def test_update_quantity(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    added = client.post(
        "/api/cart/items", json={"product_id": product.id, "quantity": 3}, headers=customer_headers
    ).json()
    item_id = added["items"][0]["id"]

    body = client.put(
        f"/api/cart/items/{item_id}", json={"quantity": 1}, headers=customer_headers
    ).json()
    assert body["items"][0]["quantity"] == 1
    assert body["subtotal"] == "49.95"


def test_update_beyond_stock_is_rejected(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    added = client.post(
        "/api/cart/items", json={"product_id": product.id, "quantity": 1}, headers=customer_headers
    ).json()
    item_id = added["items"][0]["id"]

    response = client.put(
        f"/api/cart/items/{item_id}",
        json={"quantity": product.stock_quantity + 5},
        headers=customer_headers,
    )
    assert response.status_code == 409


def test_remove_item(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    added = client.post(
        "/api/cart/items", json={"product_id": product.id, "quantity": 1}, headers=customer_headers
    ).json()
    item_id = added["items"][0]["id"]

    body = client.delete(f"/api/cart/items/{item_id}", headers=customer_headers).json()
    assert body["items"] == []


def test_clear_cart(
    client: TestClient, customer_headers: dict[str, str], products: list[Product]
) -> None:
    for item in products[:2]:
        client.post(
            "/api/cart/items",
            json={"product_id": item.id, "quantity": 1},
            headers=customer_headers,
        )

    assert client.delete("/api/cart", headers=customer_headers).status_code == 200
    assert client.get("/api/cart", headers=customer_headers).json()["total_items"] == 0


def test_carts_are_isolated_per_user(
    client: TestClient,
    customer_headers: dict[str, str],
    other_headers: dict[str, str],
    product: Product,
) -> None:
    client.post(
        "/api/cart/items", json={"product_id": product.id, "quantity": 2}, headers=customer_headers
    )
    assert client.get("/api/cart", headers=other_headers).json()["total_items"] == 0


def test_cannot_touch_another_users_cart_item(
    client: TestClient,
    customer_headers: dict[str, str],
    other_headers: dict[str, str],
    product: Product,
) -> None:
    """404, not 403 - a 403 would confirm the item id exists."""
    added = client.post(
        "/api/cart/items", json={"product_id": product.id, "quantity": 1}, headers=customer_headers
    ).json()
    item_id = added["items"][0]["id"]

    assert (
        client.put(
            f"/api/cart/items/{item_id}", json={"quantity": 9}, headers=other_headers
        ).status_code
        == 404
    )
    assert client.delete(f"/api/cart/items/{item_id}", headers=other_headers).status_code == 404
