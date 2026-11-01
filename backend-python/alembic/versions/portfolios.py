"""portfolios

Adds holdings, transactions, and extended portfolio fields.

Idempotent: safe to run when the tables already exist.
"""

from alembic import op
import sqlalchemy as sa


revision = "portfolios"
down_revision = "auth"


def upgrade() -> None:
    op.create_table(
        "holdings",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("portfolio_id", sa.BigInteger(), nullable=False),
        sa.Column("asset_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Numeric(19, 6), nullable=False),
        sa.Column("average_buy_price", sa.Numeric(19, 4), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("historical_cost_portfolio", sa.Numeric(19, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("quantity > 0", name="holdings_quantity_check"),
        sa.CheckConstraint("average_buy_price >= 0", name="holdings_average_buy_price_check"),
    )

    op.create_table(
        "transactions",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("portfolio_id", sa.BigInteger(), nullable=False),
        sa.Column("asset_id", sa.BigInteger(), nullable=False),
        sa.Column("transaction_type", sa.String(10), nullable=False),
        sa.Column("quantity", sa.Numeric(19, 6), nullable=False),
        sa.Column("price", sa.Numeric(19, 4), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("SETTLED")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("transaction_type IN ('BUY','SELL')", name="transactions_type_check"),
    )


def downgrade() -> None:
    op.drop_table("transactions")
    op.drop_table("holdings")