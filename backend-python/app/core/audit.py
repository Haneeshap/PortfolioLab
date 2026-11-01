# PortfolioLab Audit Core
# Audit dependency that logs every POST/PUT/DELETE request

from typing import Optional, Any, Callable, Awaitable

import structlog
import json
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.database import async_session
from app.models.audit_log import AuditLog


async def log_audit_entry(
    method: str,
    path: str,
    user_id: int | None,
    entity_type: str | None,
    entity_id: int | None,
    before_state: Optional[dict[str, Any]],
    after_state: Optional[dict[str, Any]],
    ip_address: str,
) -> None:
    """
    Log an audit entry to the database.

    This is called as a dependency after each request to track
    mutations (POST/PUT/DELETE) on protected endpoints.
    """
    async with async_session() as db:
        audit_entry = AuditLog(
            user_id=user_id or 0,
            action=method.upper(),
            entity_type=entity_type or "api",
            entity_id=entity_id or 0,
            before_state=before_state,
            after_state=after_state,
            ip_address=ip_address,
        )
        db.add(audit_entry)
        await db.commit()


class AuditMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware that automatically audits POST/PUT/DELETE requests.

    Extracts the current user from the request state (set by authentication
    middleware) and logs the request body before/after the response.
    """

    async def dispatch(self, request: Request, call_next: Callable[[Request[Any]], Awaitable[Response]]) -> Response:
        # Get client IP
        ip_address = request.client.host if request.client else "0.0.0.0"

        # Try to get user from request state (set by auth middleware)
        user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None

        # Capture body before processing for POST/PUT/DELETE
        before_state = None
        if request.method in ("POST", "PUT", "DELETE"):
            try:
                body = await request.body()
                if body:
                    before_state = json.loads(body)
            except Exception:
                before_state = None

        response = await call_next(request)

        # Capture after state from response for POST/PUT/DELETE
        after_state = None
        if request.method in ("POST", "PUT", "DELETE"):
            # Try to parse response body if JSON
            content_type = response.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    body_bytes = b""
                    async for chunk in response.body():  # type: ignore[operator]
                        body_bytes += chunk
                    if body_bytes:
                        after_state = json.loads(body_bytes)
                except Exception:
                    after_state = None

        # Log the audit entry
        import asyncio
        try:
            asyncio.create_task(
                log_audit_entry(
                    method=request.method,
                    path=request.url.path,
                    user_id=user_id,
                    entity_type="api",
                    entity_id=0,
                    before_state=before_state,
                    after_state=after_state,
                    ip_address=ip_address,
                )
            )
        except Exception:
            pass

        return response