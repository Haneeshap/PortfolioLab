# PortfolioLab Kafka - aiokafka producer/consumer factory for OMS lifecycle events
# Simplified to 3 order event types: order.filled, order.rejected, order.expired

import aiokafka
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from typing import Any

KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"

# Simplified to 3 order lifecycle event types
KAFKA_ORDER_LIFECYCLE_TOPIC = "oms.order.events"
KAFKA_EXECUTION_RECEIPT_TOPIC = "oms.execution.receipt"
KAFKA_MARKET_PRICES_TOPIC = "oms.market.prices"


async def get_kafka_producer() -> Any:
    """Get an aiokafka producer instance."""
    try:
        producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: v.encode("utf-8") if isinstance(v, str) else v,
        )
        await producer.start()
        yield producer
    except Exception:
        yield None


async def get_kafka_consumer(topics: list[str], group_id: str = "portfoliolab") -> Any:
    """Get an aiokafka consumer instance."""
    try:
        consumer = AIOKafkaConsumer(
            *topics,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id=group_id,
            auto_offset_reset="earliest",
            enable_auto_commit=False,
        )
        await consumer.start()
        yield consumer
    except Exception:
        yield None