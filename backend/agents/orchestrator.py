"""Orchestrator — sequences the pipeline: Gap Analyzer -> [Cover Letter || Interview Coach]."""

import asyncio
import time
from typing import AsyncGenerator

from ..logging_config import get_logger
from .cover_letter_writer import write_cover_letter
from .gap_analyzer import analyze_gaps
from .interview_coach import generate_interview_prep

logger = get_logger(__name__)


async def run_pipeline_stream(jd: str, resume_content: str) -> AsyncGenerator[dict, None]:
    """Run the full agent pipeline as an async generator yielding SSE events."""

    pipeline_start = time.monotonic()
    logger.info("pipeline.start jd_chars=%d resume_chars=%d", len(jd), len(resume_content))

    # Step 1: Gap Analysis
    yield {"event": "agent_start", "data": {"agent": "gap_analyzer"}}
    t0 = time.monotonic()
    gap_report = await analyze_gaps(jd, resume_content)
    logger.info("agent.done agent=gap_analyzer elapsed=%.2fs", time.monotonic() - t0)
    yield {"event": "agent_done", "data": {"agent": "gap_analyzer", "result": gap_report}}

    # Step 2 & 3: Cover Letter + Interview Prep in parallel
    yield {"event": "agent_start", "data": {"agent": "cover_letter_writer"}}
    yield {"event": "agent_start", "data": {"agent": "interview_coach"}}

    t0 = time.monotonic()
    cover_letter, interview_prep = await asyncio.gather(
        write_cover_letter(jd, gap_report),
        generate_interview_prep(jd, gap_report),
    )
    logger.info("agent.done agent=parallel(cover+interview) elapsed=%.2fs", time.monotonic() - t0)

    yield {"event": "agent_done", "data": {"agent": "cover_letter_writer", "result": cover_letter}}
    yield {"event": "agent_done", "data": {"agent": "interview_coach", "result": interview_prep}}

    logger.info("pipeline.done total_elapsed=%.2fs", time.monotonic() - pipeline_start)

    yield {
        "event": "pipeline_done",
        "data": {
            "gap_report": gap_report,
            "cover_letter": cover_letter,
            "interview_prep": interview_prep,
        },
    }
