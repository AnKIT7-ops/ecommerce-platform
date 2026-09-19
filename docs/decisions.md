# Decision log

Choices that were not obvious, and why they were made. Newest last.

---

## 1. Alembic owns the schema, not `create_all()`

`Base.metadata.create_all()` is never called. Every table comes from a migration, and
the test suite builds its schema by running `alembic upgrade head`, so the migrations
are exercised on every test run rather than assumed correct.

`alembic/env.py` reads the database URL from application settings rather than from
`alembic.ini`. The URL is deliberately **not** pushed through
`config.set_main_option()`, because that path runs configparser interpolation and a
`%` in a password raises there.

`compare_type=True` is enabled so autogenerate notices `Numeric` precision and
`String` length changes, which it otherwise drops silently.

## 2. Enums are `VARCHAR + CHECK`, not native PostgreSQL enums

`User.role` and `Order.status` use `Enum(..., native_enum=False, create_constraint=True)`.

Native PG enums break Alembic autogenerate in three specific ways:

- adding a value to the Python enum produces **no migration at all**, so the drift is
  silent until an `INSERT` fails;
- `drop_table` in a downgrade does not drop the `TYPE`, so re-running the upgrade
  fails with *"type already exists"*;
- `op.add_column` with an enum does not emit `CREATE TYPE`, so it has to be
  hand-written.

`VARCHAR(20) + CHECK` gives the same database-level integrity and the same Python
round-trip, and adding a status becomes one ordinary migration.

## 3. Money is `NUMERIC(10,2)`, serialized as a string

Floats are never used for money. Prices are `NUMERIC(10,2)` in Postgres and `Decimal`
in Python.

They leave the API as JSON **strings** (`"49.95"`). Two reasons:

- FastAPI's `jsonable_encoder` casts a bare `Decimal` to a `float`, so any endpoint
  not passing through a declared response type would silently emit a float. The
  guarantee lives in a `PlainSerializer` on a shared `Money` annotated type, making
  it independent of which serialization path runs.
- A JSON number becomes an IEEE-754 double in the browser, where `19.99 * 3` is
  `59.97000000000001`. A string makes the frontend's handling explicit, and the
  `f"{v:.2f}"` format guarantees `"10.00"` rather than `"10"`.

The alternative, integer cents, is equally correct but makes every hand-read SQL
query worse.

## 4. `bcrypt` directly, not `passlib`

`passlib` 1.7.4 is unmaintained and breaks against `bcrypt >= 4.1` (it reads the
removed `bcrypt.__about__`). Using `bcrypt` directly is a handful of lines.

Two consequences, both handled:

- bcrypt's 72-byte ceiling counts **bytes**, not characters, so a 40-character CJK
  password exceeds it while passing any `max_length` check. Request schemas validate
  `len(password.encode("utf-8")) <= 72` so the client gets a clean 422.
- bcrypt `>= 4.1` **raises** on an over-long password instead of truncating, and that
  applies to `checkpw` as well. `verify_password` therefore catches
  `(ValueError, TypeError)` and returns `False`, so posting a 200-character password
  to `/login` is a 401 rather than a 500.

SHA-256 pre-hashing was rejected: 72 bytes is plenty, and the pre-hash is a footgun
that has to be documented forever.

## 5. PyJWT, with a mandatory `type` claim

`python-jose` is unmaintained with open CVEs; PyJWT is the maintained choice.

Access and refresh tokens are signed with the same key and algorithm, so every token
carries `type: "access" | "refresh"` and `get_current_user` asserts it is `access`.
Without that check, a 7-day refresh token would authenticate every request for a
week. Both directions are covered by tests.

`sub` is always `str(user.id)` — the spec requires a string, and consumers choke on
an integer.

No refresh-token table, no `jti`/`aud`/`iss`: one service, no audience to
distinguish, and revocation is not a requirement yet. Adding a `token_version`
column to `users` would provide revocation later at the cost of one comparison.

## 6. Role-based access control via `User.role`

The original `User` model had no notion of privilege. A `role` column
(`customer` default, `admin`) was added rather than a boolean, so staff or manager
tiers can be introduced without another migration of the same column.

Reads of products and categories are public. Every write requires
`role == "admin"`, enforced by a `require_admin` dependency. Self-registration always
produces a `customer`; the field is absent from `UserCreate`, so it cannot be set
from the request body. A test asserts this.

There is no admin UI — administration goes through `/docs`.

## 7. The cart is server-side and requires sign-in

`Cart` is 1:1 with `User`, so it could have been folded into
`cart_items(user_id, product_id, quantity)`. It was kept as its own table to match
the specified data model and to leave room for guest carts keyed by session later.

A signed-out visitor clicking "Add to cart" is sent to `/login` and returned to the
same product afterwards. The alternative — a localStorage guest cart merged on
sign-in — needs a merge endpoint, conflict rules (sum or replace quantities?) and
stock re-validation at merge time, none of which is warranted yet.

## 8. Checkout uses a conditional UPDATE, not `SELECT ... FOR UPDATE`

```sql
UPDATE products SET stock_quantity = stock_quantity - :qty
WHERE id = :id AND is_active AND stock_quantity >= :qty
RETURNING price, name
```

