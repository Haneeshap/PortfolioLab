"""Application configuration loaded from environment via pydantic-settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DB_PASSWORD: str = "local_dev_password"
    DATABASE_URL: str | None = None
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "portfoliolab"
    DB_NAME: str = "portfoliolab"

    # Ollama embeddings (same endpoint as the Java OllamaEmbeddingClient)
    OLLAMA_HOST: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "nomic-embed-text"
    EMBEDDING_DIMENSION: int = 768

    # Backend
    BACKEND_URL: str = "http://127.0.0.1:8000"
    BACKEND_PORT: int = 8000
    CORS_ORIGINS: str = "*"

    @property
    def database_url(self) -> str:
        """Async PostgreSQL URL used by SQLAlchemy + asyncpg."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def ollama_embed_url(self) -> str:
        """Full Ollama /api/embeddings URL."""
        return f"{self.OLLAMA_HOST.rstrip('/')}/api/embeddings"

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
