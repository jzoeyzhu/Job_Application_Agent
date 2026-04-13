"""Centralized configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = PACKAGE_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Anthropic
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    model: str = Field(default="claude-sonnet-4-6", alias="MODEL")
    llm_max_retries: int = Field(default=2, alias="LLM_MAX_RETRIES")
    llm_timeout_seconds: float = Field(default=120.0, alias="LLM_TIMEOUT_SECONDS")

    # Per-agent token budgets
    max_tokens_gap_analyzer: int = 3000
    max_tokens_cover_letter: int = 2000
    max_tokens_interview_coach: int = 5000
    max_tokens_resume_parser: int = 4000

    # Storage
    data_dir: Path = Field(default=PROJECT_DIR / "data")

    # Limits
    max_pdf_bytes: int = Field(default=10 * 1024 * 1024, alias="MAX_PDF_BYTES")  # 10 MB
    max_jd_chars: int = Field(default=50_000, alias="MAX_JD_CHARS")
    max_resume_pages: int = Field(default=20, alias="MAX_RESUME_PAGES")

    # Server
    cors_allow_origins: list[str] = Field(
        default=["http://localhost:3000"], alias="CORS_ALLOW_ORIGINS"
    )
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    @property
    def resumes_dir(self) -> Path:
        return self.data_dir / "resumes"

    @property
    def sessions_dir(self) -> Path:
        return self.data_dir / "sessions"

    @property
    def prompts_dir(self) -> Path:
        return PACKAGE_DIR / "prompts"


@lru_cache
def get_settings() -> Settings:
    return Settings()
