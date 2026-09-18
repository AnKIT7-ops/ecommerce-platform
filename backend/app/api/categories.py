"""Category routes. Reads are public; writes require an administrator."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status
from sqlalchemy import func, select

from app.dependencies import AdminDep, DbDep
from app.models.category import Category
from app.models.product import Product
from app.schemas.category import (
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    CategoryWithCount,
)
from app.schemas.common import Message
from app.utils.slug import unique_slug

router = APIRouter(prefix="/categories", tags=["Categories"])


def _get_or_404(db: DbDep, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    return category


@router.get("")
def list_categories(db: DbDep) -> list[CategoryWithCount]:
    """All categories with a count of their active products."""
    rows = db.execute(
        select(Category, func.count(Product.id))
        .outerjoin(Product, (Product.category_id == Category.id) & Product.is_active.is_(True))
        .group_by(Category.id)
        .order_by(Category.name)
    ).all()

    return [
        CategoryWithCount(**CategoryRead.model_validate(category).model_dump(), product_count=count)
        for category, count in rows
    ]


@router.get("/{category_id}")
def get_category(category_id: Annotated[int, Path(ge=1)], db: DbDep) -> CategoryRead:
    return CategoryRead.model_validate(_get_or_404(db, category_id))


@router.get("/slug/{slug}")
def get_category_by_slug(slug: str, db: DbDep) -> CategoryRead:
    category = db.execute(select(Category).where(Category.slug == slug)).scalar_one_or_none()
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    return CategoryRead.model_validate(category)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, db: DbDep, _admin: AdminDep) -> CategoryRead:
    if db.execute(select(Category).where(Category.name == data.name)).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "A category with this name already exists")

    category = Category(
        name=data.name,
        description=data.description,
        slug=unique_slug(db, Category, data.slug or data.name),
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return CategoryRead.model_validate(category)


@router.put("/{category_id}")
def update_category(
    category_id: Annotated[int, Path(ge=1)],
    data: CategoryUpdate,
    db: DbDep,
    _admin: AdminDep,
) -> CategoryRead:
    category = _get_or_404(db, category_id)
    payload = data.model_dump(exclude_unset=True)

    if "name" in payload and payload["name"] != category.name:
        clash = db.execute(
            select(Category).where(Category.name == payload["name"], Category.id != category_id)
        ).scalar_one_or_none()
        if clash:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "A category with this name already exists"
            )

    if payload.get("slug"):
        category.slug = unique_slug(db, Category, payload["slug"], exclude_id=category_id)
    payload.pop("slug", None)

    for field, value in payload.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)
    return CategoryRead.model_validate(category)


@router.delete("/{category_id}")
def delete_category(
    category_id: Annotated[int, Path(ge=1)], db: DbDep, _admin: AdminDep
) -> Message:
    """Delete a category.

    Refused while products still reference it, so the client gets a 409 rather
    than a 500 surfacing from the RESTRICT foreign key.
    """
    category = _get_or_404(db, category_id)

    in_use = db.execute(
        select(func.count()).select_from(Product).where(Product.category_id == category_id)
    ).scalar_one()
    if in_use:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot delete this category: {in_use} product(s) still reference it",
        )

    db.delete(category)
    db.commit()
    return Message(detail="Category deleted")
