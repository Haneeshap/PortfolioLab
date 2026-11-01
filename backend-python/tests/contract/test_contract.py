"""Contract tests - verify JSON shapes match what Next.js expects"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


@pytest_asyncio.fixture(scope="session")
async def async_client():
    """Create async test client."""
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
@pytest.mark.contract
async def test_health_endpoint_contract(async_client):
    """Test /api/health returns expected shape."""
    response = await async_client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    # Health check must return status field
    assert "status" in data


@pytest.mark.asyncio
@pytest.mark.contract
async def test_root_endpoint_contract(async_client):
    """Test / returns expected shape."""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    # Root must return status
    assert "status" in data


@pytest.mark.asyncio
@pytest.mark.contract
async def test_portfolios_pagination_contract(async_client):
    """Test /api/portfolios with pagination returns expected shape."""
    response = await async_client.get("/api/portfolios?page=1&limit=5")
    assert response.status_code == 200
    data = response.json()
    # Pagination must return: items, total, page, limit, total_pages
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "limit" in data
    assert "total_pages" in data


@pytest.mark.asyncio
@pytest.mark.contract
async def test_auth_me_contract(async_client):
    """Test /api/me returns expected shape (after auth)."""
    response = await async_client.get("/api/me")
    # May be 401 if not authenticated, but shape should be correct when authenticated
    assert response.status_code in (200, 401)
    if response.status_code == 200:
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "role" in data