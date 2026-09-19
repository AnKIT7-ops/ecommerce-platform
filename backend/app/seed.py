"""Development seed data.

Run with::

    python -m app.seed          # insert anything missing
    python -m app.seed --reset  # wipe catalogue/orders first, then insert

Idempotent: products and categories are matched by slug, so re-running updates
nothing and inserts only what is absent.

The admin account is created from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. There
is deliberately no fallback: a hardcoded default admin credential is exactly the
kind of thing that survives into a deployed environment.
"""

from __future__ import annotations

import argparse
import sys
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models import Category, Product, User, UserRole
from app.services.users import get_user_by_email
from app.utils.slug import slugify

CATEGORIES: list[tuple[str, str]] = [
    ("Electronics", "Audio, wearables and everyday electronics."),
    ("Laptops", "Ultrabooks, workstations and everything in between."),
    ("Smartphones", "Flagship and mid-range handsets with full warranties."),
    ("Tablets", "Slates for reading, drawing and getting light work done."),
    ("Accessories", "Chargers, cases, mounts and the small things that matter."),
    ("Home & Office", "Seating, lighting and workspace essentials."),
]

# Product photography comes from the public dummyjson demo dataset, which serves
# real product shots on clean backgrounds, so the storefront reads as a store
# rather than a wireframe. Every URL below was fetched and confirmed to return a
# distinct 1000x1000 image.
#
# These are third-party demo assets referencing real brands. Replace the
# catalogue with your own products and photography before any real use. If the
# CDN is unreachable the frontend falls back to a branded placeholder tile, so
# the grid never breaks.
_CDN = "https://cdn.dummyjson.com/product-images"

