from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine


app = FastAPI(
    title="E-Commerce Platform API",
    version="0.1.0",
)


@app.get("/")
def root():
    return {
        "message": "E-Commerce Platform API",
        "status": "running",
        "version": "0.1.0",
    }


@app.get("/health")
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected",
        }

    except Exception:
        return {
            "status": "unhealthy",
            "database": "disconnected",
        }