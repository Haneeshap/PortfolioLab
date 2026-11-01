# PortfolioLab Database Schema (compact)

*SQLAlchemy 2.x models. PKs auto‑increment; composite keys noted.*

| Table | PK | Key columns |
|---|---|---|
| **users** | `id` (Int) | `email` (unique), `password_hash`, `role`, `is_active`, `is_verified`, `created_at` |
| **assets** | `id` (BigInt) | `symbol` (unique), `name`, `price`, `currency`, `sector`, `description` |
| **portfolios** | `id` (BigInt) | `name`, `cash_balance`, `currency`, `created_at` |
| **holdings** | `id` (BigInt) | `portfolio_id`, `asset_id`, `quantity`, `average_buy_price`, `historical_cost_portfolio`, `currency` |
| **simulated_orders** | `id` (BigInt) | `portfolio_id`, `symbol`, `side`, `order_type`, `limit_price`, `time_in_force`, `expires_at`, `status`, `filled_quantity`, `avg_fill_price` |
| **audit_log** | `id` (BigInt) | `user_id`, `action` (enum), `entity_type`, `entity_id`, `before_state`, `after_state`, `ip_address`, `created_at` |
| **fx_rates** | `id` (BigInt) | `base_currency`, `quote_currency`, `rate`, `source`, `captured_at` |
| **history_candles** | `id` (BigInt) | `symbol`, `observed_at`, `open_price`, `high_price`, `low_price`, `close_price` |
| **market_price_alerts** | `id` (BigInt) | `portfolio_id`, `symbol`, `currency`, `direction` (ABOVE/BELOW), `target_price`, `last_price`, `status` (ACTIVE/TRIGGERED/CANCELLED), `created_at`, `triggered_at` |
| **notification_preferences** | `id` (BigInt) | `user_id`, `email_notifications`, `push_notifications`, `sms_notifications`, `frequency` (IMMEDIATE/HOUR/DAILY/WEEKLY), `quiet_hours_start/end`, `created_at`, `updated_at` |
| **outbox_events** | `id` (BigInt) | `event_type`, `entity_type`, `entity_id`, `payload`, `created_at`, `published_at` |
| **intelligence_notes** | `id` (BigInt) | `symbol`, `currency`, `event_type`, `window_seconds`, `start_price`, `end_price`, `change_percent`, `headline`, `explanation`, `created_at` |
| **refresh_tokens** | `id` (BigInt) | `user_id`, `token_hash` (unique), `expires_at`, `revoked`, `created_at` |
| **watchlists** | `id` (BigInt) | `portfolio_id`, `name`, `created_at` |
| **watchlist_items** | composite PK (`watchlist_id`,`asset_id`) | `asset_id`, `added_at` |
| **activities** | `id` (BigInt) | `portfolio_id`, `action` (enum), `description`, `activity_metadata`, `created_at` |
| **executions** | `id` (BigInt) | `portfolio_id`, `asset_id`, `quantity`, `price`, `fx_rate`, `execution_fx_rate`, `portfolio_amount`, `status`, `executed_at`, `created_at` |

*All tables use SQLAlchemy 2.x `DeclarativeBase`. Relationships and constraints are defined in the model classes (`app/models/*.py`). Migration scripts under `alembic/versions/` create the schema and seed data.*

*For the full ER diagram and constraint details, refer to `DOCUMENTATION_04_DATABASE.md`.*

*Schema snapshot generated 2026‑10‑27.*