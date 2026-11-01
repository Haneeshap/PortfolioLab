# PortfolioLab Notification Routes - Simplified
from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.services.notification_service import NotificationService, NotificationType

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", summary="List notifications")
async def list_notifications(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_async_session),
):
    """List notifications."""
    notif_service = NotificationService()
    notifications = await notif_service.get_recent_notifications(limit=limit, offset=offset)
    return notifications


@router.get("/unread-count", summary="Get unread count")
async def unread_count(
    session: AsyncSession = Depends(get_async_session),
):
    """Get unread notification count."""
    # Placeholder - would query database for unread count
    return {"unread_count": 0}


@router.post("/preferences", summary="Set notification preferences")
async def set_preferences(
    preferences: dict = Query(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Set notification preferences."""
    # Placeholder - would save preferences to database
    return {"status": "ok", "preferences": preferences}


@router.post("/read/unread", summary="Mark notifications as read")
async def mark_read(
    notification_ids: list = Query(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Mark notifications as read."""
    # Placeholder - would update database
    return {"marked": len(notification_ids)}


@router.post("/order-filled", summary="Notify order filled")
async def notify_order_filled(
    order_uid: str = Query(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Notify that an order was filled - produces to Kafka."""
    from app.core.kafka import get_kafka_producer

    # Produce order filled event to Kafka
    async with get_kafka_producer() as producer:
        if producer is not None:
            pass  # Event would be produced here

    return {"status": "notified", "order_uid": order_uid}


@router.post("/order-rejected", summary="Notify order rejected")
async def notify_order_rejected(
    order_uid: str = Query(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Notify that an order was rejected - produces to Kafka."""
    from app.core.kafka import get_kafka_producer

    # Produce order rejected event to Kafka
    async with get_kafka_producer() as producer:
        if producer is not None:
            pass  # Event would be produced here

    return {"status": "notified", "order_uid": order_uid}


@router.post("/order-expired", summary="Notify order expired")
async def notify_order_expired(
    order_uid: str = Query(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Notify that an order expired - produces to Kafka."""
    from app.core.kafka import get_kafka_producer

    # Produce order expired event to Kafka
    async with get_kafka_producer() as producer:
        if producer is not None:
            pass  # Event would be produced here

    return {"status": "notified", "order_uid": order_uid}