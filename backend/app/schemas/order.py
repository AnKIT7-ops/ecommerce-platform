"""Order schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.order import OrderStatus
from app.schemas.common import Money


class ShippingDetails(BaseModel):
    """Delivery address captured at checkout. No payment data is collected."""

    shipping_full_name: str = Field(min_length=1, max_length=255)
    shipping_address_line1: str = Field(min_length=1, max_length=255)
    shipping_address_line2: str | None = Field(default=None, max_length=255)
    shipping_city: str = Field(min_length=1, max_length=120)
    shipping_postal_code: str = Field(min_length=1, max_length=32)
    shipping_country: str = Field(min_length=1, max_length=120)
    shipping_phone: str | None = Field(default=None, max_length=40)


class OrderCreate(ShippingDetails):
    """Checkout request. The order's contents come from the caller's cart."""

    notes: str | None = Field(default=None, max_length=2000)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    # Snapshotted at purchase time, so renaming the product does not rewrite history.
    product_name: str
    quantity: int
    unit_price: Money
    line_total: Money


class OrderSummary(BaseModel):
    """Row shape for the order history list."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    status: OrderStatus
    total_amount: Money
    item_count: int
    created_at: datetime


class OrderRead(ShippingDetails):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: OrderStatus
    total_amount: Money
    notes: str | None
    items: list[OrderItemRead]
    created_at: datetime
    updated_at: datetime
