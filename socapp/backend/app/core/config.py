from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        extra="ignore",
    )

    # Neo4j
    NEO4J_URI: str
    NEO4J_USER: Optional[str] = None
    NEO4J_USERNAME: Optional[str] = None
    NEO4J_PASSWORD: str
    NEO4J_DATABASE: str = "neo4j"

    # JWT
    JWT_SECRET: Optional[str] = None
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Add PORT for Render
    PORT: int = 8000

    # Frontend origin for CORS
    FRONTEND_ORIGIN: Optional[str] = None

    # Helpers
    @property
    def auth_user(self) -> str:
        return self.NEO4J_USER or self.NEO4J_USERNAME or ""

    @property
    def jwt_secret_value(self) -> str:
        # Provide a safe dev default if not set to avoid empty secret errors
        return (self.JWT_SECRET or self.JWT_SECRET_KEY or "dev-secret-change-me")


settings = Settings()