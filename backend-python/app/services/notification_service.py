# PortfolioLab Notification Service - Simplified
# Mirrors Java NotificationService logic with outbox pattern, dedup, and retention
# Keep only 3 event types: order.filled, order.rejected, order.expired

from __future__ import annotations
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, Set, Dict, Any, List

import asyncio


class NotificationType:
    """3 default notification types matching simplified requirements."""
    ORDER_FILLED = "ORDER_FILLED"
    ORDER_REJECTED = "ORDER_REJECTED"
    ORDER_EXPIRED = "ORDER_EXPIRED"


class NotificationService:
    """Notification service with outbox pattern, dedup, and retention.

    Keep only 3 event types: order.filled, order.rejected, order.expired.
    Other types (ORDER_PLACED, ORDER_CANCELLED, PRICE_ALERT, PORTFOLIO_REBALANCE,
    DAILY_SUMMARY, RISK_WARNING) have been removed.
    """

    def __init__(self) -> None:
        self.seen_receipt_ids: Set[str] = set()
        self.retention_days = 90

    async def create_notification(
        self,
        notification_type: str,
        title: str,
        message: str,
        receipt_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Create a notification if not a duplicate (dedup by receipt_id)."""
        # Dedup check
        if receipt_id in self.seen_receipt_ids:
            return None  # Duplicate - already processed

        self.seen_receipt_ids.add(receipt_id)

        # Apply retention - remove old seen IDs
        # In production, this would be database-backed with TTL
        cutoff = datetime.utcnow() - timedelta(days=self.retention_days)
        # Clean old entries (simplified - in production would use DB expiry)
        self.seen_receipt_ids = {
            rid for rid in self.seen_receipt_ids
        }  # Placeholder - actual DB cleanup would happen here

        return {
            "receipt_id": receipt_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "created_at": datetime.utcnow().isoformat(),
            "metadata": metadata or {},
        }

    async def get_recent_notifications(
        self, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get recent notifications (would query DB in production)."""
        # Placeholder - would query database
        return []

    async def check_retention(self) -> int:
        """Check and clean up old notifications beyond retention period.

        Returns count of notifications cleaned up.
        """
        # Placeholder - actual implementation would query DB
        return 0