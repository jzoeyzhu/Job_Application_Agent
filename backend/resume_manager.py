"""Resume management — upload PDF, Claude reads it visually, store extracted content."""

import base64
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import fitz  # pymupdf — used to convert PDF pages to images

from .config import get_settings
from .exceptions import LLMError, NotFoundError, ValidationError
from .llm import call_messages
from .logging_config import get_logger
from .models import ResumeDetail, ResumeMetadata
from .utils import atomic_write_json, get_lock, load_prompt

logger = get_logger(__name__)

INDEX_LOCK_KEY = "resume_index"
PARSE_AGENT = "resume_parser"


def _settings():
    return get_settings()


def _index_path() -> Path:
    return _settings().resumes_dir / "_index.json"


def _resume_json_path(resume_id: str) -> Path:
    return _settings().resumes_dir / f"{resume_id}.json"


def _resume_pdf_path(resume_id: str) -> Path:
    return _settings().resumes_dir / f"{resume_id}.pdf"


def _read_index() -> dict:
    path = _index_path()
    if not path.exists():
        return {"default_resume_id": None, "resumes": []}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_index(index: dict) -> None:
    atomic_write_json(_index_path(), index)


def _read_doc(resume_id: str) -> dict | None:
    path = _resume_json_path(resume_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _write_doc(doc: dict) -> None:
    atomic_write_json(_resume_json_path(doc["id"]), doc)


def _validate_pdf(pdf_bytes: bytes) -> None:
    s = _settings()
    if not pdf_bytes:
        raise ValidationError("Empty PDF upload")
    if len(pdf_bytes) > s.max_pdf_bytes:
        raise ValidationError(
            f"PDF too large ({len(pdf_bytes)} bytes); max {s.max_pdf_bytes} bytes"
        )
    if not pdf_bytes.startswith(b"%PDF"):
        raise ValidationError("Uploaded file is not a valid PDF")


def pdf_to_base64_images(pdf_bytes: bytes) -> list[str]:
    """Convert each PDF page to a base64-encoded PNG image."""
    s = _settings()
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise ValidationError(f"Could not open PDF: {e}") from e

    if doc.page_count == 0:
        doc.close()
        raise ValidationError("PDF has no pages")
    if doc.page_count > s.max_resume_pages:
        doc.close()
        raise ValidationError(
            f"PDF has {doc.page_count} pages; max is {s.max_resume_pages}"
        )

    images: list[str] = []
    try:
        for page in doc:
            pix = page.get_pixmap(dpi=200)
            png_bytes = pix.tobytes("png")
            images.append(base64.b64encode(png_bytes).decode("utf-8"))
    finally:
        doc.close()
    return images


async def parse_resume_with_claude(pdf_bytes: bytes) -> str:
    """Send PDF pages as images to Claude vision, get a 1:1 text reproduction."""
    images = pdf_to_base64_images(pdf_bytes)

    content: list[dict] = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": "image/png", "data": b64_img},
        }
        for b64_img in images
    ]
    content.append(
        {"type": "text", "text": "Reproduce all the text content from this resume exactly as-is."}
    )

    text = await call_messages(
        system=load_prompt(PARSE_AGENT),
        messages=[{"role": "user", "content": content}],
        max_tokens=_settings().max_tokens_resume_parser,
        agent_name=PARSE_AGENT,
    )
    if not text.strip():
        raise LLMError("Resume parser returned empty text")
    return text


