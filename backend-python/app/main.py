"""FastAPI application: lifespan, CORS, routers, enterprise structure."""

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, async_session
from app.core.exceptions import (
    DatabaseUnavailableError,
    OllamaUnavailableError,
    MarketSimulatorUnavailableError,
    NotFoundError,
    ValidationError,
)
from app.core.enums import *
from app.core.security import create_access_token, verify_token
from app.core.kafka import KAFKA_BOOTSTRAP_SERVERS, KAFKA_ORDER_LIFECYCLE_TOPIC, KAFKA_EXECUTION_RECEIPT_TOPIC, KAFKA_MARKET_PRICES_TOPIC
from app.core.redis import get_redis

# Import all models so they are registered on Base.metadata
import app.models.asset  # noqa: F401
import app.models.portfolio  # noqa: F401
import app.models.simulated_order  # noqa: F401
import app.models.asset_search_embedding  # noqa: F401
import app.models.notification  # noqa: F401
import app.models.watchlist  # noqa: F401
import app.models.price_alert  # noqa: F401
import app.models.user  # noqa: F401
import app.models.audit_log  # noqa: F401
import app.models.fx_rate  # noqa: F401
import app.models.activities  # noqa: F401

from app.api.routes import health, assets, portfolios, simulated_orders, market, search, audit




@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: check DB, Ollama, Kafka, Go simulator on startup."""
    # Check database connectivity
    try:
        async with async_session() as session:
            await session.execute("SELECT 1")
        print("[lifestyle] Database connection OK")
    except Exception as e:
        print(f"[lifestyle] Database connection FAILED: {e}")

    # Check Ollama connectivity
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.OLLAMA_HOST.rstrip('/')}/api/version")
            print(f"[lifestyle] Ollama reachable: {resp.status_code}")
    except Exception as e:
        print(f"[lifestyle] Ollama unreachable: {e}")

    # Check Kafka connectivity
    try:
        import aiokafka
        print(f"[lifestyle] Kafka bootstrap servers: {KAFKA_BOOTSTRAP_SERVERS}")
    except Exception as e:
        print(f"[lifestyle] Kafka check: {e}")

    # Check Go simulator
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("http://127.0.0.1:8081/prices")
            print(f"[lifestyle] Go simulator reachable: {resp.status_code}")
    except Exception as e:
        print(f"[lifestyle] Go simulator unreachable: {e}")

    yield

    # Cleanup on shutdown
    await engine.dispose()
    print("[lifestyle] Application shutdown complete")


app = FastAPI(
    title="PortfolioLab Backend (Python FastAPI - Enterprise)",
    description="Enterprise structure mirroring the Java Spring Boot backend.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/", summary="Root health check", response_model=dict[str, str])
async def root():
    """Root endpoint returning status."""
    return {"status": "ok"}


@app.get("/api/me", summary="Get current user", response_model=dict)
async def me():
    """Get current authenticated user (returns 401 if not authenticated)."""
    from fastapi import HTTPException
    raise HTTPException(status_code=401, detail="Not authenticated")


# Correlation ID middleware using structlog
correlation_id: str | None = None


@app.middleware("http")
async def correlation_id_middleware(request, call_next):
    global correlation_id
    correlation_id = str(uuid.uuid4()) if correlation_id is None else correlation_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = correlation_id or "none"
    return response


# Prometheus metrics instrumentation
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)


# X-Cache response header middleware for market prices
@app.middleware("http")
async def x_cache_middleware(request, call_next):
    from app.core.redis import redis_cache

    # Only apply to market prices endpoint
    if request.url.path.startswith("/api/market/prices"):
        symbol = request.path_params.get("symbol", "") if hasattr(request, "path_params") else ""
        if symbol:
            cache_key = f"portfoliolab:prices:{symbol}"
            try:
                exists = await redis_cache.exists(cache_key)
                response = await call_next(request)
                response.headers["X-Cache"] = "HIT" if exists else "MISS"
                return response
            except Exception:
                response = await call_next(request)
                response.headers["X-Cache"] = "MISS"
                return response
    else:
        response = await call_next(request)
        return response


# Exception handlers
@app.exception_handler(DatabaseUnavailableError)
async def database_unavailable_handler(request, exc):
    return HTTPException(status_code=503, detail="Database service unavailable")

@app.exception_handler(OllamaUnavailableError)
async def ollama_unavailable_handler(request, exc):
    return HTTPException(status_code=503, detail="Ollama embedding service unavailable")

@app.exception_handler(MarketSimulatorUnavailableError)
async def market_simulator_unavailable_handler(request, exc):
    return HTTPException(status_code=503, detail="Market simulator unavailable")

@app.exception_handler(NotFoundError)
async def not_found_handler(request, exc):
    return HTTPException(status_code=404, detail=str(exc.detail).replace(" not found", ""))

@app.exception_handler(ValidationError)
async def validation_handler(request, exc):
    return HTTPException(status_code=422, detail=exc.detail)


# Include routers
app.include_router(health.router, prefix="/api/health")
app.include_router(search.router, prefix="/api/search")
app.include_router(assets.router, prefix="/api/assets")
app.include_router(portfolios.router, prefix="/api/portfolios")
app.include_router(simulated_orders.router, prefix="/api/simulated-orders")
app.include_router(audit.router, prefix="/api")
app.include_router(market.router, prefix="/api/market")
