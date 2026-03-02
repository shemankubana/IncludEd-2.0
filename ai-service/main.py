"""
IncludEd AI Service – FastAPI Application
==========================================
ML-powered PDF analysis and accessibility service for students
with Dyslexia and ADHD. Receives literature PDFs, classifies them,
segments into chapters/scenes, filters front matter, and provides
TTS with word-level timestamps.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import asyncio
from dotenv import load_dotenv

from services.tts_service import TTSService
from services.accessibility_adapter import FreeAccessibilityAdapter
from services.ollama_service import OllamaService
from ml_pipeline import LiteratureAnalyzer

# ML pipeline singleton
_literature_analyzer = LiteratureAnalyzer()

load_dotenv()
app = FastAPI(title="IncludEd AI Service", version="2.0.0",
              description="ML-powered PDF accessibility pipeline for neurodivergent learners")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service singletons
accessibility_adapter = FreeAccessibilityAdapter()
tts_service = TTSService()
ollama_service = OllamaService()

# ── Request/Response Models ──────────────────────────────────────────────────

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

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "en-KE-AsminaNeural"
    rate: Optional[str] = "+0%"

class AdaptTextRequest(BaseModel):
    text: str
    level: Optional[str] = "accessible"
    disabilities: Optional[List[str]] = None

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "healthy", "service": "IncludEd AI Service",
            "purpose": "ML-powered PDF accessibility for Dyslexia & ADHD"}

@app.post("/analyze", response_model=AnalyzeResponse, tags=["literature"])
async def analyze_pdf(
    file: UploadFile = File(...),
    generate_questions: bool = True,
    question_count: int = 5,
):
    """Analyze a PDF: classify type, segment structure, filter front matter, generate questions."""
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
    """Re-analyze raw text content (no PDF) through the ML pipeline."""
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

@app.post("/adapt-text", tags=["accessibility"])
async def adapt_text(request: AdaptTextRequest):
    """Adapt text for accessibility (simplify vocabulary, break sentences, dyslexia/ADHD modes)."""
    disability_profile = {"disabilities": request.disabilities} if request.disabilities else None
    adapted = accessibility_adapter.adapt_text(
        text=request.text,
        level=request.level,
        disability_profile=disability_profile,
    )
    return {"adaptedText": adapted, "originalLength": len(request.text), "adaptedLength": len(adapted)}

@app.post("/tts/generate", tags=["tts"])
async def generate_tts(request: TTSRequest):
    """Generate TTS audio with word-level timestamps for synchronized highlighting."""
    result = await tts_service.generate_with_timestamps(
        text=request.text,
        voice=request.voice,
        rate=request.rate,
    )
    return result

@app.get("/tts/voices", tags=["tts"])
async def list_voices():
    """List available TTS voices."""
    return {"voices": TTSService.VOICES}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)
