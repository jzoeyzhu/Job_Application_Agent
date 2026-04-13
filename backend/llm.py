"""Thin wrapper around the Anthropic client.

Centralizes:
- A single shared AsyncAnthropic instance (so connections are pooled).
- Retries on transient API/network errors.
- Robust JSON extraction (handles stray prose / markdown fences).
"""

from __future__ import annotations

import json
import re
from typing import Any

import anthropic
from anthropic import AsyncAnthropic
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .config import get_settings
from .exceptions import LLMError, LLMParseError
from .logging_config import get_logger

logger = get_logger(__name__)

_client: AsyncAnthropic | None = None


def get_client() -> AsyncAnthropic:
    """Return a process-wide AsyncAnthropic client."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = AsyncAnthropic(
            api_key=settings.anthropic_api_key or None,
            timeout=settings.llm_timeout_seconds,
            max_retries=0,  # we own retries via tenacity
        )
    return _client


_RETRYABLE = (
    anthropic.APIConnectionError,
    anthropic.APITimeoutError,
    anthropic.RateLimitError,
    anthropic.InternalServerError,
)


async def call_messages(
    *,
    system: str,
    messages: list[dict[str, Any]],
    max_tokens: int,
    agent_name: str,
) -> str:
    """Call the Anthropic Messages API with retries; return the text content."""
    settings = get_settings()
    client = get_client()

    attempt = 0
    async for retry in AsyncRetrying(
        retry=retry_if_exception_type(_RETRYABLE),
        stop=stop_after_attempt(settings.llm_max_retries),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    ):
        with retry:
            attempt += 1
            logger.info("llm.call agent=%s attempt=%d", agent_name, attempt)
            try:
                response = await client.messages.create(
                    model=settings.model,
                    max_tokens=max_tokens,
                    system=system,
                    messages=messages,
                )
            except _RETRYABLE as e:
                logger.warning(
                    "llm.retryable agent=%s attempt=%d error=%s",
                    agent_name,
                    attempt,
                    e.__class__.__name__,
                )
                raise
            except anthropic.BadRequestError as e:
                raise LLMError(f"{agent_name}: bad request to Anthropic API: {e}") from e
            except anthropic.AuthenticationError as e:
                raise LLMError(f"{agent_name}: authentication failed", status_code=500) from e
            except anthropic.APIError as e:
                raise LLMError(f"{agent_name}: Anthropic API error: {e}") from e

    # Concatenate all text blocks (Claude can return multiple)
    parts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
    text = "".join(parts).strip()
    if not text:
        raise LLMError(f"{agent_name}: empty response from model")
    return text


_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def extract_json(text: str) -> Any:
    """Best-effort JSON parse: strips markdown fences and stray prose."""
    candidate = text.strip()

    # 1. Direct parse
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # 2. Inside a ```json ... ``` fence
    m = _FENCE_RE.search(candidate)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            pass

    # 3. First {...} or [...] block
    for opener, closer in (("{", "}"), ("[", "]")):
        start = candidate.find(opener)
        end = candidate.rfind(closer)
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(candidate[start : end + 1])
            except json.JSONDecodeError:
                continue

    raise LLMParseError(f"Could not parse JSON from model output: {text[:300]}...")


async def call_json(
    *,
    system: str,
    messages: list[dict[str, Any]],
    max_tokens: int,
    agent_name: str,
) -> Any:
    """call_messages + JSON extraction."""
    text = await call_messages(
        system=system, messages=messages, max_tokens=max_tokens, agent_name=agent_name
    )
    return extract_json(text)
