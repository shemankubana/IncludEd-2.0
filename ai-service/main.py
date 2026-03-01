"""
IncludEd AI Service – FastAPI Application
==========================================
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
import time
import asyncio
import tempfile
from dotenv import load_dotenv
import shutil

# Service imports
from services.smart_question_generator import SmartQuestionGenerator
from services.accessibility_adapter import FreeAccessibilityAdapter
from services.rl_agent_service    import RLAgentService
from services.attention_monitor   import AttentionMonitor
from services.session_manager     import SessionManager
from services.tts_service         import TTSService
from services.video_service       import VideoService
from services.ollama_service      import OllamaService
from ml_pipeline import LiteratureAnalyzer

# ML pipeline singleton
_literature_analyzer = LiteratureAnalyzer()

load_dotenv()
app = FastAPI(title="IncludEd AI Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service singletons
question_gen = SmartQuestionGenerator()
accessibility_adapter = FreeAccessibilityAdapter()
rl_agent = RLAgentService()
session_manager = SessionManager()
tts_service = TTSService()
video_service = VideoService()
ollama_service = OllamaService()

# ── Models ────────────────────────────────────────────────────────────────────

class AnalyzeTextRequest(BaseModel):
    text: str
    filename: Optional[str] = "document.txt"
    generate_questions: bool = True
    question_count: int = 5

class AnalyzeResponse(BaseModel):
    document_type: str
    title: str
    confidence: float
    units: List[Dict[str, Any]]
    flat_units: List[Dict[str, Any]]
    questions: List[Dict[str, Any]]
    metadata: Dict[str, Any]

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "healthy", "service": "IncludEd AI Service"}

@app.post("/analyze", response_model=AnalyzeResponse, tags=["literature"])
async def analyze_pdf(
    file: UploadFile = File(...),
    generate_questions: bool = True,
    question_count: int = 5,
):
    pdf_bytes = await file.read()
    result = await asyncio.to_thread(
        _literature_analyzer.analyze,
        pdf_bytes,
        file.filename,
        generate_questions,
        question_count,
    )
    return AnalyzeResponse(
        document_type=result.document_type,
        title=result.title,
        confidence=result.confidence,
        units=result.units,
        flat_units=result.flat_units,
        questions=result.questions,
        metadata=result.metadata,
    )

@app.post("/reanalyze-text", response_model=AnalyzeResponse, tags=["literature"])
async def reanalyze_text(req: AnalyzeTextRequest):
    result = await asyncio.to_thread(
        _literature_analyzer.analyze_text,
        req.text,
        req.filename or "legacy_content",
        req.generate_questions,
        req.question_count,
    )
    return AnalyzeResponse(
        document_type=result.document_type,
        title=result.title,
        confidence=result.confidence,
        units=result.units,
        flat_units=result.flat_units,
        questions=result.questions,
        metadata=result.metadata,
    )

# ── Helper Endpoints ──

@app.post("/adapt-text")
async def adapt_text(request: Any):
    return {"adaptedText": request.text[:5000], "strategy": "Original"}

@app.post("/tts/generate")
async def generate_tts(request: Any):
    return await tts_service.generate_with_timestamps(text=request.text)

@app.post("/session/start")
async def start_session(request: Any):
    return {"session_id": "mock_session"}

@app.post("/session/telemetry")
async def push_telemetry(request: Any):
    return {"status": "ok"}

@app.post("/session/end")
async def end_session(request: Any):
    return {"status": "finished"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)