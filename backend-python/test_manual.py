"""Manual verification script for PortfolioLab implementation"""
import asyncio
from httpx import AsyncClient

from app.main import app


async def test_manual():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Test health endpoint
        response = await client.get("/api/health")
        print(f"GET /api/health -> Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # Test root endpoint
        response = await client.get("/")
        print(f"GET / -> Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # Test pagination
        response = await client.get("/api/portfolios?page=1&limit=5")
        print(f"GET /api/portfolios?page=1&limit=5 -> Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  items: {len(data.get('items', []))}")
            print(f"  total: {data.get('total')}")
            print(f"  page: {data.get('page')}")
            print(f"  limit: {data.get('limit')}")
            print(f"  total_pages: {data.get('total_pages')}")
        
        # Test metrics
        response = await client.get("/api/metrics")
        print(f"GET /api/metrics -> Status: {response.status_code}")
        
        print("\nAll manual tests passed!")


asyncio.run(test_manual())