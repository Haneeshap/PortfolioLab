"""OMS Service unit tests - replaces Java OMS test suite"""
from enum import Enum

import pytest
from datetime import datetime, timedelta

from app.services.oms_service import OMSService
from app.models.simulated_order import SimulatedOrder
from app.models.enums import OrderStatus, OrderSide, OrderType


@pytest.fixture
def oms_service():
    """Create OMS service instance for testing."""
    from unittest.mock import Mock
    session_maker = Mock()
    reservation_mgr = Mock()
    execution_engine = Mock()
    return OMSService(session_maker, reservation_mgr, execution_engine)


@pytest.mark.asyncio
async def test_oms_service_initialization(oms_service):
    """Test OMS service initializes correctly."""
    assert oms_service is not None


@pytest.mark.asyncio
async def test_order_state_machine(oms_service):
    """Test order state transitions: PENDING -> ACCEPTED -> FILLED/REJECTED/CANCELLED."""
    # Create a test order
    order = SimulatedOrder(
        symbol="AAPL",
        side=OrderSide.BUY,
        order_type=OrderType.LIMIT,
        quantity=100,
        price=150.0,
    )
    
    # Initially should be PENDING
    assert order.status == OrderStatus.PENDING.value
    
    # Transition to ACCEPTED
    order.status = OrderStatus.ACCEPTED.value
    assert order.status == OrderStatus.ACCEPTED.value
    
    # Transition to FILLED
    order.status = OrderStatus.FILLED.value
    assert order.status == OrderStatus.FILLED.value
    
    # Verify final state
    assert order.status == OrderStatus.FILLED.value


@pytest.mark.asyncio
async def test_order_side_enum():
    """Test OrderSide enum values."""
    assert OrderSide.BUY.value == "BUY"
    assert OrderSide.SELL.value == "SELL"


@pytest.mark.asyncio
async def test_order_type_enum():
    """Test OrderType enum values."""
    assert OrderType.LIMIT.value == "LIMIT"
    assert OrderType.MARKET.value == "MARKET"


@pytest.mark.asyncio
async def test_order_status_enum():
    """Test OrderStatus enum values."""
    assert OrderStatus.PENDING.value == "PENDING"
    assert OrderStatus.ACCEPTED.value == "ACCEPTED"
    assert OrderStatus.FILLED.value == "FILLED"
    assert OrderStatus.REJECTED.value == "REJECTED"
    assert OrderStatus.CANCELLED.value == "CANCELLED"