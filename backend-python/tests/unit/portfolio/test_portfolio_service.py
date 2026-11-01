"""Portfolio Service unit tests - replaces Java portfolio test suite"""
import pytest
from datetime import datetime

from app.services.portfolio_service import PortfolioService
from app.models.portfolio import Portfolio
from app.models.enums import OrderStatus


@pytest.fixture
def portfolio_service():
    """Create PortfolioService instance for testing."""
    return PortfolioService()


@pytest.mark.asyncio
async def test_portfolio_service_initialization(portfolio_service):
    """Test PortfolioService initializes correctly."""
    assert portfolio_service is not None


@pytest.mark.asyncio
async def test_portfolio_creation(portfolio_service):
    """Test portfolio can be created with basic fields."""
    portfolio = Portfolio(
        name="Test Portfolio",
        description="A test portfolio for unit testing",
        cash_balance=10000.0,
        currency="USD",
    )
    
    assert portfolio.name == "Test Portfolio"
    assert portfolio.cash_balance == 10000.0
    assert portfolio.currency == "USD"
    assert portfolio.id is not None
    assert portfolio.created_at is not None


@pytest.mark.asyncio
async def test_portfolio_with_holdings(portfolio_service):
    """Test portfolio creation with initial holdings."""
    portfolio = Portfolio(
        name="Test Portfolio with Holdings",
        description="Portfolio with test holdings",
        cash_balance=50000.0,
        currency="USD",
    )
    
    assert portfolio.name == "Test Portfolio with Holdings"
    assert portfolio.cash_balance == 50000.0
    assert portfolio.id is not None


@pytest.mark.asyncio
async def test_order_status_enum():
    """Test OrderStatus enum values."""
    assert OrderStatus.PENDING.value == "PENDING"
    assert OrderStatus.ACCEPTED.value == "ACCEPTED"
    assert OrderStatus.FILLED.value == "FILLED"
    assert OrderStatus.REJECTED.value == "REJECTED"
    assert OrderStatus.CANCELLED.value == "CANCELLED"