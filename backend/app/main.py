"""FastAPI application entrypoint."""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import api_router
from app.config import settings
from app.database import engine

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.project_name,
    version="1.0.0",
    description=(
        "REST API for the e-commerce platform: authentication, product catalogue, "
        "categories, shopping cart and orders."
    ),
    openapi_tags=[
        {"name": "Health", "description": "Service and database liveness checks."},
        {"name": "Authentication", "description": "Registration, login, tokens and profile."},
        {"name": "Products", "description": "Catalogue browsing; writes require an admin."},
        {"name": "Categories", "description": "Category browsing; writes require an admin."},
        {"name": "Cart", "description": "The authenticated user's shopping cart."},
        {"name": "Orders", "description": "Checkout and order history."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    # Explicit origins from configuration, never "*" - credentials are sent.
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Error handling ---------------------------------------------------------
# Every error leaves as {"detail": ...} so clients parse exactly one shape, and
# nothing internal reaches the client.


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Flatten Pydantic errors into a readable sentence plus machine-readable detail."""
    problems = [
        {
            "field": ".".join(str(part) for part in err["loc"] if part != "body"),
            "message": err["msg"],
        }
        for err in exc.errors()
    ]
    summary = "; ".join(
        f"{p['field']}: {p['message']}" if p["field"] else p["message"] for p in problems
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": summary or "Validation error", "errors": problems},
    )


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.exception("Database error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last resort: log the traceback server-side, return nothing useful to an attacker."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# --- Routes -----------------------------------------------------------------

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/", tags=["Health"])
def root() -> dict[str, str]:
    """Service banner."""
    return {
        "message": settings.project_name,
        "status": "running",
        "version": app.version,
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health_check() -> JSONResponse:
    """Liveness probe that also verifies database connectivity."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Health check failed to reach the database")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "database": "disconnected"},
        )
    return JSONResponse(content={"status": "healthy", "database": "connected"})
