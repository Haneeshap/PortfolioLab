# PortfolioLab Structured Logging
# JSON correlation-ID logger using structlog

from __future__ import annotations

import sys
import time
import uuid
from typing import Any, Dict, Optional

import structlog
from fastapi import Request, Response

# Correlation ID middleware will set this in request state
correlation_id: Optional[str] = None


def get_correlation_id() -> Optional[str]:
    """Get the current request's correlation ID."""
    return correlation_id


def structlog_processor(event: Dict[str, Any], key: str, value: Any) -> Dict[str, Any]:
    """Add correlation_id and timing to every log event."""
    if correlation_id and correlation_id != "none":
        event["correlation_id"] = correlation_id
    # Add timestamp if not present
    if "timestamp" not in event:
        event["timestamp"] = time.time()
    return event


def setup_logging() -> None:
    """Configure structlog for JSON output."""
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog_processor,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ]

    structlog.configure(
        processors=processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_call=True,
    )


# Create the module-level logger after configuration
log = structlog.get_logger()