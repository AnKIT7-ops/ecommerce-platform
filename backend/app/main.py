from fastapi import FastAPI

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
    return {
        "status": "healthy"
    }