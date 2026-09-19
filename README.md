# Production-Grade E-Commerce Platform

A full-stack e-commerce platform built with FastAPI, React and PostgreSQL, structured
for a later move onto AWS.

**Status:** backend and storefront are complete and run locally. Cloud infrastructure
(Docker, Terraform, AWS, CI/CD, monitoring) is not started — see
[Roadmap](#roadmap).

---

## Contents

- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [PostgreSQL setup](#postgresql-setup)
- [Backend setup](#backend-setup)
- [Frontend setup](#frontend-setup)
- [Environment variables](#environment-variables)
- [Database migrations](#database-migrations)
- [Seed data and the admin account](#seed-data-and-the-admin-account)
- [Running the app](#running-the-app)
- [API documentation](#api-documentation)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Design notes](#design-notes)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Architecture

```
                   Browser
                      │
                      │  REST + JWT (Bearer)
                      ▼
        ┌─────────────────────────────┐
        │  Frontend — React 19 + Vite │
        │  TypeScript (strict)        │
        │  Tailwind CSS v4            │
        │  localhost:5173             │
        └──────────────┬──────────────┘
                       │  fetch, via a single API client
                       ▼
        ┌─────────────────────────────┐
        │  Backend — FastAPI          │
        │  ┌───────────────────────┐  │
        │  │ api/      routers     │  │
        │  │ schemas/  Pydantic    │  │
        │  │ services/ logic       │  │
        │  │ models/   SQLAlchemy  │  │
        │  │ core/     security    │  │
        │  └───────────────────────┘  │
        │  localhost:8000             │
        └──────────────┬──────────────┘
                       │  SQLAlchemy 2.0 ORM
                       ▼
        ┌─────────────────────────────┐
        │  PostgreSQL 18              │
        │  schema owned by Alembic    │
        └─────────────────────────────┘
```

Requests flow router → service → model. Routers handle HTTP concerns and validation,
services hold logic that spans more than one table (checkout is the substantial one),
and models own the schema. Pydantic schemas are the contract at the edge: nothing
reaches a client except through a declared response type.

More detail in [`docs/architecture.md`](docs/architecture.md); the reasoning behind
specific choices is logged in [`docs/decisions.md`](docs/decisions.md).

## Technology stack

| Layer | Choice | Version |
|---|---|---|
| Backend framework | FastAPI | 0.141.1 |
| ORM | SQLAlchemy | 2.0.54 |
| Migrations | Alembic | 1.20.0 |
| Database | PostgreSQL | 18 |
| Driver | psycopg2-binary | 2.9.13 |
| Validation / config | Pydantic, pydantic-settings | 2.13.5 / 2.15.0 |
| Password hashing | bcrypt | 5.0.0 |
| Tokens | PyJWT | 2.14.0 |
| Backend tests | pytest, httpx | 9.1.1 / 0.28.1 |
| Backend lint | ruff | 0.16.8 |
| Frontend framework | React | 19.2 |
| Build tool | Vite | 7.3.6 |
| Language | TypeScript (strict) | 6.0 |
| Styling | Tailwind CSS | 4.3.3 |
| Routing | react-router-dom | 7.18.4 |
| Frontend lint | oxlint | 1.83 |

## Prerequisites

- **Python 3.10+** (developed on 3.10.11)
- **Node.js 20.19+ or 22.12+** — see the note below
- **PostgreSQL 14+** (developed on 18), running locally
- **Git**

> **Node version.** Vite 8 and oxlint publish their native binaries with an
> `engines` floor of Node `>=22.12`. On Node 22.11 npm silently skips those
> optional binaries and the build fails with *"Cannot find native binding"*.
> This project therefore pins **Vite 7**, which is pure JavaScript and builds
> fine on 22.11. If you upgrade Node to 22.12+ you can move to Vite 8 with
> `npm install -D vite@latest @vitejs/plugin-react@latest`.

## PostgreSQL setup

Create the database and an application role. Run these as a superuser (`psql -U postgres`):

```sql
CREATE ROLE ecommerce WITH LOGIN PASSWORD 'choose-a-password';
CREATE DATABASE ecommerce_db OWNER ecommerce;
```

Optionally, let the test suite create its own database rather than falling back to a
schema inside `ecommerce_db`:

```sql
ALTER ROLE ecommerce CREATEDB;
```

This is not required — see [Testing](#testing).

## Backend setup

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows.  macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
```

Then edit `backend/.env`: set `DATABASE_URL`, and generate a signing key with

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

The application refuses to start if `SECRET_KEY` is missing or still the placeholder.

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
```

The default `VITE_API_URL=http://localhost:8000` matches the backend's default
`CORS_ORIGINS`, so no further changes are needed for local development.

## Environment variables

### `backend/.env`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `SECRET_KEY` | yes | — | JWT signing key. No default, by design |
| `TEST_DATABASE_URL` | no | `<DATABASE_URL>_test` | Database used by the test suite |
| `ALGORITHM` | no | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | no | `7` | Refresh token lifetime |
| `CORS_ORIGINS` | no | `http://localhost:5173,...` | Comma-separated allowed origins |
| `ENVIRONMENT` | no | `development` | Environment name |
| `SEED_ADMIN_EMAIL` | for seeding | — | Admin account created by the seed script |
| `SEED_ADMIN_PASSWORD` | for seeding | — | Admin password. No default |

### `frontend/.env`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VITE_API_URL` | no | `http://localhost:8000` | Backend base URL |

`.env` files are gitignored. `.env.example` is committed and should be updated
whenever a new variable is introduced.

## Database migrations

Alembic owns the schema — `Base.metadata.create_all()` is never called.

```bash
cd backend

.venv/Scripts/python -m alembic upgrade head          # apply all migrations
.venv/Scripts/python -m alembic revision --autogenerate -m "describe change"
.venv/Scripts/python -m alembic downgrade -1          # undo the last migration
.venv/Scripts/python -m alembic current               # show current revision
.venv/Scripts/python -m alembic check                 # detect model/schema drift
```

Always read an autogenerated migration before applying it.

## Seed data and the admin account

```bash
cd backend
.venv/Scripts/python -m app.seed            # insert anything missing (idempotent)
.venv/Scripts/python -m app.seed --reset    # wipe catalogue/carts/orders, then insert
```

This creates 6 categories (Electronics, Laptops, Smartphones, Tablets, Accessories,
Home & Office) and 35 products, each with a real product photo.

### Creating the first administrator

There is **no default admin account**. The seed script creates one from
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `backend/.env`, and refuses to run
that step if either is unset or still a placeholder.

1. Set both variables in `backend/.env`.
2. Run `python -m app.seed`.
3. Sign in at `/login`, or authorize at `/docs` using the **Authorize** button.

If the email already belongs to a customer, the script promotes that account to
admin rather than creating a duplicate. Self-registration through
`POST /api/auth/register` always produces a `customer`; the role cannot be set
from the request body.

Administrators can create, update and delete products and categories, and can
advance order status. Customers have read-only access to the catalogue. There is
no admin UI — administration is done through the API docs at `/docs`.

## Running the app

Two terminals.

**Backend** (http://localhost:8000):

```bash
cd backend
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

**Frontend** (http://localhost:5173):

```bash
cd frontend
npm run dev
```

Then open http://localhost:5173.

## API documentation

With the backend running:

- **Swagger UI** — http://localhost:8000/docs
- **ReDoc** — http://localhost:8000/redoc
- **OpenAPI schema** — http://localhost:8000/openapi.json

Endpoints are grouped under **Health**, **Authentication**, **Products**,
**Categories**, **Cart** and **Orders**. The **Authorize** button works: it posts to
`POST /api/auth/token` (send your email as `username`), so you can exercise
protected endpoints without pasting a token by hand.

A complete endpoint reference is in [`docs/api.md`](docs/api.md).

## Testing

```bash
cd backend
.venv/Scripts/python -m pytest              # 110 tests
.venv/Scripts/python -m pytest --cov=app    # with coverage
.venv/Scripts/python -m ruff check app tests
```

```bash
cd frontend
npm run lint          # oxlint
npx tsc -b            # type check
npm run build         # production build
```

Tests run against real PostgreSQL rather than SQLite, because the application
depends on `NUMERIC` semantics, `RETURNING` on `UPDATE`, and genuine transaction
isolation. The schema is built by running the Alembic migrations, so the migrations
themselves are exercised on every run.

If the application role has the `CREATEDB` privilege, the suite creates and uses a
separate `ecommerce_test_db`. If not, it falls back to a dedicated `ecommerce_test`
schema inside the existing database with `search_path` pinned to it — equally
isolated, and it prints how to enable the separate database if you would prefer one.
Either way, development data is never touched.

## Project structure

```
ecommerce-platform/
├── backend/
│   ├── alembic/
│   │   ├── versions/               # migration scripts
│   │   └── env.py                  # wired to Base.metadata and settings
│   ├── app/
│   │   ├── api/                    # routers: auth, products, categories, cart, orders
│   │   ├── core/
│   │   │   └── security.py         # hashing and JWT
│   │   ├── models/                 # SQLAlchemy models
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   ├── services/               # users, cart, checkout
│   │   ├── utils/                  # slug generation
│   │   ├── config.py               # typed settings
│   │   ├── database.py             # engine, session factory, Base, get_db
│   │   ├── dependencies.py         # DbDep, CurrentUserDep, AdminDep
│   │   ├── main.py                 # app, CORS, error handlers
│   │   └── seed.py                 # development seed data
│   ├── tests/                      # pytest suite (110 tests)
│   ├── alembic.ini
│   ├── pyproject.toml              # ruff and pytest configuration
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   ├── src/
│   │   ├── components/             # reusable components
│   │   │   └── ui/                 # Button, Input, Badge, Spinner, states
│   │   ├── context/                # AuthProvider, CartProvider
│   │   ├── hooks/                  # useAuth, useCart, useDebounced
│   │   ├── layouts/                # RootLayout
│   │   ├── pages/                  # one file per route
│   │   ├── services/               # api client and per-resource modules
│   │   ├── types/                  # API types
│   │   ├── utils/                  # money, dates, status formatting
│   │   ├── App.tsx                 # router
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.app.json           # strict TypeScript
│   └── vite.config.ts
├── docs/
│   ├── api.md                      # endpoint reference
│   ├── architecture.md             # system design
│   ├── decisions.md                # decision log
│   └── requirements.md
├── infrastructure/                 # (empty — AWS work not started)
└── README.md
```

## Design notes

A few choices worth knowing about before reading the code.

**Money is never a float.** Prices are `NUMERIC(10,2)` in the database, `Decimal` in
Python, and serialized to JSON as a **string** (`"49.95"`). FastAPI's
`jsonable_encoder` casts a bare `Decimal` to a float, so the guarantee comes from a
`PlainSerializer` on a shared `Money` type rather than from `response_model` alone.
The frontend treats prices as strings and formats them for display only.

**Checkout cannot oversell.** Stock is decremented with a conditional
`UPDATE ... WHERE stock_quantity >= :qty RETURNING price, name`. Under Postgres'
READ COMMITTED isolation the predicate is re-evaluated after the row lock is taken,
so a losing concurrent decrement matches zero rows and is rejected. Cart lines are
processed in `product_id` order to avoid deadlocking two overlapping checkouts. This
is covered by a test that races two real sessions for the last unit.

**Order history is immutable.** `OrderItem` snapshots both `unit_price` and
`product_name`, so renaming or repricing a product does not rewrite past orders.
Products are retired with `is_active = False`; a hard delete is refused once the
product appears in any order.

**Authentication.** Access and refresh tokens are signed with the same key, so every
token carries a `type` claim and `get_current_user` asserts it is `access` — without
that check a 7-day refresh token would authenticate every request for a week. Login
returns an identical 401 for an unknown email and a wrong password, so the endpoint
cannot be used to enumerate accounts.

## Known limitations

These are deliberate, and each has a clear upgrade path.

- **No payment processing.** Checkout is simulated; no card details are collected
  or stored. Orders are created directly in `PENDING`.
- **Checkout is not idempotent.** Double-clicking "Place order" could create two
  orders. The UI disables the button while submitting, which covers the realistic
  case; the real fix is a client-supplied `Idempotency-Key` with a unique column on
  `orders`.
- **Product photos are third-party demo assets.** The seeded catalogue points at
  the public [dummyjson](https://dummyjson.com) demo image CDN, which serves real
  product shots on clean backgrounds. They reference real brands and are not
  licensed for commercial use, so replace the catalogue with your own products
  and photography before any real deployment. The CDN rejects non-browser user
  agents (a plain `curl`/`urllib` fetch returns 403), which is fine for the
  frontend but worth knowing if you script against it. If the CDN is unreachable
  the UI falls back to a branded placeholder tile, so the grid never breaks.
- **No admin UI.** Administration happens through `/docs`.
- **Refresh tokens are not revocable.** There is no token store; signing out clears
  tokens client-side. Adding a `token_version` column to `users` would give
  server-side revocation cheaply.
- **No rate limiting** on login or registration.
- **Single-currency (USD) and no tax or shipping calculation.**
- **Email is never sent** — no verification, no password reset, no order confirmation.

## Roadmap

Completed:

1. Architecture and requirements
2. React + FastAPI + PostgreSQL running locally ← **you are here**

Planned:

3. Dockerize the stack
4. AWS VPC
5. Deploy the application
6. Terraform
7. CI/CD
8. Security hardening
9. Monitoring
10. Production hardening
