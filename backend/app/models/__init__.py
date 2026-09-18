"""SQLAlchemy models.

Every model module must be imported here: alembic autogenerate only sees what
is registered on ``Base.metadata`` at import time.
"""

from app.models.base import TimestampMixin
from app.models.cart import Cart, CartItem
from app.models.category import Category
from app.models.order import ORDER_STATUS_TRANSITIONS, Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.user import User, UserRole

__all__ = [
    "ORDER_STATUS_TRANSITIONS",
    "Cart",
    "CartItem",
    "Category",
    "Order",
    "OrderItem",
    "OrderStatus",
    "Product",
    "TimestampMixin",
    "User",
    "UserRole",
]
