# PortfolioLab Notification Worker
# Consumes order events from Kafka and creates notifications

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from aiokafka import AIOKafkaConsumer

from app.core.kafka import get_kafka_consumer
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


notification_service = NotificationService()


async def notification_worker() -> None:
    """Background worker that consumes order lifecycle events from Kafka."""
    consumer = await get_kafka_consumer(
        ["oms.order.lifecycle.events"],
        group_id="portfoliolab.notifications",
    )

    if consumer is None:
        logger.error("Failed to create Kafka consumer")
        return

    try:
        async for message in consumer:
            try:
                event_data = json.loads(message.value.decode("utf-8"))
                order_uid = event_data.get("order_uid")
                event_type = event_data.get("event")
                status = event_data.get("status")

                logger.info(f"Received order event: {event_type} for order {order_uid}")

                # Create appropriate notification based on event type
                if event_type == "PLACED":
                    await notification_service.create_notification(
                        notification_type="ORDER_PLACED",
                        title="Order Placed",
                        message=f"Your order {order_uid} has been submitted",
                        receipt_id=f"order_{order_uid}_placed",
                        metadata={"order_uid": order_uid, "status": status},
                    )
                elif event_type == "FILLED":
                    await notification_service.create_notification(
                        notification_type="ORDER_FILLED",
                        title="Order Filled",
                        message=f"Your order {order_uid} has been filled",
                        receipt_id=f"order_{order_uid}_filled",
                        metadata={"order_uid": order_uid, "status": status},
                    )
                elif event_type in ("CANCELLED", "REJECTED"):
                    await notification_service.create_notification(
                        notification_type="ORDER_CANCELLED",
                        title="Order Cancelled/Rejected",
                        message=f"Your order {order_uid} has been {event_type.lower()}",
                        receipt_id=f"order_{order_uid}_{event_type.lower()}",
                        metadata={"order_uid": order_uid, "status": status, "event_type": event_type},
                    )

                # Commit offset after processing
                await message.commit()

            except Exception as e:
                logger.error(f"Error processing Kafka message: {e}")
                # Don't commit offset on error - will re-process
    finally:
        await consumer.stop()