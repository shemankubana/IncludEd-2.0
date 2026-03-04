"""
IncludEd AI Service – FastAPI Application v2.1
===============================================
New in v2.1:
  • Language auto-detection (EN/FR) on every /analyze call
  • Emotion analysis for play dialogue (DistilRoBERTa + NRC lexicon fallback)
  • FLAN-T5 quiz generation tier (Ollama → FLAN-T5 → templates)
  • POST /detect-language       — detect EN/FR of text
  • POST /analyze/emotions      — batch emotion analysis on dialogue list
  • POST /quiz/generate         — on-demand quiz for specific content
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import asyncio
from dotenv import load_dotenv

import time
from services.tts_service                import TTSService
from services.accessibility_adapter      import FreeAccessibilityAdapter
from services.rl_agent_service           import RLAgentService
from services.smart_question_generator   import SmartQuestionGenerator
from services.ollama_service             import OllamaService
from ml_pipeline import LiteratureAnalyzer

# ML pipeline singleton (reused across requests)
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
question_gen          = SmartQuestionGenerator()
accessibility_adapter = FreeAccessibilityAdapter()
rl_agent              = RLAgentService()
tts_service           = TTSService()
ollama_service        = OllamaService()

# ── Models ────────────────────────────────────────────────────────────────────

class AnalyzeTextRequest(BaseModel):
    text: str
    filename: Optional[str] = "document.txt"
    generate_questions: bool = True
    question_count: int = 5


class AnalyzeResponse(BaseModel):
    document_type: str
    title: str
    author: Optional[str] = None
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
        document_type = result.document_type,
        title         = result.title,
        author        = result.author,
        confidence    = result.confidence,
        units         = result.units,
        flat_units    = result.flat_units,
        questions     = result.questions,
        metadata      = result.metadata,
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
        document_type = result.document_type,
        title         = result.title,
        author        = result.author,
        confidence    = result.confidence,
        units         = result.units,
        flat_units    = result.flat_units,
        questions     = result.questions,
        metadata      = result.metadata,
    )

# ── Introduction Generation ───────────────────────────────────────────────────

class IntroductionRequest(BaseModel):
    title:           str
    author:          str
    content_summary: str = ""
    doc_type:        str = "generic"   # "play" | "novel" | "generic"
    language:        str = "en"        # "en" | "fr"


@app.post("/introduction/generate", tags=["literature"])
async def generate_introduction(req: IntroductionRequest):
    """
    Generate a short student-friendly introduction for a book.
    Tries Ollama first; falls back to a structured template.
    """
    doc_label_en = {"play": "play", "novel": "novel"}.get(req.doc_type, "text")
    doc_label_fr = {"play": "pièce de théâtre", "novel": "roman"}.get(req.doc_type, "texte")

    # ── Try Ollama (local LLM) ────────────────────────────────────────────────
    try:
        if req.language == "fr":
            prompt = (
                f"Écris une courte introduction (3-4 phrases) de la {doc_label_fr} "
                f'"{req.title}" écrite par {req.author}. '
                f"L'introduction doit être simple, engageante et adaptée aux élèves du secondaire. "
                f"Voici un extrait du début : {req.content_summary[:500]}"
            )
        else:
            prompt = (
                f'Write a short introduction (3-4 sentences) for the {doc_label_en} '
                f'"{req.title}" written by {req.author}. '
                f"Keep it simple, engaging, and suitable for secondary school students. "
                f"Here is an excerpt from the beginning: {req.content_summary[:500]}"
            )
        result = await ollama_service.generate(prompt, max_tokens=200)
        if result and len(result.strip()) > 30:
            return {"introduction": result.strip()}
    except Exception:
        pass  # fall through to template

    # ── Template fallback ────────────────────────────────────────────────────
    snippet = req.content_summary[:200].strip().rstrip(".") + "…" if req.content_summary else ""

    if req.language == "fr":
        intro = (
            f'"{req.title}" est une {doc_label_fr} écrite par {req.author}. '
            f"Ce texte vous emmène dans une histoire fascinante pleine de personnages mémorables et de moments captivants. "
        )
        if snippet:
            intro += f'Elle commence ainsi : « {snippet} » '
        intro += "Bonne lecture !"
    else:
        intro = (
            f'"{req.title}" is a {doc_label_en} written by {req.author}. '
            f"This text takes you on a fascinating journey with memorable characters and captivating moments. "
        )
        if snippet:
            intro += f'It begins: "{snippet}" '
        intro += "Enjoy reading!"

    return {"introduction": intro}


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


# ── System ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health():
    return {
        "status":         "healthy",
        "version":        "2.1.0",
        "rl_model_ready": rl_agent.model_ready,
        "timestamp":      time.time(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)
