# PortfolioLab Enterprise Features

This document lists the enterprise-grade features implemented in PortfolioLab.

## RBAC (Role-Based Access Control)

- User roles and permissions system
- FastAPI dependency-based role checking
- Route-level access control

## JWT Authentication

- JSON Web Token based authentication
- bcrypt password hashing
- Access token with expiration management (`ACCESS_TOKEN_EXPIRE_MINUTES`)
- Refresh token support
- Token verification in FastAPI dependencies

## Redis Cache

- Cache layer for frequent operations
- Asset price caching from Go simulator
- Session/token blacklist management
- Rate limiting store

## Rate Limiting

- Per-user and per-IP rate limiting
- FastAPI middleware integration
- Configurable rate limits per endpoint

## Audit Trail

- Automatic logging of POST/PUT/DELETE requests
- Middleware-based before/after state capture
- Database audit log table with user, action, entity type, timestamps
- `log_audit_entry()` core function for audit dependency

## Observability

- Correlation ID propagation via `X-Request-ID` header
- Process timing metrics via `X-Process-Time` header
- Structured logging with `structlog`
- Request/response logging in audit middleware

## Pagination

- Paginated query results for list endpoints
- `offset`/`limit` query parameters
- `AssetSearch` with embedding-based search

## Health Checks

- `/api/health` endpoint for container orchestration
- Database connectivity check
- Service dependency validation

## Pydantic Schema Validation

- All `constr()` → `str` + `Field(pattern=...)` migrations completed
- Type-annotated models throughout
- `mypy --strict` compliance targeted

## Error Handling

- Custom exception classes (`DatabaseUnavailableError`, `OllamaUnavailableError`, `MarketSimulatorUnavailableError`, `NotFoundError`, `ValidationError`)
- Standardized HTTP error responses
- Proper status codes (404, 422, 503)

## Automatic Documentation

- FastAPI-generated OpenAPI schema
- Markdown API reference generation from `openapi.json`
- Interactive Swagger UI at `/docs`