"""Registration, login, tokens and the current-user endpoint."""

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User, UserRole
from tests.conftest import CUSTOMER_EMAIL, CUSTOMER_PASSWORD


def test_register_creates_customer_and_returns_tokens(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "averysafepw1", "full_name": "New User"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["email"] == "new@example.com"
    assert body["user"]["role"] == "customer"
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]


def test_register_lowercases_email(client: TestClient, db_session: Session) -> None:
    client.post(
        "/api/auth/register",
        json={"email": "MiXeD@Example.Com", "password": "averysafepw1", "full_name": "Mixed Case"},
    )
    user = db_session.execute(
        select(User).where(User.email == "mixed@example.com")
    ).scalar_one_or_none()
    assert user is not None


def test_register_never_grants_admin(client: TestClient, db_session: Session) -> None:
    """Role must not be settable through the public registration endpoint."""
    client.post(
        "/api/auth/register",
        json={"email": "sneaky@example.com", "password": "averysafepw1", "full_name": "Sneaky User", "role": "admin"},
    )
    user = db_session.execute(
        select(User).where(User.email == "sneaky@example.com")
    ).scalar_one()
    assert user.role is UserRole.CUSTOMER


def test_register_stores_a_hash_not_the_password(
    client: TestClient, db_session: Session
) -> None:
    client.post(
        "/api/auth/register",
        json={"email": "hash@example.com", "password": "averysafepw1", "full_name": "Hash User"},
    )
    user = db_session.execute(select(User).where(User.email == "hash@example.com")).scalar_one()

    assert user.password_hash != "averysafepw1"
    assert user.password_hash.startswith("$2b$")


def test_register_requires_a_full_name(client: TestClient) -> None:
    """The name is mandatory; omitting it is a 422, not a null row."""
    response = client.post(
        "/api/auth/register",
        json={"email": "anon@example.com", "password": "averysafepw1"},
    )
    assert response.status_code == 422


def test_register_rejects_a_whitespace_only_full_name(client: TestClient) -> None:
    """A bare min_length would accept "   " and store a blank-looking name."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "blank@example.com",
            "password": "averysafepw1",
            "full_name": "   ",
        },
    )
    assert response.status_code == 422


def test_register_trims_the_full_name(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "padded@example.com",
            "password": "averysafepw1",
            "full_name": "  Padded Name  ",
        },
    )
    assert response.status_code == 201
    assert response.json()["user"]["full_name"] == "Padded Name"


def test_register_rejects_duplicate_email(client: TestClient, customer_user: User) -> None:
    response = client.post(
        "/api/auth/register",
        json={"email": CUSTOMER_EMAIL, "password": "averysafepw1", "full_name": "Duplicate User"},
    )
    assert response.status_code == 409


def test_register_rejects_invalid_email(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register", json={"email": "not-an-email", "password": "averysafepw1"}
    )
    assert response.status_code == 422


def test_register_rejects_short_password(client: TestClient) -> None:
    response = client.post("/api/auth/register", json={"email": "s@example.com", "password": "abc"})
    assert response.status_code == 422


def test_register_rejects_password_over_bcrypt_byte_limit(client: TestClient) -> None:
    """A Pydantic max_length counts characters; bcrypt's limit is 72 *bytes*."""
    response = client.post(
        "/api/auth/register",
        # 40 multi-byte characters = 120 bytes, well under any character limit.
        json={"email": "utf8@example.com", "password": "中" * 40},
    )
    assert response.status_code == 422
    assert "72 bytes" in response.json()["detail"]


def test_login_returns_tokens(client: TestClient, customer_user: User) -> None:
    response = client.post(
        "/api/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
    )
    assert response.status_code == 200
    assert response.json()["user"]["email"] == CUSTOMER_EMAIL


def test_login_rejects_wrong_password(client: TestClient, customer_user: User) -> None:
    response = client.post(
        "/api/auth/login", json={"email": CUSTOMER_EMAIL, "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_login_gives_identical_error_for_unknown_email(
    client: TestClient, customer_user: User
) -> None:
    """Identical responses stop the endpoint being used to enumerate accounts."""
    wrong_password = client.post(
        "/api/auth/login", json={"email": CUSTOMER_EMAIL, "password": "wrongpassword"}
    )
    unknown_email = client.post(
        "/api/auth/login", json={"email": "ghost@example.com", "password": "wrongpassword"}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json()["detail"] == unknown_email.json()["detail"]


def test_login_with_overlong_password_is_401_not_500(
    client: TestClient, customer_user: User
) -> None:
    """bcrypt raises above 72 bytes; that must not surface as a server error."""
    response = client.post(
        "/api/auth/login", json={"email": CUSTOMER_EMAIL, "password": "x" * 500}
    )
    assert response.status_code == 401


def test_login_rejects_disabled_account(
    client: TestClient, customer_user: User, db_session: Session
) -> None:
    customer_user.is_active = False
    db_session.commit()

    response = client.post(
        "/api/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
    )
    assert response.status_code == 403


def test_form_login_backs_the_swagger_authorize_button(
    client: TestClient, customer_user: User
) -> None:
    response = client.post(
        "/api/auth/token", data={"username": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
    )
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"


def test_me_returns_the_authenticated_user(
    client: TestClient, customer_headers: dict[str, str]
) -> None:
    response = client.get("/api/auth/me", headers=customer_headers)
    assert response.status_code == 200
    assert response.json()["email"] == CUSTOMER_EMAIL


def test_me_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_a_malformed_token(client: TestClient) -> None:
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert response.status_code == 401


def test_refresh_token_is_rejected_as_an_access_token(
    client: TestClient, customer_user: User
) -> None:
    """The single most important check here.

    Both tokens are signed with the same key and algorithm, so without the
    'type' claim assertion a 7-day refresh token would authenticate every
    request for a week.
    """
    tokens = client.post(
        "/api/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
    ).json()

    response = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {tokens['refresh_token']}"}
    )
    assert response.status_code == 401


def test_refresh_issues_a_new_token_pair(client: TestClient, customer_user: User) -> None:
    tokens = client.post(
        "/api/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
    ).json()

    response = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 200

    refreshed = response.json()
    assert refreshed["access_token"]
    # The new access token must actually work.
    me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {refreshed['access_token']}"}
    )
    assert me.status_code == 200


def test_refresh_rejects_an_access_token(client: TestClient, customer_user: User) -> None:
    tokens = client.post(
        "/api/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
    ).json()

    response = client.post("/api/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert response.status_code == 401


def test_update_own_profile(client: TestClient, customer_headers: dict[str, str]) -> None:
    response = client.patch(
        "/api/auth/me", json={"full_name": "Renamed Person"}, headers=customer_headers
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Renamed Person"
