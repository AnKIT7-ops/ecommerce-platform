"""Product and category endpoints, including admin authorization."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Category, Order, OrderItem, Product, User

# --- Authorization ----------------------------------------------------------


def test_product_reads_are_public(client: TestClient, product: Product) -> None:
    assert client.get("/api/products").status_code == 200
    assert client.get(f"/api/products/{product.id}").status_code == 200


def test_anonymous_cannot_create_a_product(client: TestClient) -> None:
    response = client.post("/api/products", json={"name": "Sneaky", "price": "1.00"})
    assert response.status_code == 401


def test_customer_cannot_create_a_product(
    client: TestClient, customer_headers: dict[str, str]
) -> None:
    response = client.post(
        "/api/products", json={"name": "Sneaky", "price": "1.00"}, headers=customer_headers
    )
    assert response.status_code == 403


def test_customer_cannot_update_or_delete_a_product(
    client: TestClient, customer_headers: dict[str, str], product: Product
) -> None:
    assert (
        client.put(
            f"/api/products/{product.id}", json={"price": "0.01"}, headers=customer_headers
        ).status_code
        == 403
    )
    assert (
        client.delete(f"/api/products/{product.id}", headers=customer_headers).status_code == 403
    )


def test_customer_cannot_create_a_category(
    client: TestClient, customer_headers: dict[str, str]
) -> None:
    response = client.post("/api/categories", json={"name": "Nope"}, headers=customer_headers)
    assert response.status_code == 403


# --- Categories -------------------------------------------------------------


def test_admin_creates_category_with_derived_slug(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/api/categories",
        json={"name": "Home & Office", "description": "Desks and chairs"},
        headers=admin_headers,
    )
    assert response.status_code == 201
    assert response.json()["slug"] == "home-office"


def test_duplicate_category_name_is_rejected(
    client: TestClient, admin_headers: dict[str, str], category: Category
) -> None:
    response = client.post("/api/categories", json={"name": category.name}, headers=admin_headers)
    assert response.status_code == 409


def test_category_list_includes_active_product_counts(
    client: TestClient, category: Category, products: list[Product]
) -> None:
    body = client.get("/api/categories").json()
    entry = next(c for c in body if c["id"] == category.id)
    assert entry["product_count"] == len(products)


def test_get_category_by_slug(client: TestClient, category: Category) -> None:
    response = client.get(f"/api/categories/slug/{category.slug}")
    assert response.status_code == 200
    assert response.json()["id"] == category.id


def test_unknown_category_is_404(client: TestClient) -> None:
    assert client.get("/api/categories/999999").status_code == 404


def test_update_category(
    client: TestClient, admin_headers: dict[str, str], category: Category
) -> None:
    response = client.put(
        f"/api/categories/{category.id}", json={"name": "Renamed"}, headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


def test_category_in_use_cannot_be_deleted(
    client: TestClient, admin_headers: dict[str, str], category: Category, product: Product
) -> None:
    """Returns 409 rather than letting the RESTRICT foreign key become a 500."""
    response = client.delete(f"/api/categories/{category.id}", headers=admin_headers)
    assert response.status_code == 409


def test_empty_category_can_be_deleted(
    client: TestClient, admin_headers: dict[str, str], category: Category
) -> None:
    assert client.delete(f"/api/categories/{category.id}", headers=admin_headers).status_code == 200


# --- Product creation and validation ----------------------------------------


def test_admin_creates_product(
    client: TestClient, admin_headers: dict[str, str], category: Category
) -> None:
    response = client.post(
        "/api/products",
        json={
            "name": "Tessera Mechanical Keyboard",
            "price": "139.00",
            "stock_quantity": 12,
            "category_id": category.id,
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["slug"] == "tessera-mechanical-keyboard"
    # Money is a string, never a float.
    assert body["price"] == "139.00"
    assert isinstance(body["price"], str)


def test_price_keeps_two_decimals(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    """A whole-number price must not serialize as '10' or 10.0."""
    response = client.post(
        "/api/products", json={"name": "Round Number", "price": "10"}, headers=admin_headers
    )
    assert response.json()["price"] == "10.00"


def test_negative_price_is_rejected(client: TestClient, admin_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/products", json={"name": "Free Money", "price": "-5.00"}, headers=admin_headers
    )
    assert response.status_code == 422


def test_negative_stock_is_rejected(client: TestClient, admin_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/products",
        json={"name": "Impossible", "price": "5.00", "stock_quantity": -1},
        headers=admin_headers,
    )
    assert response.status_code == 422


def test_unknown_category_on_create_is_rejected(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/api/products",
        json={"name": "Orphan", "price": "5.00", "category_id": 999999},
        headers=admin_headers,
    )
    assert response.status_code == 422


def test_duplicate_names_get_distinct_slugs(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    first = client.post(
        "/api/products", json={"name": "Same Name", "price": "1.00"}, headers=admin_headers
    )
    second = client.post(
        "/api/products", json={"name": "Same Name", "price": "1.00"}, headers=admin_headers
    )
    assert first.json()["slug"] == "same-name"
    assert second.json()["slug"] == "same-name-2"


# --- Listing, filtering, sorting, pagination --------------------------------


def test_list_returns_pagination_envelope(client: TestClient, products: list[Product]) -> None:
    body = client.get("/api/products").json()
    assert set(body) == {"items", "total", "page", "size", "pages"}
    assert body["total"] == len(products)


def test_search_matches_name(client: TestClient, products: list[Product]) -> None:
    body = client.get("/api/products", params={"search": "keyboard"}).json()
    assert [item["name"] for item in body["items"]] == ["Alpha Keyboard"]


def test_search_matches_description(client: TestClient, products: list[Product]) -> None:
    body = client.get("/api/products", params={"search": "Gamma Headset description"}).json()
    assert body["total"] == 1


def test_search_is_case_insensitive(client: TestClient, products: list[Product]) -> None:
    assert client.get("/api/products", params={"search": "ALPHA"}).json()["total"] == 1


def test_filter_by_category_id(
    client: TestClient, category: Category, products: list[Product]
) -> None:
    body = client.get("/api/products", params={"category_id": category.id}).json()
    assert body["total"] == len(products)


def test_filter_by_category_slug(
    client: TestClient, category: Category, products: list[Product]
) -> None:
    body = client.get("/api/products", params={"category_slug": category.slug}).json()
    assert body["total"] == len(products)


def test_filter_by_price_range(client: TestClient, products: list[Product]) -> None:
    body = client.get("/api/products", params={"min_price": "80", "max_price": "150"}).json()
    assert sorted(item["price"] for item in body["items"]) == ["129.00", "89.50"]


def test_filter_in_stock_excludes_sold_out(client: TestClient, products: list[Product]) -> None:
    body = client.get("/api/products", params={"in_stock": True}).json()
    names = {item["name"] for item in body["items"]}
    assert "Beta Monitor" not in names  # stock_quantity == 0
    assert body["total"] == 3


def test_sort_by_price_is_numeric_not_lexicographic(
    client: TestClient, products: list[Product]
) -> None:
    """'199.00' sorts before '89.50' as text but must not as a number."""
    ascending = client.get("/api/products", params={"sort": "price_asc"}).json()
    prices = [Decimal(item["price"]) for item in ascending["items"]]
    assert prices == sorted(prices)
    assert prices[0] == Decimal("19.99")
    assert prices[-1] == Decimal("199.00")


def test_sort_by_price_descending(client: TestClient, products: list[Product]) -> None:
    body = client.get("/api/products", params={"sort": "price_desc"}).json()
    prices = [Decimal(item["price"]) for item in body["items"]]
    assert prices == sorted(prices, reverse=True)


def test_sort_by_name(client: TestClient, products: list[Product]) -> None:
    body = client.get("/api/products", params={"sort": "name_asc"}).json()
    names = [item["name"] for item in body["items"]]
    assert names == sorted(names)


def test_pagination_splits_results(client: TestClient, products: list[Product]) -> None:
    first = client.get("/api/products", params={"size": 2, "page": 1}).json()
    second = client.get("/api/products", params={"size": 2, "page": 2}).json()

    assert first["pages"] == 2
    assert len(first["items"]) == 2 and len(second["items"]) == 2
    # No overlap between pages.
    assert {i["id"] for i in first["items"]}.isdisjoint({i["id"] for i in second["items"]})


def test_page_size_is_capped(client: TestClient) -> None:
    assert client.get("/api/products", params={"size": 5000}).status_code == 422


def test_inactive_products_are_hidden_by_default(
    client: TestClient, db_session: Session, product: Product
) -> None:
    product.is_active = False
    db_session.commit()
    assert client.get("/api/products").json()["total"] == 0


# --- Detail, related --------------------------------------------------------


def test_get_product_includes_expanded_category(
    client: TestClient, product: Product, category: Category
) -> None:
    body = client.get(f"/api/products/{product.id}").json()
    assert body["category"]["name"] == category.name


def test_get_product_by_slug(client: TestClient, product: Product) -> None:
    response = client.get(f"/api/products/slug/{product.slug}")
    assert response.status_code == 200
    assert response.json()["id"] == product.id


def test_unknown_product_is_404(client: TestClient) -> None:
    assert client.get("/api/products/999999").status_code == 404
    assert client.get("/api/products/slug/nothing-here").status_code == 404


def test_related_products_exclude_the_product_itself(
    client: TestClient, products: list[Product]
) -> None:
    target = products[0]
    related = client.get(f"/api/products/{target.id}/related").json()
    assert target.id not in {item["id"] for item in related}


# --- Update and delete ------------------------------------------------------


def test_partial_update_leaves_other_fields_alone(
    client: TestClient, admin_headers: dict[str, str], product: Product
) -> None:
    original_name = product.name
    response = client.put(
        f"/api/products/{product.id}", json={"price": "59.99"}, headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["price"] == "59.99"
    assert response.json()["name"] == original_name


def test_delete_deactivates_by_default(
    client: TestClient, admin_headers: dict[str, str], product: Product
) -> None:
    assert client.delete(f"/api/products/{product.id}", headers=admin_headers).status_code == 200
    assert client.get("/api/products").json()["total"] == 0
    # Still fetchable directly, so existing links and orders keep working.
    assert client.get(f"/api/products/{product.id}").status_code == 200


def test_hard_delete_is_refused_once_the_product_has_been_ordered(
    client: TestClient,
    admin_headers: dict[str, str],
    db_session: Session,
    product: Product,
    customer_user: User,
) -> None:
    """Order history must stay readable, so the product cannot be erased."""
    order = Order(
        user_id=customer_user.id,
        total_amount=Decimal("49.95"),
        shipping_full_name="Test Customer",
        shipping_address_line1="1 Example Street",
        shipping_city="Pune",
        shipping_postal_code="411001",
        shipping_country="India",
    )
    db_session.add(order)
    db_session.flush()
    db_session.add(
        OrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.name,
            quantity=1,
            unit_price=product.price,
        )
    )
    db_session.commit()

    response = client.delete(
        f"/api/products/{product.id}", params={"hard": True}, headers=admin_headers
    )
    assert response.status_code == 409
