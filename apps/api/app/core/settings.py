from pydantic import PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

environment_source = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)


class Settings(BaseSettings):
    model_config = environment_source

    database_url: PostgresDsn
    redis_url: RedisDsn
    api_docs_enabled: bool


class MigrationSettings(BaseSettings):
    model_config = environment_source

    migration_database_url: PostgresDsn
