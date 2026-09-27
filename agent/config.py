from functools import cache
from pathlib import Path
from typing import Literal

from pydantic import PositiveInt, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    database_url_ro: SecretStr

    llm_provider: Literal["google", "groq"] = "google"
    llm_model: str = "gemini-3.5-flash-lite"
    llm_context_window: PositiveInt = 1_048_576
    google_api_key: SecretStr | None = None
    groq_api_key: SecretStr | None = None
    agent_recursion_limit: PositiveInt = 50

    workspace_dir: Path = ROOT / "workspace"
    skills_dir: Path = ROOT / "skills"
    logs_dir: Path = ROOT / "logs"
    api_public_url: str = "http://localhost:2024"

    sql_max_rows: PositiveInt = 200
    sql_max_cell_chars: PositiveInt = 300
    sandbox_timeout_s: PositiveInt = 60
    sandbox_max_output_chars: PositiveInt = 20_000


@cache
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]
