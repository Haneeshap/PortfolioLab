# PortfolioLab Redis - redis client factory for cached lookups and notification outbox

import redis
from typing import AsyncGenerator, Any
from contextlib import asynccontextmanager

# Module-level redis cache client (lazy connection)
redis_cache = redis.asyncio.from_url(
    "redis://localhost:6379",
    encoding="utf-8",
    decode_responses=True,
)


@asynccontextmanager
async def get_redis() -> AsyncGenerator[Any, None]:
    """Get a redis connection pool.

    Lazy-import so the app starts even if Redis is not available.
    Uses redis-py async interface (redis>=6.0).
    """
    try:
        pool = redis.asyncio.from_url(
            "redis://localhost:6379",
            encoding="utf-8",
            decode_responses=True,
        )
        yield pool
    except Exception:
        # If Redis is not available, yield a no-op context manager
        yield None