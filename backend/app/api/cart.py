"""Shopping cart routes.

The cart lives server-side and is scoped to the authenticated user, so every
endpoint here requires a valid access token.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status
from sqlalchemy import select

from app.dependencies import CurrentUserDep, DbDep
from app.models.cart import CartItem
from app.schemas.cart import CartItemCreate, CartItemUpdate, CartRead
from app.schemas.common import Message
from app.services.cart import (
    ensure_stock,
    get_or_create_cart,
    load_product_or_404,
    serialize_cart,
)

router = APIRouter(prefix="/cart", tags=["Cart"])


def _owned_item_or_404(db: DbDep, cart_id: int, item_id: int) -> CartItem:
    """Fetch a cart line, scoped to the caller's own cart.

    Returns 404 rather than 403 for another user's item so the endpoint does not
    confirm that the id exists.
    """
    item = db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart_id)
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cart item not found")
    return item


@router.get("")
def get_cart(current_user: CurrentUserDep, db: DbDep) -> CartRead:
    """The authenticated user's cart, with per-line and overall totals."""
    return serialize_cart(get_or_create_cart(db, current_user.id))


@router.post("/items", status_code=status.HTTP_201_CREATED)
def add_item(data: CartItemCreate, current_user: CurrentUserDep, db: DbDep) -> CartRead:
    """Add a product to the cart, or increase its quantity if already present."""
    cart = get_or_create_cart(db, current_user.id)
    product = load_product_or_404(db, data.product_id)

    existing = db.execute(
        select(CartItem).where(
            CartItem.cart_id == cart.id, CartItem.product_id == data.product_id
        )
    ).scalar_one_or_none()

    # The unique constraint on (cart_id, product_id) means a repeat add is an
    # increment, not a second line.
    desired = (existing.quantity if existing else 0) + data.quantity
    ensure_stock(product, desired)

    if existing:
        existing.quantity = desired
    else:
        db.add(CartItem(cart_id=cart.id, product_id=data.product_id, quantity=data.quantity))

    db.commit()
    db.refresh(cart)
    return serialize_cart(cart)


@router.put("/items/{item_id}")
def update_item(
    item_id: Annotated[int, Path(ge=1)],
    data: CartItemUpdate,
    current_user: CurrentUserDep,
    db: DbDep,
) -> CartRead:
    """Set an exact quantity for one cart line."""
    cart = get_or_create_cart(db, current_user.id)
    item = _owned_item_or_404(db, cart.id, item_id)

    ensure_stock(load_product_or_404(db, item.product_id), data.quantity)
    item.quantity = data.quantity

    db.commit()
    db.refresh(cart)
    return serialize_cart(cart)


@router.delete("/items/{item_id}")
def remove_item(
    item_id: Annotated[int, Path(ge=1)], current_user: CurrentUserDep, db: DbDep
) -> CartRead:
    """Remove one line from the cart."""
    cart = get_or_create_cart(db, current_user.id)
    item = _owned_item_or_404(db, cart.id, item_id)

    db.delete(item)
    db.commit()
    db.refresh(cart)
    return serialize_cart(cart)


@router.delete("")
def clear_cart(current_user: CurrentUserDep, db: DbDep) -> Message:
    """Empty the cart."""
    cart = get_or_create_cart(db, current_user.id)
    for item in list(cart.items):
        db.delete(item)
    db.commit()
    return Message(detail="Cart cleared")
