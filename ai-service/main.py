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
from ml_pipeline import (
    LiteratureAnalyzer,
    get_emotion_analyzer,
    get_language_detector,
)

# ML pipeline singleton (reused across requests)
_literature_analyzer = LiteratureAnalyzer()

load_dotenv()
app = FastAPI(
    title       = "IncludEd AI Service",
    version     = "2.1.0",
    description = "Multilingual PDF Literature Analyzer for Dyslexia/ADHD learners",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service singletons
question_gen        = SmartQuestionGenerator()
accessibility_adapter = FreeAccessibilityAdapter()
rl_agent            = RLAgentService()
session_manager     = SessionManager()
tts_service         = TTSService()
video_service       = VideoService()
ollama_service      = OllamaService()


# ── Pydantic Models ────────────────────────────────────────────────────────────

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
    language: str = "en"


class AdaptTextRequest(BaseModel):
    text: str
    disability_type: Optional[str] = "none"
    simplification_level: Optional[int] = 1


class RLPredictRequest(BaseModel):
    state_vector: List[float] = Field(..., min_length=8, max_length=8)


class RLPredictResponse(BaseModel):
    action_id: int
    action_label: str
    model_used: str
    state_received: List[float]
    latency_ms: float


class TelemetryRequest(BaseModel):
    events: List[Dict[str, Any]]
    session_id: Optional[str] = None


class SimplifyRequest(BaseModel):
    text: str
    action_id: int
    disability_type: Optional[str] = "none"
    language: Optional[str] = "en"


# ── NEW v2.1 models ────────────────────────────────────────────────────────────

class DetectLanguageRequest(BaseModel):
    text: str


class EmotionRequest(BaseModel):
    """Single or batch dialogue emotion analysis."""
    texts: List[str]
    language: Optional[str] = "en"


class EmotionResponse(BaseModel):
    results: List[Dict[str, Any]]
    ml_used: bool


class QuizGenerateRequest(BaseModel):
    content: str
    doc_type: Optional[str] = "generic"   # "play" | "novel" | "generic"
    count: Optional[int] = 5
    language: Optional[str] = "en"
    unit_title: Optional[str] = None


# ── Core Literature Endpoints ──────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "status":  "healthy",
        "service": "IncludEd AI Service",
        "version": "2.1.0",
        "features": [
            "PDF analysis (EN/FR)",
            "emotion-tagged dialogue",
            "FLAN-T5 + Ollama quiz generation",
            "RL adaptation",
        ],
    }


@app.post("/analyze", response_model=AnalyzeResponse, tags=["literature"])
async def analyze_pdf(
    file: UploadFile = File(...),
    generate_questions: bool = True,
    question_count: int = 5,
):
    """
    Upload a PDF → full ML pipeline:
      1. Extract text (PyMuPDF)
      2. Remove front matter
      3. Detect language (EN/FR)
      4. Classify document type (play/novel/generic)
      5. Segment into chapters/acts/scenes with emotion tagging
      6. Generate pedagogical MCQs
    """
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
        confidence    = result.confidence,
        units         = result.units,
        flat_units    = result.flat_units,
        questions     = result.questions,
        metadata      = result.metadata,
        language      = result.language,
    )


@app.post("/reanalyze-text", response_model=AnalyzeResponse, tags=["literature"])
async def reanalyze_text(req: AnalyzeTextRequest):
    """Re-analyze raw text (no file upload)."""
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
        confidence    = result.confidence,
        units         = result.units,
        flat_units    = result.flat_units,
        questions     = result.questions,
        metadata      = result.metadata,
        language      = result.language,
    )


# ── Language Detection ─────────────────────────────────────────────────────────

@app.post("/detect-language", tags=["language"])
async def detect_language(req: DetectLanguageRequest):
    """
    Detect EN/FR for a text sample.

    Returns: { language: "en"|"fr", confidence: float, method: str }
    """
    ld = get_language_detector()
    result = await asyncio.to_thread(ld.detect, req.text)
    return result


# ── Emotion Analysis ───────────────────────────────────────────────────────────

@app.post("/analyze/emotions", response_model=EmotionResponse, tags=["emotions"])
async def analyze_emotions(req: EmotionRequest):
    """
    Batch emotion analysis for a list of dialogue lines.

    Each result contains:
      { emotion, intensity, anim: { expression, eyebrows, mouth, eyes, color_tint } }

    Use cases:
      - Pre-load emotion data for PlayDialogueUI
      - Animate character avatars based on detected emotion
    """
    if not req.texts:
        return EmotionResponse(results=[], ml_used=False)

    ea = get_emotion_analyzer()
    results = await asyncio.to_thread(
        ea.analyze_batch,
        req.texts,
        req.language or "en",
    )
    return EmotionResponse(results=results, ml_used=ea.ml_ready)


@app.post("/analyze/emotion-single", tags=["emotions"])
async def analyze_emotion_single(req: DetectLanguageRequest):
    """Analyze emotion for a single text line. Convenience endpoint."""
    ea = get_emotion_analyzer()
    result = await asyncio.to_thread(
        ea.analyze,
        req.text,
        "en",
    )
    return result


# ── Quiz Generation ────────────────────────────────────────────────────────────

@app.post("/quiz/generate", tags=["quiz"])
async def generate_quiz(req: QuizGenerateRequest):
    """
    On-demand pedagogical MCQ generation.

    Generation pipeline: Ollama (if available) → FLAN-T5 → content-aware templates

    Returns: { questions: [...], count: int, doc_type: str, generator: str }
    """
    qgen = _literature_analyzer._qgen  # reuse singleton (PedagogicalQuestionGenerator)

    count = max(1, min(req.count or 5, 10))

    questions = await asyncio.to_thread(
        qgen.generate,
        req.content,
        req.doc_type or "generic",
        count,
        req.language or "en",
    )

    # Attach unit context if provided
    if req.unit_title:
        for q in questions:
            q.setdefault("unit_title", req.unit_title)

    return {
        "questions": questions,
        "count":     len(questions),
        "doc_type":  req.doc_type,
        "language":  req.language,
    }


