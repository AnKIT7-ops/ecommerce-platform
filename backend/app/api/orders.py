"""Order routes."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.dependencies import AdminDep, CurrentUserDep, DbDep
from app.models.order import ORDER_STATUS_TRANSITIONS, Order, OrderItem, OrderStatus
from app.models.product import Product
from app.schemas.common import Page
from app.schemas.order import OrderCreate, OrderRead, OrderStatusUpdate, OrderSummary
from app.services.checkout import create_order_from_cart

router = APIRouter(prefix="/orders", tags=["Orders"])


def _owned_order_or_404(db: DbDep, order_id: int, user_id: int, is_admin: bool) -> Order:
    """Load an order the caller is allowed to see.

    Another user's order returns 404 rather than 403, because a 403 would
    confirm that the id exists.
    """
    stmt = select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    if not is_admin:
        stmt = stmt.where(Order.user_id == user_id)

    order = db.execute(stmt).scalar_one_or_none()
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


@router.post("", status_code=status.HTTP_201_CREATED)
def create_order(data: OrderCreate, current_user: CurrentUserDep, db: DbDep) -> OrderRead:
    """Check out: convert the caller's cart into an order.

    Stock is decremented atomically and the cart is emptied in the same
    transaction. No payment is taken - this is a simulated checkout.
    """
    order = create_order_from_cart(db, current_user.id, data)
    return OrderRead.model_validate(order)


@router.get("")
def list_orders(
    current_user: CurrentUserDep,
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 10,
) -> Page[OrderSummary]:
    """The caller's order history, newest first."""
    base = select(Order).where(Order.user_id == current_user.id)

    total = db.execute(
        select(func.count()).select_from(base.order_by(None).subquery())
    ).scalar_one()

    rows = db.execute(
        select(Order, func.coalesce(func.sum(OrderItem.quantity), 0))
        .outerjoin(OrderItem, OrderItem.order_id == Order.id)
        .where(Order.user_id == current_user.id)
        .group_by(Order.id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()

    return Page[OrderSummary](
        items=[
            OrderSummary(
                id=order.id,
                status=order.status,
                total_amount=order.total_amount,
                item_count=item_count,
                created_at=order.created_at,
            )
            for order, item_count in rows
        ],
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.get("/{order_id}")
def get_order(
    order_id: Annotated[int, Path(ge=1)], current_user: CurrentUserDep, db: DbDep
) -> OrderRead:
    """Full detail for one of the caller's orders."""
    order = _owned_order_or_404(db, order_id, current_user.id, current_user.is_admin)
    return OrderRead.model_validate(order)


@router.post("/{order_id}/cancel")
def cancel_order(
    order_id: Annotated[int, Path(ge=1)], current_user: CurrentUserDep, db: DbDep
) -> OrderRead:
    """Cancel an order and return its stock to the catalogue."""
    order = _owned_order_or_404(db, order_id, current_user.id, current_user.is_admin)

    if OrderStatus.CANCELLED not in ORDER_STATUS_TRANSITIONS[order.status]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"An order with status {order.status.value} can no longer be cancelled",
        )

    # Restock in product_id order - same deadlock-avoidance rule as checkout.
    for item in sorted(order.items, key=lambda i: i.product_id):
        product = db.get(Product, item.product_id)
        if product is not None:
            product.stock_quantity += item.quantity

    order.status = OrderStatus.CANCELLED
    db.commit()
    db.refresh(order)
    return OrderRead.model_validate(order)


@router.patch("/{order_id}/status")
def update_order_status(
    order_id: Annotated[int, Path(ge=1)],
    data: OrderStatusUpdate,
    db: DbDep,
    _admin: AdminDep,
) -> OrderRead:
    """Advance an order through its lifecycle. Administrators only."""
    order = db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")

    if data.status not in ORDER_STATUS_TRANSITIONS[order.status]:
        allowed = sorted(s.value for s in ORDER_STATUS_TRANSITIONS[order.status])
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot move an order from {order.status.value} to {data.status.value}. "
            f"Allowed transitions: {allowed or 'none, this is a terminal state'}",
        )

    order.status = data.status
    db.commit()
    db.refresh(order)
    return OrderRead.model_validate(order)
