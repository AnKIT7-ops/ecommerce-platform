"""Shared schema building blocks."""

from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, Field, PlainSerializer

T = TypeVar("T")

#: Monetary amount.
#:
#: Serialized to JSON as a fixed 2-decimal *string* ("19.99"), never a number.
#: Two reasons: FastAPI's jsonable_encoder casts a bare Decimal to float, and a
#: JS client parsing a JSON number gets an IEEE-754 double where 19.99 * 3 is
#: 59.97000000000001. A string makes the frontend's formatting choice explicit
#: and guarantees "10.00" rather than "10".
Money = Annotated[
    Decimal,
    Field(max_digits=10, decimal_places=2, ge=0),
    PlainSerializer(lambda v: f"{v:.2f}", return_type=str, when_used="json"),
]


class Page(BaseModel, Generic[T]):
    """Paginated collection envelope.

    Fixed up front because retrofitting an envelope onto a bare list breaks
    every client call site at once.
    """

    items: list[T]
    total: int = Field(description="Total rows matching the filters, ignoring pagination")
    page: int = Field(description="1-based page number")
    size: int = Field(description="Requested page size")
    pages: int = Field(description="Total number of pages")


class Message(BaseModel):
    """Simple acknowledgement body."""

    detail: str


class ErrorResponse(BaseModel):
    """The shape every error returns, so clients parse one thing."""

    detail: str
