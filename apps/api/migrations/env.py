import logging
from importlib import import_module

from alembic import context
from sqlalchemy import create_engine

from app.core.database import Base
from app.core.settings import MigrationSettings

logging.basicConfig(format="%(levelname)s %(message)s")
logging.getLogger("alembic").setLevel(logging.INFO)

for models_module in ("app.features.access.models", "app.features.registry.models"):
    import_module(models_module)

engine = create_engine(str(MigrationSettings().migration_database_url))
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()
