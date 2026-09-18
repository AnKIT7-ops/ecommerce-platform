"""API routers, mounted under the configured API prefix."""

from fastapi import APIRouter

from app.api import auth, cart, categories, orders, products

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(products.router)
api_router.include_router(cart.router)
api_router.include_router(orders.router)

__all__ = ["api_router"]
