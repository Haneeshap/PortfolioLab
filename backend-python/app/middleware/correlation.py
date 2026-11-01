# PortfolioLab Correlation Middleware
# X-Request-ID generation and response header injection

from __future__ import annotations

import time
import uuid
from typing import Awaitable, Callable, Any

from fastapi import Request, Response
from fastapi.responses import JSONResponse


def generate_correlation_id() -> str:
    """Generate a unique correlation ID for the request."""
    return str(uuid.uuid4())


async def correlation_middleware(
    request: Request,
    call_next: Callable[..., Awaitable[Response]],
) -> Response:
    """
    Middleware that:
    1. Generates a unique X-Request-ID
    2. Sets it in request state for log correlation
    3. Adds it to the response as X-Request-ID header
    4. Timing tracking for response
    """
    # Generate or retrieve correlation ID

    # Generate or retrieve correlation ID
    request_id = generate_correlation_id()
    request_id = generate_correlation_id()

    # Process the request
    start_time = time.time()
    response = await call_next(request)

    # Add timing and correlation ID to response
    process_time = time.time() - start_time
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(round(process_time, 4))

    # Reset correlation_id after request
    correlation_id = None

    return response