# (name, category, price, stock, description, image_url)
PRODUCTS: list[tuple[str, str, str, int, str, str]] = [
    # --- Electronics ---
    ("Apple AirPods Max Silver", "Electronics", "549.99", 59,
     "Over-ear headphones with adaptive noise cancellation and a case that "
     "actually protects them. Twenty hours on a charge.",
     f"{_CDN}/mobile-accessories/apple-airpods-max-silver/1.webp"),
    ("Apple AirPods", "Electronics", "129.99", 67,
     "True-wireless earbuds with a charging case that survives a day of "
     "meetings and still has room left.",
     f"{_CDN}/mobile-accessories/apple-airpods/1.webp"),
    ("Beats Flex Wireless Earphones", "Electronics", "49.99", 50,
     "Neckband earphones with magnetic buds that pause playback the moment you "
     "unclip them.",
     f"{_CDN}/mobile-accessories/beats-flex-wireless-earphones/1.webp"),
    ("Apple Watch Series 4 Gold", "Electronics", "349.99", 33,
     "Always-on display, GPS and continuous heart-rate tracking, with a battery "
     "that lasts past bedtime.",
     f"{_CDN}/mobile-accessories/apple-watch-series-4-gold/1.webp"),
    ("Amazon Echo Plus", "Electronics", "99.99", 61,
     "Smart speaker with a built-in hub, so lights and plugs pair without a "
     "second bridge cluttering the shelf.",
     f"{_CDN}/mobile-accessories/amazon-echo-plus/1.webp"),
    ("Apple HomePod Mini Cosmic Grey", "Electronics", "99.99", 27,
     "Pocket-sized speaker with surprisingly honest mids and room-sensing "
     "playback.",
     f"{_CDN}/mobile-accessories/apple-homepod-mini-cosmic-grey/1.webp"),
    ("TV Studio Camera Pedestal", "Electronics", "499.99", 15,
     "Counterbalanced pedestal for studio cameras. Smooth vertical travel, and "
     "it locks solid when you need it to.",
     f"{_CDN}/mobile-accessories/tv-studio-camera-pedestal/1.webp"),

    # --- Laptops ---
    ("Apple MacBook Pro 14 Inch Space Grey", "Laptops", "1999.99", 24,
     "14-inch display, machined aluminium chassis, and a battery that genuinely "
     "lasts a working day.",
     f"{_CDN}/laptops/apple-macbook-pro-14-inch-space-grey/1.webp"),
    ("Asus Zenbook Pro Dual Screen Laptop", "Laptops", "1799.99", 45,
     "A second display above the keyboard for timelines and tool palettes, plus "
     "a discrete GPU for rendering.",
     f"{_CDN}/laptops/asus-zenbook-pro-dual-screen-laptop/1.webp"),
    ("New DELL XPS 13 9300 Laptop", "Laptops", "1499.99", 74,
     "A near-borderless 13-inch screen in a chassis small enough for a tray "
     "table.",
     f"{_CDN}/laptops/new-dell-xps-13-9300-laptop/1.webp"),
    ("Huawei Matebook X Pro", "Laptops", "1399.99", 75,
     "Fanless ultraportable with a 3:2 panel that shows more of a document than "
     "a widescreen does.",
     f"{_CDN}/laptops/huawei-matebook-x-pro/1.webp"),
    ("Lenovo Yoga 920", "Laptops", "1099.99", 40,
     "Converts to a tablet through 360 degrees, on a hinge rated for the abuse "
     "that implies.",
     f"{_CDN}/laptops/lenovo-yoga-920/1.webp"),

    # --- Smartphones ---
    ("iPhone 13 Pro", "Smartphones", "1099.99", 56,
     "Triple camera system and a ProMotion display, built well enough to still "
     "be worth using in four years.",
     f"{_CDN}/smartphones/iphone-13-pro/1.webp"),
    ("iPhone X", "Smartphones", "899.99", 37,
     "The edge-to-edge design that set the template for everything after it. "
     "Still a capable handset.",
     f"{_CDN}/smartphones/iphone-x/1.webp"),
    ("Samsung Galaxy S10", "Smartphones", "699.99", 19,
     "Flagship chip, expandable storage and a headphone jack, which is rarer "
     "than it should be.",
     f"{_CDN}/smartphones/samsung-galaxy-s10/1.webp"),
    ("Samsung Galaxy S8", "Smartphones", "499.99", 0,
     "Curved display in a body narrow enough for one hand. Currently out of "
     "stock.",
     f"{_CDN}/smartphones/samsung-galaxy-s8/1.webp"),
    ("Vivo X21", "Smartphones", "499.99", 7,
     "In-display fingerprint reader and an AMOLED panel that stays readable "
     "outdoors.",
     f"{_CDN}/smartphones/vivo-x21/1.webp"),
    ("Oppo F19 Pro Plus", "Smartphones", "399.99", 78,
     "Mid-range handset with fast charging that takes it from empty to usable "
     "over a coffee.",
     f"{_CDN}/smartphones/oppo-f19-pro-plus/1.webp"),
    ("Realme XT", "Smartphones", "349.99", 80,
     "Large sensor, larger battery, and a price that leaves room for a case.",
     f"{_CDN}/smartphones/realme-xt/1.webp"),
    ("Realme C35", "Smartphones", "149.99", 48,
     "Entry-level handset with a battery that genuinely lasts two days of light "
     "use.",
     f"{_CDN}/smartphones/realme-c35/1.webp"),

    # --- Tablets ---
    ("Samsung Galaxy Tab S8 Plus Grey", "Tablets", "599.99", 62,
     "Large AMOLED slate with a pen in the box and a keyboard cover worth "
     "buying.",
     f"{_CDN}/tablets/samsung-galaxy-tab-s8-plus-grey/1.webp"),
    ("iPad Mini 2021 Starlight", "Tablets", "499.99", 47,
     "Small enough to hold one-handed for an hour, fast enough to edit on.",
     f"{_CDN}/tablets/ipad-mini-2021-starlight/1.webp"),
    ("Samsung Galaxy Tab White", "Tablets", "349.99", 92,
     "A straightforward tablet for reading, streaming and video calls.",
     f"{_CDN}/tablets/samsung-galaxy-tab-white/1.webp"),

    # --- Accessories ---
    ("Apple MagSafe Battery Pack", "Accessories", "99.99", 1,
     "Snaps on magnetically and tops a phone back up without a cable trailing "
     "off the desk.",
     f"{_CDN}/mobile-accessories/apple-magsafe-battery-pack/1.webp"),
    ("Apple Airpower Wireless Charger", "Accessories", "79.99", 1,
     "Charges a phone, a watch and earbuds from one mat, in any orientation.",
     f"{_CDN}/mobile-accessories/apple-airpower-wireless-charger/1.webp"),
    ("iPhone 12 Silicone Case with MagSafe Plum", "Accessories", "29.99", 69,
     "Soft-touch silicone with a microfibre lining and magnets aligned for the "
     "charger.",
     f"{_CDN}/mobile-accessories/iphone-12-silicone-case-with-magsafe-plum/1.webp"),
    ("Apple iPhone Charger", "Accessories", "19.99", 31,
     "The plug you will eventually need a second of. Keep one in the bag.",
     f"{_CDN}/mobile-accessories/apple-iphone-charger/1.webp"),
    ("Monopod", "Accessories", "19.99", 48,
     "Single-leg support for long lenses. Takes the weight without the "
     "footprint of a tripod.",
     f"{_CDN}/mobile-accessories/monopod/1.webp"),
    ("Selfie Lamp with iPhone", "Accessories", "14.99", 58,
     "Clip-on ring light with three colour temperatures, for calls in rooms "
     "with bad lighting.",
     f"{_CDN}/mobile-accessories/selfie-lamp-with-iphone/1.webp"),
    ("Selfie Stick Monopod", "Accessories", "12.99", 11,
     "Extends to just over a metre and folds down to pocket length.",
     f"{_CDN}/mobile-accessories/selfie-stick-monopod/1.webp"),

    # --- Home & Office ---
    ("Knoll Saarinen Executive Conference Chair", "Home & Office", "499.99", 26,
     "A real lumbar shape rather than a padded rectangle, rated for full "
     "working days.",
     f"{_CDN}/furniture/knoll-saarinen-executive-conference-chair/1.webp"),
    ("Bedside Table African Cherry", "Home & Office", "299.99", 64,
     "Solid timber with one soft-close drawer, at a height that suits a desk "
     "surround.",
     f"{_CDN}/furniture/bedside-table-african-cherry/1.webp"),
    ("Table Lamp", "Home & Office", "49.99", 9,
     "Weighted base and a genuinely useful arm. The light lands on the desk, "
     "not the screen.",
     f"{_CDN}/home-decoration/table-lamp/1.webp"),
    ("House Showpiece Plant", "Home & Office", "39.99", 28,
     "A plant that survives a home office, with no watering schedule to forget.",
     f"{_CDN}/home-decoration/house-showpiece-plant/1.webp"),
    ("Plant Pot", "Home & Office", "14.99", 59,
     "Glazed ceramic with a drainage hole and a saucer that matches.",
     f"{_CDN}/home-decoration/plant-pot/1.webp"),
]

