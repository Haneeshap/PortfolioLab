# PortfolioLab Schemas - User

from typing import Optional, List, Annotated
from pydantic import BaseModel, Field, EmailStr


class UserCreate(BaseModel):
    """Schema for creating a user."""

    email: EmailStr
    password: str = Field(..., min_length=6)
    role: Optional[str] = "viewer"


class UserLogin(BaseModel):
    """Schema for user login."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user response."""

    id: int
    username: str
    email: str
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


class UserSummary(BaseModel):
    """Lightweight user summary for portfolio assignments."""

    id: int
    username: str


class UserPortfolioAssignment(BaseModel):
    """Schema for assigning a user to a portfolio."""

    user_id: int
    portfolio_id: int
    role: str = Field(default="OWNER", pattern="^(OWNER|VIEWER)$")


class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserRead(BaseModel):
    """Schema for reading user data."""
    id: int
    email: str
    username: str
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True