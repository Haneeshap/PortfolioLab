# PortfolioLab Audit Schema
# Schema for audit log entries

from typing import Any

from datetime import datetime
from pydantic import BaseModel, Field


class AuditLogBase(BaseModel):
    id: int = Field(..., description="Audit log entry ID")
    user_id: int = Field(..., description="User ID who performed the action")
    action: str = Field(..., description="Action: CREATE, UPDATE, DELETE")
    entity_type: str = Field(..., description="Entity type: portfolio, order, watchlist, etc.")
    entity_id: int = Field(..., description="Entity ID")
    before_state: dict[str, Any] | None = Field(None, description="JSON snapshot before change")
    after_state: dict[str, Any] | None = Field(None, description="JSON snapshot after change")
    ip_address: str | None = Field(None, description="Client IP address")
    user_agent: str | None = Field(None, description="User agent string")
    created_at: datetime = Field(..., description="Timestamp of the action")


class AuditLogCreate(AuditLogBase):
    """Schema for creating audit log entries."""


class AuditLogResponse(AuditLogBase):
    """Schema for audit log response."""

    class Config:
        from_attributes = True