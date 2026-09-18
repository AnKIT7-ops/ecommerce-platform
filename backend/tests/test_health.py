"""Service and database liveness."""

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session


def test_root_returns_service_banner(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "running"
    assert body["docs"] == "/docs"


def test_health_reports_database_connected(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "database": "connected"}


def test_database_is_reachable(db_session: Session) -> None:
    assert db_session.execute(text("SELECT 1")).scalar_one() == 1


def test_openapi_schema_is_served(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()

    assert "/api/auth/login" in schema["paths"]
    assert "/api/products" in schema["paths"]
    assert "/api/cart" in schema["paths"]
    assert "/api/orders" in schema["paths"]


def test_swagger_docs_render(client: TestClient) -> None:
    response = client.get("/docs")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_endpoints_are_grouped_by_tag(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    tags = {
        tag
        for operations in schema["paths"].values()
        for operation in operations.values()
        for tag in operation.get("tags", [])
    }
    assert {"Authentication", "Products", "Categories", "Cart", "Orders"} <= tags
