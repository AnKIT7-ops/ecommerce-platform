"""API routers, mounted under the configured API prefix."""

from fastapi import APIRouter

from app.api import auth, categories, products

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(products.router)

__all__ = ["api_router"]
