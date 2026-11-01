"""orders

Creates simulated_orders table for order lifecycle.

Idempotent: safe to run when the table already exists.
"""

from alembic import op
import sqlalchemy as sa


revision = "orders"
down_revision = "portfolios"


def upgrade() -> None:
    op.create_table(
        "simulated_orders",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("portfolio_id", sa.BigInteger(), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("side", sa.String(10), nullable=False),
        sa.Column("order_type", sa.String(6), nullable=False, server_default=sa.text("MARKET")),
        sa.Column("limit_price", sa.Numeric(19, 4), nullable=True),
        sa.Column("time_in_force", sa.String(3), nullable=False, server_default=sa.text("GTC")),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("SUBMITTED")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("order_type='MARKET' AND limit_price IS NULL OR order_type='LIMIT' AND limit_price IS NOT NULL AND limit_price > 0", name="valid_limit_check"),
        sa.CheckConstraint("time_in_force IN ('DAY','GTC')", name="valid_time_in_force_check"),
    )


def downgrade() -> None:
    op.drop_table("simulated_orders")