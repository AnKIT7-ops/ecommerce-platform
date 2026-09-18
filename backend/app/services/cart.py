"""Cart helpers shared by the cart and checkout routes."""

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.cart import Cart
from app.models.product import Product
from app.schemas.cart import CartItemRead, CartRead


def get_or_create_cart(db: Session, user_id: int) -> Cart:
    """Return the user's cart, creating it on first use."""
    cart = db.execute(
        select(Cart).options(selectinload(Cart.items)).where(Cart.user_id == user_id)
    ).scalar_one_or_none()

    if cart is None:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def load_product_or_404(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None or not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


def ensure_stock(product: Product, quantity: int) -> None:
    """Reject a cart quantity the catalogue cannot satisfy."""
    if quantity > product.stock_quantity:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Only {product.stock_quantity} of '{product.name}' left in stock",
        )


def serialize_cart(cart: Cart) -> CartRead:
    """Build the cart response, computing totals in Decimal."""
    items = [
        CartItemRead(
            id=item.id,
            product_id=item.product_id,
            quantity=item.quantity,
            product=item.product,
            line_total=item.product.price * item.quantity,
        )
        for item in cart.items
    ]
    return CartRead(
        id=cart.id,
        items=items,
        total_items=sum(item.quantity for item in cart.items),
        subtotal=sum((line.line_total for line in items), Decimal("0.00")),
    )
