# PortfolioLab API Routes - Health Check

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_session

router = APIRouter(tags=["health"])


@router.get("/live", summary="Liveness probe", status_code=200)
async def health_live() -> dict[str, str]:
    """Always returns 200 for container liveness probe."""
    return {"status": "alive"}


@router.get("/ready", summary="Readiness probe")
async def health_ready(
    db: AsyncSession = Depends(get_async_session),
) -> dict:
    """Returns 200 if all dependencies are healthy, 503 otherwise."""
    checks: dict = {}

    # Check PostgreSQL
    try:
        postgres_healthy = await check_postgres_health(db)
        checks["postgres"] = postgres_healthy
    except Exception:
        checks["postgres"] = False

    # Check Redis
    try:
        redis_ok = await redis_cache.exists("health_check")
        checks["redis"] = redis_ok
    except Exception:
        checks["redis"] = False

    # Check Kafka
    try:
        checks["kafka"] = await kafka_healthy()
    except Exception:
        checks["kafka"] = False

    # Check Ollama
    try:
        checks["ollama"] = await check_ollama_health()
    except Exception:
        checks["ollama"] = False

    # All checks must pass for readiness
    all_healthy = all(checks.values()) if checks else False

    if not all_healthy:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not_ready", "checks": checks},
        )

    return {"status": "ready", "checks": checks}


@router.get("", summary="Full health status")
async def health_full(
    db: AsyncSession = Depends(get_async_session),
) -> dict:
    """Full health status with detailed information."""
    checks: dict[str, bool | str] = {}

    # PostgreSQL
    try:
        await db.execute(text("SELECT 1"))
        checks["postgres"] = True
    except Exception:
        checks["postgres"] = False

    # Redis
    try:
        await redis_cache.get("health_check")
        checks["redis"] = True
    except Exception:
        checks["redis"] = False

    # Kafka
    try:
        checks["kafka"] = await kafka_healthy()
    except Exception:
        checks["kafka"] = False

    # Ollama
    try:
        checks["ollama"] = await check_ollama_health()
    except Exception:
        checks["ollama"] = False

    all_healthy = all(checks.values()) if checks else False

    return {
        "status": "healthy" if all_healthy else "unhealthy",
        "checks": checks,
    }