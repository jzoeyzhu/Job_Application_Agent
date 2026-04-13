# Job Application Agent

A multi-agent AI system that takes a job description and your resume, then produces a tailored gap analysis, cover letter, and full interview prep — in one shot.

Built end-to-end with Claude Code and the Anthropic API.

---

## What it does

Paste a JD, select your resume, and the agent pipeline runs automatically:

1. **Gap Analyzer** — maps every requirement in the JD against your resume, scores each skill as Strong / Adjacent / Gap, and writes bridge suggestions for weak spots
2. **Cover Letter Writer** — generates a tailored, honest cover letter grounded in your actual experience
3. **Interview Coach** — produces behavioral questions with STAR talking points, role-specific technical questions, and a curated LeetCode set — all sourced from the JD

The three agents run with real-time SSE streaming so you can watch progress as it happens.

---

## Screenshots

### Gap Analysis
![Gap Analysis](docs/gap_analysis.png)

### Cover Letter
![Cover Letter](docs/cover_letter.png)

### Behavioral Questions
![Behavioral](docs/behavioral.png)

### Technical Questions
![Technical](docs/technical.png)

### LeetCode Set
![LeetCode](docs/leetcode.png)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + Tailwind CSS |
| Backend | FastAPI (Python) |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Streaming | SSE (Server-Sent Events) |
| Resume parsing | Claude + file-based cache (parse once, reuse) |
| Agent framework | Custom orchestrator — no LangChain, no abstraction layers |

---

## Architecture

```
User uploads Resume PDF (one-time, parsed and cached to disk)
        │
        ▼
User pastes JD + selects resume
        │
        ▼
┌─────────────────────────────┐
│        Orchestrator         │
└─────────────────────────────┘
        │
        ▼
┌───────────────────┐
│   Gap Analyzer    │ 
└───────────────────┘
        │
        ▼ (parallel)
┌──────────────────┐   ┌──────────────────────┐
│  Cover Letter    │   │   Interview Coach    │
│  Writer          │   │                      │
└──────────────────┘   └──────────────────────┘
```

Resume is passed as full context (Context-Augmented Generation) — no chunking, no retrieval. Resumes are short enough that the whole thing fits in one prompt.

---

## Running locally

**Prerequisites:** Python 3.11+, Node.js 18+, Anthropic API key

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=your_key_here
```

Start the server:

```bash
uvicorn backend.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project structure

```
├── backend/
│   ├── agents/
│   │   ├── orchestrator.py       # sequences the pipeline
│   │   ├── gap_analyzer.py
│   │   ├── cover_letter_writer.py
│   │   └── interview_coach.py
│   ├── prompts/                  # system prompts per agent
│   ├── main.py                   # FastAPI app + SSE endpoint
│   ├── resume_manager.py         # upload, parse, cache resumes
│   └── config.py                 # settings via pydantic-settings
├── frontend/
│   └── src/app/
│       ├── page.tsx              # home — JD input + resume picker
│       ├── analyze/page.tsx      # live pipeline progress
│       └── sessions/[id]/page.tsx # results
└── data/                         # resume cache + session results
```
