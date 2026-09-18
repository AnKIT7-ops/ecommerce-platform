"""Product routes. Reads are public; writes require an administrator."""

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload

from app.dependencies import AdminDep, DbDep
from app.models.category import Category
from app.models.order import OrderItem
from app.models.product import Product
from app.schemas.common import Message, Page
from app.schemas.product import (
    ProductCreate,
    ProductDetail,
    ProductRead,
    ProductSort,
    ProductUpdate,
)
from app.utils.slug import unique_slug

router = APIRouter(prefix="/products", tags=["Products"])

_SORT_CLAUSES = {
    ProductSort.NEWEST: (Product.created_at.desc(), Product.id.desc()),
    ProductSort.PRICE_ASC: (Product.price.asc(), Product.id.asc()),
    ProductSort.PRICE_DESC: (Product.price.desc(), Product.id.asc()),
    ProductSort.NAME_ASC: (Product.name.asc(), Product.id.asc()),
    ProductSort.NAME_DESC: (Product.name.desc(), Product.id.asc()),
}


def _get_or_404(db: DbDep, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


def _validate_category(db: DbDep, category_id: int | None) -> None:
    if category_id is not None and db.get(Category, category_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Category does not exist")


@router.get("")
def list_products(
    db: DbDep,
    search: Annotated[
        str | None, Query(max_length=200, description="Match name or description")
    ] = None,
    category_id: Annotated[int | None, Query(ge=1)] = None,
    category_slug: Annotated[str | None, Query(max_length=120)] = None,
    min_price: Annotated[Decimal | None, Query(ge=0)] = None,
    max_price: Annotated[Decimal | None, Query(ge=0)] = None,
    in_stock: Annotated[
        bool | None, Query(description="Only products with stock remaining")
    ] = None,
    sort: Annotated[ProductSort, Query()] = ProductSort.NEWEST,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 12,
    include_inactive: Annotated[bool, Query(description="Admin listings only")] = False,
) -> Page[ProductRead]:
    """Paginated, filterable product catalogue."""
    stmt = select(Product)

    if not include_inactive:
        stmt = stmt.where(Product.is_active.is_(True))

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(Product.name.ilike(pattern), Product.description.ilike(pattern))
        )

    if category_slug:
        stmt = stmt.join(Category, Product.category_id == Category.id).where(
            Category.slug == category_slug
        )
    elif category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)

    if min_price is not None:
        stmt = stmt.where(Product.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.price <= max_price)
    if in_stock:
        stmt = stmt.where(Product.stock_quantity > 0)

    # Count before applying limit/offset, using the same filters.
    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()

    stmt = stmt.order_by(*_SORT_CLAUSES[sort]).offset((page - 1) * size).limit(size)
    products = db.execute(stmt).scalars().all()

    return Page[ProductRead](
        items=[ProductRead.model_validate(p) for p in products],
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.get("/{product_id}")
def get_product(product_id: Annotated[int, Path(ge=1)], db: DbDep) -> ProductDetail:
    product = db.execute(
        select(Product).options(joinedload(Product.category)).where(Product.id == product_id)
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return ProductDetail.model_validate(product)


@router.get("/slug/{slug}")
def get_product_by_slug(slug: str, db: DbDep) -> ProductDetail:
    product = db.execute(
        select(Product).options(joinedload(Product.category)).where(Product.slug == slug)
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return ProductDetail.model_validate(product)


@router.get("/{product_id}/related")
def list_related_products(
    product_id: Annotated[int, Path(ge=1)],
    db: DbDep,
    limit: Annotated[int, Query(ge=1, le=12)] = 4,
) -> list[ProductRead]:
    """Other active products in the same category."""
    product = _get_or_404(db, product_id)
    if product.category_id is None:
        return []

    related = db.execute(
        select(Product)
        .where(
            Product.category_id == product.category_id,
            Product.id != product_id,
            Product.is_active.is_(True),
        )
        .order_by(func.random())
        .limit(limit)
    ).scalars().all()
    return [ProductRead.model_validate(p) for p in related]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate, db: DbDep, _admin: AdminDep) -> ProductRead:
    _validate_category(db, data.category_id)

    product = Product(
        **data.model_dump(exclude={"slug"}),
        slug=unique_slug(db, Product, data.slug or data.name),
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return ProductRead.model_validate(product)


@router.put("/{product_id}")
def update_product(
    product_id: Annotated[int, Path(ge=1)],
    data: ProductUpdate,
    db: DbDep,
    _admin: AdminDep,
) -> ProductRead:
    product = _get_or_404(db, product_id)
    payload = data.model_dump(exclude_unset=True)

    if "category_id" in payload:
        _validate_category(db, payload["category_id"])

    if payload.get("slug"):
        product.slug = unique_slug(db, Product, payload["slug"], exclude_id=product_id)
    payload.pop("slug", None)

    for field, value in payload.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return ProductRead.model_validate(product)


@router.delete("/{product_id}")
def delete_product(
    product_id: Annotated[int, Path(ge=1)],
    db: DbDep,
    _admin: AdminDep,
    hard: Annotated[bool, Query(description="Permanently delete instead of deactivating")] = False,
) -> Message:
    """Retire a product.

    Soft-deletes by default (is_active=False). A hard delete is refused once the
    product appears in any order, because order history must stay readable - the
    order_items foreign key is RESTRICT for the same reason.
    """
    product = _get_or_404(db, product_id)

    if not hard:
        product.is_active = False
        db.commit()
        return Message(detail="Product deactivated")

    ordered = db.execute(
        select(func.count()).select_from(OrderItem).where(OrderItem.product_id == product_id)
    ).scalar_one()
    if ordered:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This product appears in existing orders and cannot be permanently deleted. "
            "Deactivate it instead.",
        )

    db.delete(product)
    db.commit()
    return Message(detail="Product deleted")
