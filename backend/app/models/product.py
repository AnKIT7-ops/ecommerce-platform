"""Product catalogue model."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.category import Category


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        # Turns any future bug in the stock-decrement logic into an
        # IntegrityError instead of silently negative inventory.
        CheckConstraint("stock_quantity >= 0", name="ck_products_stock_non_negative"),
        CheckConstraint("price >= 0", name="ck_products_price_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(280), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Never a float. NUMERIC(10,2) round-trips as Decimal via psycopg2.
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    stock_quantity: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)
    # Postgres does not index foreign keys automatically.
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"),
        index=True,
        nullable=True,
    )
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        default=True, server_default="true", index=True, nullable=False
    )

    category: Mapped[Category | None] = relationship(back_populates="products")

    @property
    def in_stock(self) -> bool:
        return self.stock_quantity > 0

    def __repr__(self) -> str:
        return f"<Product id={self.id} slug={self.slug!r} stock={self.stock_quantity}>"
