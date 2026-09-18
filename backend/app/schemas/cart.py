"""Shopping cart schemas."""

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Money
from app.schemas.product import ProductRead


class CartItemCreate(BaseModel):
    product_id: int = Field(ge=1)
    quantity: int = Field(default=1, ge=1, le=999)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1, le=999)


class CartItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    product: ProductRead
    line_total: Money


class CartRead(BaseModel):
    id: int
    items: list[CartItemRead]
    total_items: int = Field(description="Sum of quantities across all lines")
    subtotal: Money
