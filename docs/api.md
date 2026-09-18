# API reference

Base URL: `http://localhost:8000`. All application endpoints are under `/api`.

Interactive docs: [`/docs`](http://localhost:8000/docs) ·
[`/redoc`](http://localhost:8000/redoc) ·
[`/openapi.json`](http://localhost:8000/openapi.json)

---

## Conventions

**Authentication.** Send `Authorization: Bearer <access_token>`. Access tokens last
30 minutes; refresh tokens last 7 days and are exchanged at `POST /api/auth/refresh`.
A refresh token is rejected anywhere an access token is expected.

**Money.** Every monetary value is a **string** with exactly two decimals
(`"49.95"`), never a JSON number. See
[decision 3](decisions.md#3-money-is-numeric102-serialized-as-a-string).

**Errors.** Every error returns the same shape:

```json
{ "detail": "Human-readable message" }
```

Validation failures (422) add a machine-readable list:

```json
{
  "detail": "email: value is not a valid email address",
  "errors": [{ "field": "email", "message": "value is not a valid email address" }]
}
```

Stack traces are never returned; unhandled errors are logged server-side and
answered with a generic 500.

**Status codes.**

| Code | Meaning here |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Request cannot be fulfilled (e.g. checking out an empty cart) |
| 401 | Missing, invalid or expired credentials |
| 403 | Authenticated but not permitted (customer attempting an admin action) |
| 404 | Not found, **or** not yours — ownership failures return 404 by design |
| 409 | Conflict: duplicate email or name, insufficient stock, illegal transition |
| 422 | Request body or query failed validation |

**Pagination.** List endpoints return an envelope:

```json
{ "items": [], "total": 35, "page": 1, "size": 12, "pages": 3 }
```

**Roles.** `customer` (default) and `admin`. Catalogue reads are public; catalogue
writes and order-status changes require `admin`.

---

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | — | Service banner |
| `GET` | `/health` | — | Liveness, including a database round-trip. 503 if the database is unreachable |

---

## Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Create a customer account and sign in |
| `POST` | `/api/auth/login` | — | Exchange email and password for tokens |
| `POST` | `/api/auth/token` | — | Form-encoded login backing Swagger's **Authorize** button |
| `POST` | `/api/auth/refresh` | — | Exchange a refresh token for a new pair |
| `GET` | `/api/auth/me` | user | Current user's profile |
| `PATCH` | `/api/auth/me` | user | Update own `full_name` |

### `POST /api/auth/register`

```json
{ "email": "you@example.com", "password": "atleast8chars", "full_name": "Optional" }
```

`201` returns `{ access_token, refresh_token, token_type, user }`.

The role is always `customer` — it cannot be set from the request body.
Passwords must be at least 8 characters and at most 72 **bytes** when UTF-8 encoded
(bcrypt's limit). `409` if the email is taken.

### `POST /api/auth/login`

```json
{ "email": "you@example.com", "password": "atleast8chars" }
```

`401` for both an unknown email and a wrong password, with identical messages, so the
endpoint cannot be used to enumerate accounts. `403` if the account is disabled.

### `POST /api/auth/token`

`application/x-www-form-urlencoded`, with the email sent as `username`. Exists so
`/docs` can authenticate without pasting a token by hand.

---

## Products

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/products` | — | Paginated, filterable catalogue |
| `GET` | `/api/products/{id}` | — | One product, with its category expanded |
| `GET` | `/api/products/slug/{slug}` | — | Same, by slug |
| `GET` | `/api/products/{id}/related` | — | Other active products in the same category |
| `POST` | `/api/products` | **admin** | Create |
| `PUT` | `/api/products/{id}` | **admin** | Partial update |
| `DELETE` | `/api/products/{id}` | **admin** | Deactivate, or hard-delete with `?hard=true` |

### `GET /api/products` query parameters

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | Case-insensitive match on name or description |
| `category_id` | int | — | Ignored when `category_slug` is given |
| `category_slug` | string | — | |
| `min_price` / `max_price` | decimal | — | Inclusive |
| `in_stock` | bool | — | `true` excludes sold-out products |
| `sort` | enum | `newest` | `newest`, `price_asc`, `price_desc`, `name_asc`, `name_desc` |
| `page` | int | `1` | |
| `size` | int | `12` | Max 100 |
| `include_inactive` | bool | `false` | For admin listings |

Price sorting is numeric, not lexicographic — `"89.50"` sorts below `"199.00"`.

### `POST /api/products`

```json
{
  "name": "Tessera Mechanical Keyboard",
  "description": "Hot-swappable 75% board",
  "price": "139.00",
  "stock_quantity": 12,
  "category_id": 4,
  "image_url": null,
  "is_active": true
}
```

The slug is derived from the name and de-duplicated with a `-2`, `-3` suffix.
`422` if `category_id` does not exist, or if price or stock is negative.

### `DELETE /api/products/{id}`

Soft-deletes by default (`is_active = false`), keeping order history readable. Add
`?hard=true` for a permanent delete, which returns `409` if the product appears in
any order.

---

## Categories

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/categories` | — | All categories with active product counts |
| `GET` | `/api/categories/{id}` | — | One category |
| `GET` | `/api/categories/slug/{slug}` | — | Same, by slug |
| `POST` | `/api/categories` | **admin** | Create. `409` on a duplicate name |
| `PUT` | `/api/categories/{id}` | **admin** | Partial update |
| `DELETE` | `/api/categories/{id}` | **admin** | `409` while products still reference it |

---

## Cart

Every cart endpoint requires authentication and is scoped to the caller. All of them
return the full cart, so the client never has to reconstruct it.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cart` | The caller's cart, created on first use |
| `POST` | `/api/cart/items` | Add a product, or increase quantity if already present |
| `PUT` | `/api/cart/items/{item_id}` | Set an exact quantity |
| `DELETE` | `/api/cart/items/{item_id}` | Remove one line |
| `DELETE` | `/api/cart` | Empty the cart |

```json
{
  "id": 1,
  "items": [
    {
      "id": 1,
      "product_id": 11,
      "quantity": 2,
      "product": { "...": "full product" },
      "line_total": "5798.00"
    }
  ],
  "total_items": 2,
  "subtotal": "5798.00"
}
```

Stock is validated against the **resulting** quantity, so repeated adds cannot
exceed what is on the shelf. `409` when they would, `404` for an unknown or inactive
product, and `404` for another user's cart item.

---

## Orders

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/orders` | user | Check out the caller's cart |
| `GET` | `/api/orders` | user | Paginated order history, newest first |
| `GET` | `/api/orders/{id}` | user | Full order detail |
| `POST` | `/api/orders/{id}/cancel` | user | Cancel and restock |
| `PATCH` | `/api/orders/{id}/status` | **admin** | Advance the lifecycle |

### `POST /api/orders`

```json
{
  "shipping_full_name": "Recipient Name",
  "shipping_address_line1": "24 Example Road",
  "shipping_address_line2": null,
  "shipping_city": "Pune",
  "shipping_postal_code": "411045",
  "shipping_country": "India",
  "shipping_phone": null,
  "notes": null
}
```

Contents come from the caller's cart; the request carries only delivery details. No
payment is taken and no card data is accepted.

Stock is decremented atomically and the cart is emptied in the same transaction.

- `400` — the cart is empty
- `409` — a product went inactive or ran out of stock between adding to the cart and
  checking out. Nothing is written: no order, no stock change, and the cart is left
  intact so the shopper can adjust it.

### Order lifecycle

```
PENDING ──> CONFIRMED ──> PROCESSING ──> SHIPPED ──> DELIVERED
   │            │              │
   └────────────┴──────────────┴──> CANCELLED
```

New orders start `PENDING`. Illegal transitions return `409` listing what is allowed.
`SHIPPED` and later cannot be cancelled. Cancelling returns every item to stock.

Customers may cancel their own orders; only admins may set any other status.
Requesting another user's order returns `404`.
