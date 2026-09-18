"""Product schemas."""

from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import CategoryRead
from app.schemas.common import Money


class ProductSort(str, Enum):
    """Sort options accepted by the product listing endpoint."""

    NEWEST = "newest"
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"
    NAME_ASC = "name_asc"
    NAME_DESC = "name_desc"


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    price: Money
    stock_quantity: int = Field(default=0, ge=0)
    category_id: int | None = None
    image_url: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class ProductCreate(ProductBase):
    slug: str | None = Field(default=None, max_length=280)


class ProductUpdate(BaseModel):
    """Every field optional - only what is sent gets changed."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    price: Decimal | None = Field(default=None, max_digits=10, decimal_places=2, ge=0)
    stock_quantity: int | None = Field(default=None, ge=0)
    category_id: int | None = None
    image_url: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None
    slug: str | None = Field(default=None, max_length=280)


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None
    price: Money
    stock_quantity: int
    category_id: int | None
    image_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProductDetail(ProductRead):
    """Product plus its expanded category, used on the detail page."""

    category: CategoryRead | None = None
