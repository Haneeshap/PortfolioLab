"""auth

Adds authentication-related columns and tables.

Idempotent: safe to run when the tables already exist.
"""

from alembic import op
import sqlalchemy as sa


revision = "auth"
down_revision = "initial"


def upgrade() -> None:
    op.create_table(
        "risk_policies",
        sa.Column("portfolio_id", sa.BigInteger(), nullable=False),
        sa.Column("max_order_value", sa.Numeric(19, 4), nullable=False, server_default=sa.text("50000")),
        sa.Column("max_position_pct", sa.Numeric(5, 2), nullable=False, server_default=sa.text("100")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("portfolio_id"),
    )
    op.create_index("ix_risk_policies_portfolio_id", "risk_policies", ["portfolio_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_risk_policies_portfolio_id", table_name="risk_policies")
    op.drop_table("risk_policies")