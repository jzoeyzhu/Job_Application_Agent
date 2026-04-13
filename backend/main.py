"""FastAPI app — resume management, sessions, and agent analysis."""

import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from . import resume_manager, session_manager
from .agents.orchestrator import run_pipeline_stream
from .config import get_settings
from .exceptions import AppError, NotFoundError, ValidationError
from .logging_config import configure_logging, get_logger
from .models import (
    AnalyzeRequest,
    ResumeDetail,
    ResumeMetadata,
    SessionDetail,
    SessionMetadata,
)

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    settings.resumes_dir.mkdir(parents=True, exist_ok=True)
    settings.sessions_dir.mkdir(parents=True, exist_ok=True)
    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY is not set — LLM calls will fail")
    logger.info(
        "startup model=%s data_dir=%s",
        settings.model,
        settings.data_dir,
    )
    yield
    logger.info("shutdown")


app = FastAPI(title="Job Application Agent", version="1.0.0", lifespan=lifespan)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


# --- Exception handlers ---------------------------------------------------

@app.exception_handler(AppError)
async def handle_app_error(request: Request, exc: AppError):
    logger.warning("app_error path=%s status=%d msg=%s", request.url.path, exc.status_code, exc.message)
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message})


@app.exception_handler(Exception)
async def handle_unexpected(request: Request, exc: Exception):
    logger.exception("unhandled path=%s", request.url.path)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


# --- Health ---------------------------------------------------------------

@app.get("/health")
async def health():
    s = get_settings()
    return {
        "status": "ok",
        "model": s.model,
        "anthropic_key_configured": bool(s.anthropic_api_key),
    }


# --- Resume endpoints -----------------------------------------------------

def _validate_pdf_upload(file: UploadFile) -> None:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise ValidationError("Only PDF files are supported")


@app.post("/api/resumes/upload", response_model=ResumeDetail)
async def upload_resume(
    file: UploadFile = File(...),
    name: str = Form(...),
):
    _validate_pdf_upload(file)
    pdf_bytes = await file.read()
    return await resume_manager.create_resume(pdf_bytes, name, file.filename)


@app.get("/api/resumes", response_model=list[ResumeMetadata])
async def list_resumes():
    return resume_manager.list_resumes()


@app.get("/api/resumes/{resume_id}", response_model=ResumeDetail)
async def get_resume(resume_id: str):
    result = resume_manager.get_resume(resume_id)
    if not result:
        raise NotFoundError("Resume not found")
    return result


@app.put("/api/resumes/{resume_id}/default", response_model=ResumeMetadata)
async def set_default_resume(resume_id: str):
    return await resume_manager.set_default(resume_id)


@app.put("/api/resumes/{resume_id}/update", response_model=ResumeDetail)
async def update_resume(resume_id: str, file: UploadFile = File(...)):
    _validate_pdf_upload(file)
    pdf_bytes = await file.read()
    return await resume_manager.update_resume(resume_id, pdf_bytes)


@app.delete("/api/resumes/{resume_id}")
async def delete_resume(resume_id: str):
    if not await resume_manager.delete_resume(resume_id):
        raise NotFoundError("Resume not found")
    return {"ok": True}


# --- Session endpoints ----------------------------------------------------

@app.get("/api/sessions", response_model=list[SessionMetadata])
async def list_sessions():
    return session_manager.list_sessions()


@app.get("/api/sessions/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str):
    result = session_manager.get_session(session_id)
    if not result:
        raise NotFoundError("Session not found")
    return result


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    if not await session_manager.delete_session(session_id):
        raise NotFoundError("Session not found")
    return {"ok": True}


# --- Analysis endpoint ----------------------------------------------------

@app.post("/api/analyze")
async def analyze(request: AnalyzeRequest):
    resume = (
        resume_manager.get_resume(request.resume_id)
        if request.resume_id
        else resume_manager.get_default_resume()
    )
    if not resume:
        raise NotFoundError("No resume found. Upload one first.")

    session = await session_manager.create_session(
        request.session_name or "Untitled Application",
        request.jd_text,
        resume.id,
    )

    async def event_generator():
        yield {"event": "session_created", "data": json.dumps({"session_id": session.id})}

        final_results: dict = {}
        try:
            async for event in run_pipeline_stream(request.jd_text, resume.content):
                if event["event"] == "pipeline_done":
                    final_results = event["data"]
                yield {"event": event["event"], "data": json.dumps(event["data"])}

            await session_manager.save_results(session.id, final_results)
        except Exception as e:
            logger.exception("pipeline.failed session_id=%s", session.id)
            await session_manager.mark_failed(session.id, str(e))
            yield {"event": "error", "data": json.dumps({"message": str(e)})}

    return EventSourceResponse(event_generator())
