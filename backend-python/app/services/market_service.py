# PortfolioLab Market Service
# Proxies to Go simulator at http://localhost:8081
# Uses httpx with 2s timeout and 503 fallback on failure

from __future__ import annotations

import httpx
from typing import Optional, Dict, Any, List, cast


class MarketService:
    """Service mirroring Java MarketService logic, proxying to Go simulator."""
    
    def __init__(self, base_url: str = "http://localhost:8081", timeout: float = 2.0):
        self.base_url = base_url
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client
    
    async def get_price(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get current price for a symbol from Go simulator."""
        try:
            resp = await self.client.get(f"{self.base_url}/prices/{symbol}")
            if resp.status_code == 200:
                return cast(Dict[str, Any], resp.json())
            elif resp.status_code == 503:
                # Simulator unavailable - return fallback
                return {"symbol": symbol, "price": None, "fallback": True}
            else:
                return {"symbol": symbol, "price": None, "fallback": True}
        except (httpx.TimeoutException, httpx.ConnectError):
            # Timeout or connection failure - return 503 fallback
            return {"symbol": symbol, "price": None, "fallback": True}
        except Exception:
            # Any other error - return 503 fallback
            return {"symbol": symbol, "price": None, "fallback": True}
    
    async def get_historical_price(
        self, symbol: str, start: str, end: str
    ) -> Optional[List[Dict[str, Any]]]:
        """Get historical price data from Go simulator."""
        try:
            resp = await self.client.get(
                f"{self.base_url}/prices/historical",
                params={"symbol": symbol, "start": start, "end": end},
            )
            if resp.status_code == 200:
                return cast(List[Dict[str, Any]], resp.json())
            return []
        except Exception:
            return []
    
    async def get_market_data(
        self, symbol: str
    ) -> Optional[Dict[str, Any]]:
        """Get broader market data for a symbol."""
        try:
            resp = await self.client.get(f"{self.base_url}/market/{symbol}")
            if resp.status_code == 200:
                return cast(Dict[str, Any], resp.json())
            return {}
        except Exception:
            return {"fallback": True, "symbol": symbol}
    
    async def close(self) -> None:
        """Close the httpx client."""
        if self._client:
            await self._client.aclose()
            self._client = None


# Singleton instance
market_service = MarketService()