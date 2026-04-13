"""Agent 3: Cover Letter Writer — generates a tailored cover letter."""

import json

from ..config import get_settings
from ..llm import call_json
from ..utils import load_prompt

AGENT_NAME = "cover_letter_writer"


async def write_cover_letter(jd: str, gap_report: dict) -> dict:
    user_content = (
        f"## Job Description\n{jd}\n\n"
        f"## Gap Report\n```json\n{json.dumps(gap_report, indent=2)}\n```"
    )
    return await call_json(
        system=load_prompt(AGENT_NAME),
        messages=[{"role": "user", "content": user_content}],
        max_tokens=get_settings().max_tokens_cover_letter,
        agent_name=AGENT_NAME,
    )
