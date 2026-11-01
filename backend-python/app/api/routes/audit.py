# PortfolioLab API Routes - Audit
# Mirrors Java audit controller for showing all mutations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", summary="Get audit trail", response_model=list[AuditLogResponse])
async def get_audit_trail(
    session: AsyncSession = Depends(get_async_session),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=500, description="Items per page"),
    action: str | None = Query(None, description="Filter by action: CREATE, UPDATE, DELETE"),
    entity_type: str | None = Query(None, description="Filter by entity type"),
):
    """Get the audit trail of all mutations (POST/PUT/DELETE)."""
    # Build query with optional filters
    query = select(AuditLog)

    if action:
        query = query.where(AuditLog.action == action)

    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)

    # Count total
    count_query = select(func.count()).select_from(AuditLog)
    if action:
        count_query = count_query.where(AuditLog.action == action)
    if entity_type:
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    total_result = await session.execute(count_query)
    total = total_result.scalar()

    # Apply pagination and ordering
    offset = (page - 1) * limit
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)

    result = await session.execute(query)
    audit_entries = result.scalars().all()

    return {
        "items": audit_entries,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total > 0 else 0,
    }