# ── RL Endpoints ───────────────────────────────────────────────────────────────

@app.post("/rl/predict", response_model=RLPredictResponse, tags=["rl"])
async def rl_predict(req: RLPredictRequest):
    """
    Real-time RL action prediction from 8-dim state vector.
    Latency target: <500ms.
    """
    t0 = time.perf_counter()
    action_id, action_label = rl_agent.predict_from_state_vector(req.state_vector)
    latency_ms = (time.perf_counter() - t0) * 1000

    return RLPredictResponse(
        action_id     = action_id,
        action_label  = action_label,
        model_used    = "ppo" if rl_agent.model_ready else "rule_based",
        state_received = req.state_vector,
        latency_ms    = round(latency_ms, 2),
    )


@app.post("/rl/status", tags=["rl"])
async def rl_status():
    return rl_agent.status()


@app.post("/rl/reload", tags=["rl"])
async def rl_reload():
    rl_agent.reload_model()
    return {"status": "reloaded", "model_ready": rl_agent.model_ready}


# ── Accessibility / Adaptation Endpoints ──────────────────────────────────────

@app.post("/adapt-text", tags=["adaptation"])
async def adapt_text(req: AdaptTextRequest):
    """Apply accessibility adaptation to text."""
    disability_profile = (
        {"disabilities": [req.disability_type]}
        if req.disability_type != "none"
        else None
    )
    action_id, _ = rl_agent.predict_action(
        text_difficulty   = 0.5,
        student_focus     = 0.7,
        disability_profile = disability_profile,
    )
    adapted = accessibility_adapter.adapt_text(
        req.text,
        disability_type = req.disability_type or "none",
    )
    return {"adaptedText": adapted, "strategy": action_id, "action_id": action_id}


@app.post("/simplify", tags=["adaptation"])
async def simplify_text(req: SimplifyRequest):
    """
    Apply a specific RL action to text.

    action_id:
      0 = Keep Original
      1 = Light Simplification (vocabulary)
      2 = Heavy Simplification (full pipeline)
      3 = TTS + Highlights
      4 = Syllable Break
      5 = Attention Break (micro-sections)
    """
    text   = req.text
    result = {
        "original": text,
        "adapted":  text,
        "action_id": req.action_id,
        "tts":      False,
        "syllables": False,
    }

    if req.action_id == 1:
        result["adapted"] = accessibility_adapter.adapt_text(
            text, disability_type="dyslexia"
        )

    elif req.action_id == 2:
        result["adapted"] = accessibility_adapter.adapt_text(
            text, disability_type="adhd"
        )

    elif req.action_id == 3:
        result["tts"]      = True
        result["syllables"] = True

    elif req.action_id == 4:
        words = text.split()
        syllabified = []
        for w in words:
            if len(w) > 6:
                chunks = [w[i:i+3] for i in range(0, len(w), 3)]
                syllabified.append("·".join(chunks))
            else:
                syllabified.append(w)
        result["adapted"]   = " ".join(syllabified)
        result["syllables"] = True

    elif req.action_id == 5:
        sentences = [
            s.strip()
            for s in text.replace("!", ".").replace("?", ".").split(".")
            if s.strip()
        ]
        chunks = [
            ". ".join(sentences[i:i+2]) + "."
            for i in range(0, len(sentences), 2)
        ]
        result["adapted"] = "\n\n---\n\n".join(chunks)

    return result


# ── Session / Telemetry ────────────────────────────────────────────────────────

@app.post("/session/telemetry", tags=["session"])
async def push_telemetry(req: TelemetryRequest):
    """Process a batch of telemetry events and return updated attention state."""
    attention_monitor = AttentionMonitor()
    telemetry_data = {
        "mouse_speed":       0.5,
        "mouse_dwell":       0.0,
        "scroll_back_count": 0,
        "key_latency":       0.0,
        "idle_duration":     0.0,
        "reading_speed_wpm": 120,
        "backtrack_count":   0,
    }

    for ev in req.events:
        if ev.get("type") == "mouse_pause":
            telemetry_data["mouse_dwell"] = max(
                telemetry_data["mouse_dwell"],
                ev.get("payload", {}).get("dwell_ms", 0) / 1000.0,
            )
        elif ev.get("type") == "backtrack":
            telemetry_data["backtrack_count"] += 1
        elif ev.get("type") == "attention_lapse":
            telemetry_data["idle_duration"] += (
                ev.get("payload", {}).get("idle_ms", 0) / 1000.0
            )
        elif ev.get("type") == "reading_speed":
            telemetry_data["reading_speed_wpm"] = (
                ev.get("payload", {}).get("wpm", 120)
            )

    attention_state = attention_monitor.process(telemetry_data)
    return {"status": "ok", "attention_state": attention_state.__dict__}


@app.post("/session/start", tags=["session"])
async def start_session():
    return {"session_id": "mock_session"}


@app.post("/session/end", tags=["session"])
async def end_session():
    return {"status": "finished"}


# ── System ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health():
    ea = get_emotion_analyzer()
    return {
        "status":              "healthy",
        "version":             "2.1.0",
        "rl_model_ready":      rl_agent.model_ready,
        "emotion_ml_ready":    ea.ml_ready,
        "timestamp":           time.time(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)
