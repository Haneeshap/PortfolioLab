import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

from app.core.config import settings
from app.core.database import Base

# Import all models so they are registered on Base.metadata.
import app.models.asset  # noqa: F401
import app.models.asset_search_embedding  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override the URL from settings (reads .env) so migrations connect to the
# same PostgreSQL database as the application.
config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = Base.metadata


def do_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=False,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online():
    connectable = create_async_engine(
        settings.database_url,
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_migrations)


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=False,
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
