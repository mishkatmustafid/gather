"""Alembic environment for Gather.

Reads the database URL from app settings (the same .env the API uses)
and compares migrations against the SQLAlchemy models in app.models.
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.db import Base
import app.models # noqa: F401 - importing registers the tables on Base.metadata

# Alembic Config object, which provides access to the values within the .ini file in use.
config = context.config

# Use the app's DATABASE_URL from settings instead of the one in alembic.ini
# "%" is espaced because alembic.ini values go through configparser interpolation,
# so a password containing "%" would otherwise raise an error.
config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))

# Set up Python logging from the [loggers] section of the alembic.ini file.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The metadata autogenerate compares the database against
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Generate SQL without connecting to a database (alembic upgrade head --sql)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Connect to the database and apply migrations"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool # migrations are one-off, so no need to keep connections open
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata, compare_type=True, compare_server_default=True
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
