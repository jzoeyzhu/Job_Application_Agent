"""Small shared helpers: prompt loading and atomic JSON file writes."""

import asyncio
import json
import os
import tempfile
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Any

from .config import get_settings


@lru_cache(maxsize=64)
def load_prompt(name: str) -> str:
    """Load a prompt template from backend/prompts/<name>.md.

    Cached so each prompt is read from disk only once per process.
    """
    path = get_settings().prompts_dir / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")
    return path.read_text(encoding="utf-8").strip()


def atomic_write_json(path: Path, data: Any) -> None:
    """Write JSON atomically: write to a temp file in the same dir, then rename.

    Prevents partial/corrupt files if the process dies mid-write, and avoids
    readers seeing half-written content.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, indent=2, ensure_ascii=False)

    fd, tmp_path = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


# --- Per-key async locks --------------------------------------------------
# Used by resume_manager / session_manager to serialize writes to the same
# index or document, preventing the obvious read-modify-write races.

_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


def get_lock(key: str) -> asyncio.Lock:
    return _locks[key]
