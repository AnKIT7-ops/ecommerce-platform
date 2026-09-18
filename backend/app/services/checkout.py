"""Checkout: turn a user's cart into an order.

This is the one place in the application where correctness under concurrency
actually matters, so the mechanics are deliberate:

* Cart lines are processed in ``product_id`` order. Two shoppers checking out
  with overlapping carts would otherwise take row locks in opposite orders and
  deadlock.
* Stock is decremented with a conditional UPDATE rather than a read-then-write.
  Under Postgres' READ COMMITTED isolation the ``stock_quantity >= :qty``
  predicate is re-evaluated after the row lock is acquired, so a losing
  concurrent decrement matches zero rows and is rejected. That is the same
  guarantee as SELECT ... FOR UPDATE, without a separate locking step that a
  future code path could forget to take.
* ``RETURNING`` reads the price under that same lock, so a concurrent price
  edit cannot skew the order total.
* A single explicit ``commit()`` at the very end. Anything raised before it
  leaves the session dirty, and ``get_db()``'s teardown rolls the whole thing
  back - no partial orders, and no stock decremented for an order that never
  came into existence.
"""

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.cart import CartItem
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.schemas.order import OrderCreate
from app.services.cart import get_or_create_cart


def create_order_from_cart(db: Session, user_id: int, data: OrderCreate) -> Order:
    """Convert the user's cart into a PENDING order and clear the cart."""
    cart = get_or_create_cart(db, user_id)

    if not cart.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your cart is empty")

    # Deterministic lock ordering - see module docstring.
    cart_items: list[CartItem] = sorted(cart.items, key=lambda item: item.product_id)

    order = Order(
        user_id=user_id,
        status=OrderStatus.PENDING,
        total_amount=Decimal("0.00"),
        **data.model_dump(),
    )
    db.add(order)
    # flush, not commit: order.id is needed for the line items, but the whole
    # thing must stay inside one transaction.
    db.flush()

    total = Decimal("0.00")

    for item in cart_items:
        row = db.execute(
            update(Product)
            .where(
                Product.id == item.product_id,
                Product.is_active.is_(True),
                Product.stock_quantity >= item.quantity,
            )
            .values(stock_quantity=Product.stock_quantity - item.quantity)
            .returning(Product.price, Product.name)
            .execution_options(synchronize_session=False)
        ).first()

        if row is None:
            # Either the product was deactivated, or someone else took the
            # stock between adding to the cart and checking out.
            product = db.get(Product, item.product_id)
            available = product.stock_quantity if product else 0
            name = product.name if product else f"Product {item.product_id}"
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"{name} is no longer available in the requested quantity "
                f"({item.quantity} requested, {available} in stock)",
            )

        unit_price, product_name = row
        total += unit_price * item.quantity

        db.add(
            OrderItem(
                order_id=order.id,
                product_id=item.product_id,
                product_name=product_name,
                quantity=item.quantity,
                unit_price=unit_price,
            )
        )

    order.total_amount = total

    # Emptying the cart belongs to the same transaction: if anything above
    # failed, the cart is still intact for the user to retry.
    for item in cart_items:
        db.delete(item)

    db.commit()
    db.refresh(order)
    return order
