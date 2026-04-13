"""Pydantic models for API request/response types."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ResumeMetadata(BaseModel):
    id: str
    name: str
    filename: str
    is_default: bool = False
    created_at: datetime
    updated_at: datetime


class ResumeDetail(ResumeMetadata):
    content: str  # Claude's 1:1 text extraction from the PDF


class AnalyzeRequest(BaseModel):
    jd_text: str = Field(min_length=20, max_length=50_000)
    resume_id: str | None = None  # uses default if omitted
    session_name: str | None = Field(default=None, max_length=200)

    @field_validator("jd_text")
    @classmethod
    def _strip_jd(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("jd_text cannot be blank")
        return v


SessionStatus = Literal["running", "completed", "failed"]


class SessionMetadata(BaseModel):
    id: str
    name: str
    resume_id: str
    created_at: datetime
    status: SessionStatus


class SessionDetail(SessionMetadata):
    jd_text: str
    results: dict | None = None