Under READ COMMITTED, Postgres re-evaluates the `WHERE` predicate after acquiring the
row lock, so a losing concurrent decrement matches zero rows and is rejected. That is
the same guarantee as `SELECT ... FOR UPDATE` without a separate locking step that a
future code path could forget to take. `RETURNING` reads the price under the same
lock, so a concurrent price edit cannot skew the order total.

Cart lines are processed in `product_id` order. Two shoppers with overlapping carts
would otherwise take row locks in opposite orders and deadlock.

The whole checkout is one transaction: `flush()` to obtain `order.id`, then a single
`commit()` at the end. Anything raised in between leaves the session dirty and
`get_db()`'s teardown rolls it all back, so there are no partial orders and no stock
decremented for an order that never existed. The cart is cleared inside the same
transaction, so a failed checkout leaves it intact for the shopper to adjust.

Verified by a test that races two real sessions for the last unit of stock.

**Known ceiling:** checkout is not idempotent. Double-clicking "Place order" could
create two orders. The UI disables the button while submitting; the real fix is a
client-supplied `Idempotency-Key` with a unique column on `orders`.

## 9. `OrderItem` snapshots the product name

`unit_price` was always going to be snapshotted. `product_name` is snapshotted too,
because otherwise renaming a product rewrites every historical order, and the column
cannot be backfilled after the fact.

For the same reason `order_items.product_id` is `ondelete="RESTRICT"` and products
are retired with `is_active = False`. A hard delete is refused with a 409 once the
product appears in any order.

## 10. `get_db()` does not commit or roll back

`Session.close()` already rolls back any pending transaction and returns the
connection to the pool. Adding a `commit()` to the dependency would persist
half-finished work whenever a handler raised. Services commit explicitly when their
unit of work is complete.

`expire_on_commit=False` is set on the session factory so FastAPI serializing a
response after commit does not trigger a full re-SELECT of every attribute.

## 11. Ownership checks return 404, not 403

Requesting another user's order or cart item returns **404**. A 403 would confirm
that the id exists, which is an enumeration oracle. The resource simply does not
exist as far as that caller is concerned.

## 12. Tests run against real PostgreSQL, with a schema fallback

SQLite does not faithfully reproduce `NUMERIC` semantics, `RETURNING` on `UPDATE`, or
transaction isolation, all of which this application depends on.

Per-test isolation uses SQLAlchemy 2.0's `join_transaction_mode="create_savepoint"`,
set explicitly rather than relying on the `conditional_savepoint` default. Application
code commits freely; those commits land on a savepoint and the fixture's outer
rollback still discards everything.

The `get_db` override rolls back at teardown, mirroring what `session.close()` does
in production. Without it, rows flushed by a failed request stayed visible to the
next request inside the same transaction, and a rolled-back write was
indistinguishable from a persisted one.

The concurrency test **cannot** use that fixture — two sessions pinned to one
connection serialize, so the race under test cannot occur. It uses real independent
sessions and cleans up with `TRUNCATE ... RESTART IDENTITY CASCADE`.

The application role here (`ecommerce`) is least-privilege and lacks `CREATEDB`, so
the suite falls back to a dedicated `ecommerce_test` schema with `search_path` pinned
to it. That is equally isolated; it prints the `ALTER ROLE ... CREATEDB` command if a
separate database is preferred.

## 13. Vite pinned to 7.x

Vite 8 (rolldown) and oxlint publish native binaries with an `engines` floor of Node
`>=22.12`. This machine runs Node 22.11, where npm silently skips those optional
binaries and the build dies with *"Cannot find native binding"*. Reinstalling from
scratch does not help — the gate is the engines field, not a corrupt install.

Vite 7 is pure JavaScript (rollup) and builds cleanly. oxlint's binding was installed
explicitly with `--force`. Upgrading Node to 22.12+ removes the constraint entirely.

## 14. Filter state lives in the URL

The catalogue reads search, category, price bounds, availability, sort and page from
the query string rather than component state. Every view is then shareable and the
back button behaves the way shoppers expect. Typing is debounced before it reaches
the URL so a keystroke does not produce a history entry.

## 15. Catalogue shaped around available product photography

The catalogue was originally invented (six categories including Gaming, 35 made-up
products) and shipped without images, because pointing at a random stock-photo
service produced a forest for a desk lamp, which reads as a bug rather than a
placeholder.

A keyword-matched service was tried next. It gets the subject right but returns
amateur photography: the laptop listing showed a cat sitting beside a MacBook.

The catalogue was therefore reshaped around a source of genuine product shots
(the public dummyjson demo CDN, clean backgrounds, 1000x1000). That source has
no gaming gear, so **Gaming was replaced by Tablets**; the rest of the categories
survived. Product names and images now come from that dataset, while prices,
stock levels and all copy remain ours.

Two consequences worth knowing:

- The images reference real brands and are demo assets, not licensed product
  photography. They must be replaced before any real deployment.
- The CDN rejects non-browser user agents, so a plain `curl` or `urllib` fetch
  returns 403 while the browser loads them fine. Any script that validates these
  URLs has to send a browser `User-Agent`.

`ProductImage` still falls back to a deterministic tinted tile with the product's
initials whenever `image_url` is null or the request fails, so an offline or
blocked CDN degrades to something that looks intentional rather than broken.

## 16. Pagination envelope fixed early

`GET /api/products` and `GET /api/orders` return
`{items, total, page, size, pages}` rather than a bare list. Retrofitting an envelope
changes the response shape and breaks every client call site simultaneously, so it
was decided before the frontend existed.