async def create_resume(pdf_bytes: bytes, name: str, filename: str) -> ResumeDetail:
    """Upload a PDF resume: Claude reads it visually, stores extracted text."""
    _validate_pdf(pdf_bytes)
    name = name.strip()
    if not name:
        raise ValidationError("Resume name is required")

    s = _settings()
    s.resumes_dir.mkdir(parents=True, exist_ok=True)

    # Run the LLM call OUTSIDE the lock — it's the slow part and doesn't touch shared state.
    content = await parse_resume_with_claude(pdf_bytes)

    resume_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    async with get_lock(INDEX_LOCK_KEY):
        index = _read_index()
        is_default = len(index["resumes"]) == 0

        _resume_pdf_path(resume_id).write_bytes(pdf_bytes)

        doc = {
            "id": resume_id,
            "name": name,
            "filename": filename,
            "is_default": is_default,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "content": content,
        }
        _write_doc(doc)

        index["resumes"].append(resume_id)
        if is_default:
            index["default_resume_id"] = resume_id
        _write_index(index)

    logger.info("resume.created id=%s name=%s default=%s", resume_id, name, is_default)
    return ResumeDetail(**doc)


def list_resumes() -> list[ResumeMetadata]:
    """List all resumes (metadata only, no content)."""
    index = _read_index()
    results: list[ResumeMetadata] = []
    for rid in index["resumes"]:
        doc = _read_doc(rid)
        if doc is not None:
            results.append(
                ResumeMetadata(
                    id=doc["id"],
                    name=doc["name"],
                    filename=doc["filename"],
                    is_default=doc["is_default"],
                    created_at=doc["created_at"],
                    updated_at=doc["updated_at"],
                )
            )
    return results


def get_resume(resume_id: str) -> ResumeDetail | None:
    doc = _read_doc(resume_id)
    return ResumeDetail(**doc) if doc else None


def get_default_resume() -> ResumeDetail | None:
    default_id = _read_index().get("default_resume_id")
    if not default_id:
        return None
    return get_resume(default_id)


async def set_default(resume_id: str) -> ResumeMetadata:
    async with get_lock(INDEX_LOCK_KEY):
        index = _read_index()
        if resume_id not in index["resumes"]:
            raise NotFoundError(f"Resume {resume_id} not found")

        old_default = index.get("default_resume_id")
        if old_default and old_default != resume_id:
            old_doc = _read_doc(old_default)
            if old_doc is not None:
                old_doc["is_default"] = False
                _write_doc(old_doc)

        index["default_resume_id"] = resume_id
        _write_index(index)

        doc = _read_doc(resume_id)
        if doc is None:
            raise NotFoundError(f"Resume {resume_id} not found")
        doc["is_default"] = True
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        _write_doc(doc)

    logger.info("resume.set_default id=%s", resume_id)
    return ResumeMetadata(**{k: doc[k] for k in ResumeMetadata.model_fields})


async def update_resume(resume_id: str, pdf_bytes: bytes) -> ResumeDetail:
    """Re-upload and re-parse a resume."""
    _validate_pdf(pdf_bytes)

    doc = _read_doc(resume_id)
    if doc is None:
        raise NotFoundError(f"Resume {resume_id} not found")

    content = await parse_resume_with_claude(pdf_bytes)

    async with get_lock(INDEX_LOCK_KEY):
        # Re-read in case it was deleted between the check above and now.
        doc = _read_doc(resume_id)
        if doc is None:
            raise NotFoundError(f"Resume {resume_id} not found")

        _resume_pdf_path(resume_id).write_bytes(pdf_bytes)
        doc["content"] = content
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        _write_doc(doc)

    logger.info("resume.updated id=%s", resume_id)
    return ResumeDetail(**doc)


async def delete_resume(resume_id: str) -> bool:
    async with get_lock(INDEX_LOCK_KEY):
        index = _read_index()
        if resume_id not in index["resumes"]:
            return False

        _resume_json_path(resume_id).unlink(missing_ok=True)
        _resume_pdf_path(resume_id).unlink(missing_ok=True)

        index["resumes"].remove(resume_id)
        if index["default_resume_id"] == resume_id:
            index["default_resume_id"] = index["resumes"][0] if index["resumes"] else None
            if index["default_resume_id"]:
                new_doc = _read_doc(index["default_resume_id"])
                if new_doc is not None:
                    new_doc["is_default"] = True
                    _write_doc(new_doc)
        _write_index(index)

    logger.info("resume.deleted id=%s", resume_id)
    return True