CATALOGUE_TABLES = (
    "order_items",
    "orders",
    "cart_items",
    "carts",
    "products",
    "categories",
)


def seed_admin(db: Session) -> User | None:
    """Create the administrator from the environment, or explain why it cannot."""
    email = settings.seed_admin_email.strip()
    password = settings.seed_admin_password

    if not email or not password:
        print(
            "  ! SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set - skipping admin "
            "creation.\n"
            "    Set them in backend/.env and re-run. There is no default admin account."
        )
        return None

    if password.startswith("CHANGE_ME"):
        print("  ! SEED_ADMIN_PASSWORD is still the placeholder value - skipping admin.")
        return None

    existing = get_user_by_email(db, email)
    if existing:
        if existing.role is not UserRole.ADMIN:
            existing.role = UserRole.ADMIN
            db.commit()
            print(f"  = promoted existing user {email} to admin")
        else:
            print(f"  = admin {email} already exists")
        return existing

    admin = User(
        email=email.lower(),
        password_hash=hash_password(password),
        full_name="Store Administrator",
        role=UserRole.ADMIN,
    )
    db.add(admin)
    db.commit()
    print(f"  + created admin {email}")
    return admin


def seed_categories(db: Session) -> dict[str, Category]:
    by_name: dict[str, Category] = {}
    created = 0

    for name, description in CATEGORIES:
        slug = slugify(name)
        category = db.execute(
            select(Category).where(Category.slug == slug)
        ).scalar_one_or_none()

        if category is None:
            category = Category(name=name, slug=slug, description=description)
            db.add(category)
            created += 1
        by_name[name] = category

    db.commit()
    print(f"  + {created} categories created, {len(CATEGORIES) - created} already present")
    return by_name


def seed_products(db: Session, categories: dict[str, Category]) -> None:
    created = 0

    for name, category_name, price, stock, description, image_url in PRODUCTS:
        slug = slugify(name)
        if db.execute(select(Product).where(Product.slug == slug)).scalar_one_or_none():
            continue

        db.add(
            Product(
                name=name,
                slug=slug,
                description=description,
                price=Decimal(price),
                stock_quantity=stock,
                category_id=categories[category_name].id,
                image_url=image_url,
                is_active=True,
            )
        )
        created += 1

    db.commit()
    print(f"  + {created} products created, {len(PRODUCTS) - created} already present")


def reset_catalogue(db: Session) -> None:
    """Wipe catalogue, carts and orders. Leaves user accounts alone."""
    db.execute(text(f"TRUNCATE {', '.join(CATALOGUE_TABLES)} RESTART IDENTITY CASCADE"))
    db.commit()
    print("  - catalogue, carts and orders truncated")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed development data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Truncate catalogue, carts and orders before seeding (user accounts are kept).",
    )
    args = parser.parse_args()

    print(f"Seeding {settings.environment} database...")

    with SessionLocal() as db:
        if args.reset:
            reset_catalogue(db)
        seed_admin(db)
        categories = seed_categories(db)
        seed_products(db, categories)

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
