# PortfolioLab Exceptions - Custom HTTPException subclasses

from fastapi import HTTPException, status
from starlette import status as http_status


class DatabaseUnavailableError(HTTPException):
    """Raised when the database is unavailable."""

    def __init__(self) -> None:
        super().__init__(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )


class OllamaUnavailableError(HTTPException):
    """Raised when the Ollama embedding service is unavailable."""

    def __init__(self) -> None:
        super().__init__(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama embedding service unavailable",
        )


class MarketSimulatorUnavailableError(HTTPException):
    """Raised when the market simulator is unavailable."""

    def __init__(self) -> None:
        super().__init__(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Market simulator unavailable",
        )


class NotFoundError(HTTPException):
    """Raised when a requested resource is not found."""

    def __init__(self, resource: str, id: int | str | None = None) -> None:
        msg = f"{resource}"
        if id is not None:
            msg += f" with id={id} not found"
        super().__init__(status_code=http_status.HTTP_404_NOT_FOUND, detail=msg)


class ValidationError(HTTPException):
    """Raised when request validation fails."""

    def __init__(self, detail: str) -> None:
        super().__init__(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)