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
    ("Electronics", "Audio, wearables, cameras and everyday electronics."),
    ("Laptops", "Ultrabooks, workstations and everything in between."),
    ("Smartphones", "Flagship and mid-range handsets with full warranties."),
    ("Accessories", "Cables, chargers, stands and the small things that matter."),
    ("Gaming", "Consoles, controllers and gear built for long sessions."),
    ("Home & Office", "Desks, chairs, lighting and workspace essentials."),
]

# (name, category, price, stock, description)
PRODUCTS: list[tuple[str, str, str, int, str]] = [
    # --- Electronics ---
    ("Aurora Noise-Cancelling Headphones", "Electronics", "249.00", 42,
     "Over-ear headphones with adaptive noise cancellation, 40-hour battery life "
     "and a folding travel case."),
    ("Pulse Wireless Earbuds", "Electronics", "119.50", 130,
     "Compact true-wireless earbuds with a wireless charging case and IPX5 water "
     "resistance."),
    ("Nimbus Smartwatch Series 5", "Electronics", "329.00", 27,
     "AMOLED always-on display, multi-day battery, GPS and continuous heart-rate "
     "tracking."),
    ("Vista 4K Action Camera", "Electronics", "279.99", 18,
     "Shoots 4K60 with in-body stabilisation, waterproof to 10 metres without a "
     "housing."),
    ("EchoBar Bluetooth Speaker", "Electronics", "89.00", 64,
     "Pocket-sized speaker with surprisingly honest mids and 18 hours of playback."),
    ("Lumen Smart LED Bulb (4-pack)", "Electronics", "44.95", 0,
     "Sixteen million colours, scheduling and voice assistant support. Currently "
     "out of stock."),

    # --- Laptops ---
    ("Meridian Pro 14 Ultrabook", "Laptops", "1899.00", 12,
     "14-inch 3K display, 32GB RAM, 1TB NVMe. Machined aluminium chassis under "
     "1.3kg."),
    ("Meridian Air 13", "Laptops", "1149.00", 25,
     "Fanless 13-inch ultraportable with a genuine all-day battery and 16GB RAM."),
    ("Forge 16 Creator Workstation", "Laptops", "2499.00", 7,
     "16-inch colour-accurate panel, discrete GPU and a 99Wh battery for on-location "
     "editing."),
    ("Cadet 15 Everyday Laptop", "Laptops", "649.00", 48,
     "Reliable 15-inch machine for study and office work. 512GB storage, 16GB RAM."),
    ("Forge 17 Desktop Replacement", "Laptops", "2899.00", 4,
     "Seventeen inches of workstation-class performance with a mechanical keyboard."),

    # --- Smartphones ---
    ("Halo X6 Pro", "Smartphones", "1099.00", 33,
     "6.7-inch LTPO display, triple camera system and four years of OS updates."),
    ("Halo X6", "Smartphones", "799.00", 55,
     "The flagship camera stack in a smaller, one-hand-friendly 6.1-inch body."),
    ("Halo Lite 3", "Smartphones", "349.00", 88,
     "Mid-range handset with a 5000mAh battery that genuinely lasts two days."),
    ("Orbit Fold 2", "Smartphones", "1699.00", 6,
     "Book-style foldable with a crease-minimised inner display and desktop mode."),
    ("Nova Compact 5", "Smartphones", "529.00", 41,
     "A small phone that does not compromise: flagship chip, 6.0-inch screen."),

    # --- Accessories ---
    ("Anchor 100W GaN Charger", "Accessories", "59.99", 210,
     "Charges a laptop and two phones at once from a plug barely larger than a "
     "matchbox."),
    ("Braided USB-C Cable 2m", "Accessories", "18.50", 340,
     "240W-rated braided cable with a ten-thousand-bend tested strain relief."),
    ("Summit Laptop Stand", "Accessories", "74.00", 76,
     "Machined aluminium stand that lifts a 16-inch laptop to eye level."),
    ("Drift Wireless Mouse", "Accessories", "49.95", 150,
     "Silent switches, 8000 DPI sensor and a rechargeable cell rated for 70 days."),
    ("Tessera Mechanical Keyboard", "Accessories", "139.00", 61,
     "Hot-swappable 75% board with gasket mounting and PBT double-shot keycaps."),
    ("Vault 20000mAh Power Bank", "Accessories", "69.00", 94,
     "Two USB-C ports, 65W output and a display showing real remaining capacity."),
    ("Shield Privacy Screen 14\"", "Accessories", "34.99", 0,
     "Magnetic privacy filter for 14-inch laptops. Restocking shortly."),

    # --- Gaming ---
    ("Vector Pro Controller", "Gaming", "79.99", 105,
     "Hall-effect sticks that do not drift, four remappable paddles and a 40-hour "
     "battery."),
    ("Apex Gaming Headset", "Gaming", "159.00", 38,
     "Low-latency wireless with a broadcast-quality detachable boom microphone."),
    ("Nexus Handheld Console", "Gaming", "549.00", 15,
     "Seven-inch 120Hz VRR display, full desktop OS and a genuinely serviceable "
     "battery."),
    ("Raptor RGB Mousepad XL", "Gaming", "39.50", 180,
     "900x400mm cloth surface with a stitched edge and a micro-textured weave."),
    ("Bastion Gaming Chair", "Gaming", "429.00", 21,
     "Four-dimensional armrests, a real lumbar mechanism and a 12-year gas lift."),
    ("Flux Racing Wheel", "Gaming", "329.00", 9,
     "Direct-drive wheelbase with 8Nm of torque and a quick-release rim."),

    # --- Home & Office ---
    ("Atlas Standing Desk 160cm", "Home & Office", "749.00", 17,
     "Dual-motor sit-stand frame rated to 120kg with four memory presets."),
    ("Orbit Ergonomic Chair", "Home & Office", "589.00", 23,
     "Mesh back, adjustable everything, and a warranty measured in decades."),
    ("Beam Monitor Light Bar", "Home & Office", "109.00", 87,
     "Asymmetric light that lands on the desk, not the screen. No glare, no "
     "reflections."),
    ("Quiet Desk Mat (Large)", "Home & Office", "54.00", 112,
     "Full-desk felt and cork mat that takes the edge off a hard desktop."),
    ("Cascade Cable Management Kit", "Home & Office", "29.99", 160,
     "Under-desk tray, sleeves and clips to get every cable off the floor."),
    ("Solace Desk Lamp", "Home & Office", "94.50", 44,
     "Tunable 2700K-6000K lamp with a weighted base and a genuinely useful arm."),
]

CATALOGUE_TABLES = (
    "order_items",
    "orders",
    "cart_items",
    "carts",
    "products",
    "categories",
)


def _image_for(slug: str) -> str | None:
    """Image URL for a seeded product.

    Deliberately ``None``: the demo catalogue has no photography, and borrowing
    random stock photos puts a forest on a desk lamp, which reads as a bug
    rather than a placeholder. The frontend renders a branded placeholder tile
    instead. Set a real URL here (or via the admin API) once photos exist.
    """
    del slug
    return None


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

    for name, category_name, price, stock, description in PRODUCTS:
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
                image_url=_image_for(slug),
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
