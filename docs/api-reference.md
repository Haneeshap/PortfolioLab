# PortfolioLab API Reference

## Generation

This document was auto-generated from the FastAPI OpenAPI schema:

```bash
python app/main.py --export-openapi > docs/api-reference.md
```

## Authentication Endpoints

### `POST /api/auth/register`

Register a new user account.

**Request:**
- `username: str` - Unique username
- `email: str` - User email address
- `password: str` - Plain text password (hashed server-side)

**Response**: `Token` model with `access_token` and `refresh_token`

### `POST /api/auth/login`

Authenticate and receive JWT tokens.

**Request:**
- `username: str` - Registered username
- `password: str` - Plain text password

**Response**: `Token` model

### `GET /api/auth/me`

Get current user profile.

**Response**: `UserRead` model with user details

## FX Service Endpoints

### `GET /fx/convert`

Convert amount between currencies.

**Query Parameters:**
- `from_symbol: str` - From currency (e.g., "USD")
- `to_symbol: str` - To currency (e.g., "EUR")
- `amount: float` - Amount to convert (gt=0)

**Response**: `FxConvertResponse` with `from_symbol`, `to_symbol`, `amount`, `converted_amount`, `rate`, `timestamp`

### `GET /fx/reference`

Get FX reference rates for base currency.

**Query Parameters:**
- `base: str` - Base currency symbol (default: "USD")

**Response**: `List[FxReferenceResponse]` with `base`, `quote`, `rate`, `asset_id`, `asset_name`

### `GET /fx/attribution`

Get FX attribution analysis for a portfolio.

**Query Parameters:**
- `portfolio_id: int` - Portfolio identifier

**Response**: `FxAttributionResponse` with `portfolio_id`, `total_fx_return`, `attribution`, `generated_at`

## Order Management Endpoints

### `POST /api/portfolios/`

Create a new portfolio.

**Request**: `PortfolioCreate` model

**Response**: `PortfolioResponse` with generated ID

### `POST /api/simulated-orders/`

Create a simulated order.

**Request**: `SimulatedOrder` model with `order_type`, `side`, `limit_price`, etc.

**Response**: Order fill result with `fill_price`, `status`, `order_id`

### `GET /api/health`

Health check endpoint for container orchestration.

**Response**: `{"status": "ok"}` or appropriate health status

## Market Data Endpoints

### `GET /api/assets/`

List all assets with optional search.

**Query Parameters**: Search/filter parameters

**Response**: `List[AssetResponse]`

### `GET /api/prices`

Get current market price from simulator.

**Response**: `{"price": float}`

## Audit Endpoints

### `GET /api/audit/`

Get audit log entries (admin only).

**Response**: `List[AuditLogResponse]` with entries showing user, action, entity, timestamps

## Error Responses

- `400`: Bad request validation error
- `401`: Unauthorized - missing/invalid token
- `403`: Forbidden - insufficient permissions
- `404`: Not found
- `422`: Validation error
- `503`: Service unavailable (database, market simulator, Ollama)