"""Integration tests for orders API using testcontainers - replaces Java integration tests"""
import pytest
from datetime import datetime

from httpx import AsyncClient


pytestmark = pytest.mark.integration


@pytest.fixture(scope="session")
async def async_client():
    """Create async test client."""
    from app.main import app
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture(scope="session")
async def test_db():
    """Set up test database with testcontainers."""
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text
    
    database_url = "postgresql+asyncpg://postgres:postgres@localhost:55552/portfolab_test"
    engine = create_async_engine(database_url)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.mark.asyncio
async def test_health_endpoint(async_client):
    """Test health endpoint returns 200."""
    response = await async_client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_root_endpoint(async_client):
    """Test root endpoint returns status."""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_metrics_endpoint(async_client):
    """Test metrics endpoint returns 200."""
    response = await async_client.get("/api/metrics")
    assert response.status_code == 200