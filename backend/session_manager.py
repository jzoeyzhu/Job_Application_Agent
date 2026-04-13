"""Session management — each job application gets its own session."""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .config import get_settings
from .logging_config import get_logger
from .models import SessionDetail, SessionMetadata
from .utils import atomic_write_json, get_lock

logger = get_logger(__name__)

INDEX_LOCK_KEY = "session_index"


def _index_path() -> Path:
    return get_settings().sessions_dir / "_index.json"


def _session_path(session_id: str) -> Path:
    return get_settings().sessions_dir / f"{session_id}.json"


def _read_index() -> dict:
    path = _index_path()
    if not path.exists():
        return {"sessions": []}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_index(index: dict) -> None:
    atomic_write_json(_index_path(), index)


def _read_doc(session_id: str) -> dict | None:
    path = _session_path(session_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _write_doc(doc: dict) -> None:
    atomic_write_json(_session_path(doc["id"]), doc)


async def create_session(name: str, jd_text: str, resume_id: str) -> SessionDetail:
    get_settings().sessions_dir.mkdir(parents=True, exist_ok=True)

    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    doc = {
        "id": session_id,
        "name": name,
        "jd_text": jd_text,
        "resume_id": resume_id,
        "created_at": now.isoformat(),
        "status": "running",
        "results": None,
    }

    async with get_lock(INDEX_LOCK_KEY):
        _write_doc(doc)
        index = _read_index()
        index["sessions"].insert(0, session_id)
        _write_index(index)

    logger.info("session.created id=%s name=%s", session_id, name)
    return SessionDetail(**doc)


def list_sessions() -> list[SessionMetadata]:
    index = _read_index()
    results: list[SessionMetadata] = []
    for sid in index["sessions"]:
        doc = _read_doc(sid)
        if doc is not None:
            results.append(
                SessionMetadata(
                    id=doc["id"],
                    name=doc["name"],
                    resume_id=doc["resume_id"],
                    created_at=doc["created_at"],
                    status=doc["status"],
                )
            )
    return results


def get_session(session_id: str) -> SessionDetail | None:
    doc = _read_doc(session_id)
    return SessionDetail(**doc) if doc else None


async def save_results(session_id: str, results: dict) -> None:
    async with get_lock(f"session:{session_id}"):
        doc = _read_doc(session_id)
        if doc is None:
            return
        doc["results"] = results
        doc["status"] = "completed"
        _write_doc(doc)
    logger.info("session.completed id=%s", session_id)


async def mark_failed(session_id: str, error: str) -> None:
    async with get_lock(f"session:{session_id}"):
        doc = _read_doc(session_id)
        if doc is None:
            return
        doc["status"] = "failed"
        doc["results"] = {"error": error}
        _write_doc(doc)
    logger.warning("session.failed id=%s error=%s", session_id, error)


async def delete_session(session_id: str) -> bool:
    async with get_lock(INDEX_LOCK_KEY):
        index = _read_index()
        if session_id not in index["sessions"]:
            return False
        _session_path(session_id).unlink(missing_ok=True)
        index["sessions"].remove(session_id)
        _write_index(index)
    logger.info("session.deleted id=%s", session_id)
    return True
