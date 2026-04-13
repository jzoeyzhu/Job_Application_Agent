"""Agent 2: Gap Analyzer — maps resume experience to JD requirements using CAG."""

from ..config import get_settings
from ..llm import call_json
from ..utils import load_prompt

AGENT_NAME = "gap_analyzer"


async def analyze_gaps(jd: str, resume_content: str) -> dict:
    user_content = (
        f"## Job Description\n{jd}\n\n"
        f"## Candidate Resume\n{resume_content}"
    )
    return await call_json(
        system=load_prompt(AGENT_NAME),
        messages=[{"role": "user", "content": user_content}],
        max_tokens=get_settings().max_tokens_gap_analyzer,
        agent_name=AGENT_NAME,
    )
