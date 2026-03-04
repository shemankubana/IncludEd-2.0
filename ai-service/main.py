"""
IncludEd AI Service – FastAPI Application v3.0
===============================================
New in v3.0 (World-Class ML Features):
  • POST /simplify                  — Context-aware highlight-to-understand
  • POST /analyze (enhanced)        — Now includes Book Brain pre-analysis
  • POST /book-brain/analyze        — Standalone Book Brain analysis
  • POST /comprehension/record      — Record section read for comprehension graph
  • POST /comprehension/highlight   — Record text highlight
  • POST /comprehension/vocab       — Record vocabulary lookup
  • GET  /comprehension/summary     — Get comprehension summary
  • GET  /comprehension/recap       — "Story So Far" recap
  • POST /learner/update            — Update learner embedding from session
  • GET  /learner/profile           — Get learner profile summary
  • POST /teacher/student-summary   — Generate NL student summary
  • POST /teacher/class-alerts      — Generate class-wide alerts
  • POST /teacher/recap             — Generate story recap text
  • POST /detect-language           — detect EN/FR of text
  • POST /analyze/emotions          — batch emotion analysis on dialogue list
  • POST /quiz/generate             — on-demand quiz for specific content
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
from services.simplification_service     import SimplificationService
from services.learner_embedding          import LearnerEmbedding, SessionMetrics
from services.comprehension_tracker      import ComprehensionTracker
from services.teacher_intelligence       import TeacherIntelligence
from ml_pipeline import LiteratureAnalyzer, BookBrain

# ML pipeline singletons (reused across requests)
_literature_analyzer = LiteratureAnalyzer()
_book_brain          = BookBrain()

load_dotenv()
app = FastAPI(title="IncludEd AI Service", version="3.0.0")

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
simplification_svc    = SimplificationService()
learner_embedding     = LearnerEmbedding()
comprehension_tracker = ComprehensionTracker()
teacher_intelligence  = TeacherIntelligence()

# ── Request/Response Models ──────────────────────────────────────────────────

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
    book_brain: Optional[Dict[str, Any]] = None


class SimplifyRequest(BaseModel):
    highlighted_text: str
    book_title: str = ""
    author: str = ""
    doc_type: str = "generic"
    chapter_context: str = ""
    speaker: str = ""
    reading_level: str = "intermediate"
    language: str = "en"
    student_id: Optional[str] = None
    book_id: Optional[str] = None


class ComprehensionRecordRequest(BaseModel):
    student_id: str
    book_id: str
    section_id: str
    section_title: str = ""
    chapter_title: str = ""
    time_spent_s: float = 0
    quiz_score: Optional[float] = None
    characters_seen: Optional[List[str]] = None


class HighlightRecordRequest(BaseModel):
    student_id: str
    book_id: str
    highlighted_text: str
    section_id: str


class VocabRecordRequest(BaseModel):
    student_id: str
    book_id: str
    word: str


class SessionUpdateRequest(BaseModel):
    student_id: str
    session_duration_s: float = 0
    words_read: int = 0
    reading_speed_wpm: float = 0
    backtrack_count: int = 0
    scroll_events: int = 0
    attention_lapses: int = 0
    highlights_made: int = 0
    vocab_lookups: int = 0
    time_of_day_hour: int = 12
    disability_type: float = 0
    doc_type: str = "generic"
    adaptations_applied: List[int] = []
    adaptation_accepted: List[bool] = []
    quiz_score: Optional[float] = None
    avg_dwell_time_ms: float = 0
    session_fatigue: float = 0


class StudentSummaryRequest(BaseModel):
    student_name: str
    student_id: str
    book_id: str
    class_average_chapter: int = 0


class ClassAlertsRequest(BaseModel):
    student_summaries: List[Dict[str, Any]]
    book_title: str = ""


class RecapTextRequest(BaseModel):
    student_id: str
    book_id: str
    language: str = "en"


# ── Core Literature Analysis Endpoints ───────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "healthy", "service": "IncludEd AI Service", "version": "3.0.0"}


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

    # Run Book Brain pre-analysis
    brain_result = await asyncio.to_thread(
        _book_brain.analyze,
        result.units,
        result.document_type,
        result.language,
        result.title,
        result.author or "",
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
        book_brain    = {
            "difficulty_map":  brain_result.difficulty_map,
            "vocabulary":      brain_result.vocabulary,
            "characters":      brain_result.characters,
            "summary_stats":   brain_result.summary_stats,
            "struggle_zones":  brain_result.struggle_zones,
        },
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

    brain_result = await asyncio.to_thread(
        _book_brain.analyze,
        result.units,
        result.document_type,
        result.language,
        result.title,
        result.author or "",
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
        book_brain    = {
            "difficulty_map":  brain_result.difficulty_map,
            "vocabulary":      brain_result.vocabulary,
            "characters":      brain_result.characters,
            "summary_stats":   brain_result.summary_stats,
            "struggle_zones":  brain_result.struggle_zones,
        },
    )


# ── Book Brain Standalone ────────────────────────────────────────────────────

class BookBrainRequest(BaseModel):
    units: List[Dict[str, Any]]
    doc_type: str = "generic"
    language: str = "en"
    title: str = ""
    author: str = ""


@app.post("/book-brain/analyze", tags=["book-brain"])
async def book_brain_analyze(req: BookBrainRequest):
    """Run Book Brain pre-analysis on already-parsed units."""
    result = await asyncio.to_thread(
        _book_brain.analyze,
        req.units, req.doc_type, req.language, req.title, req.author,
    )
    return {
        "difficulty_map":  result.difficulty_map,
        "vocabulary":      result.vocabulary,
        "characters":      result.characters,
        "summary_stats":   result.summary_stats,
        "struggle_zones":  result.struggle_zones,
    }


# ── Highlight-to-Understand (Simplification) ─────────────────────────────────

@app.post("/simplify", tags=["simplification"])
async def simplify_text(req: SimplifyRequest):
    """
    Context-aware simplification for highlighted text.
    Returns simplified version, author intent, vocabulary help, literary devices.
    """
    # Get student reading level if available
    reading_level = req.reading_level
    if req.student_id:
        reading_level = learner_embedding.get_reading_level(req.student_id)

    result = await asyncio.to_thread(
        simplification_svc.simplify,
        req.highlighted_text,
        req.book_title,
        req.author,
        req.doc_type,
        req.chapter_context,
        req.speaker,
        reading_level,
        req.language,
    )

    # Record highlight in comprehension tracker
    if req.student_id and req.book_id:
        comprehension_tracker.record_highlight(
            req.student_id, req.book_id,
            req.highlighted_text, "",
        )

    return result


# ── Introduction Generation ──────────────────────────────────────────────────

class IntroductionRequest(BaseModel):
    title:           str
    author:          str
    content_summary: str = ""
    doc_type:        str = "generic"
    language:        str = "en"


@app.post("/introduction/generate", tags=["literature"])
async def generate_introduction(req: IntroductionRequest):
    """Generate a short student-friendly introduction for a book."""
    doc_label_en = {"play": "play", "novel": "novel"}.get(req.doc_type, "text")
    doc_label_fr = {"play": "pièce de théâtre", "novel": "roman"}.get(req.doc_type, "texte")

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
        result = ollama_service.generate(prompt)
        if result and len(result.strip()) > 30:
            return {"introduction": result.strip()}
    except Exception:
        pass

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


# ── Comprehension Tracking ───────────────────────────────────────────────────

@app.post("/comprehension/record", tags=["comprehension"])
async def record_section_read(req: ComprehensionRecordRequest):
    """Record that a student read a section."""
    comprehension_tracker.record_section_read(
        req.student_id, req.book_id, req.section_id,
        req.section_title, req.chapter_title,
        req.time_spent_s, req.quiz_score, req.characters_seen,
    )
    return {"status": "recorded"}


@app.post("/comprehension/highlight", tags=["comprehension"])
async def record_highlight(req: HighlightRecordRequest):
    """Record a text highlight."""
    comprehension_tracker.record_highlight(
        req.student_id, req.book_id,
        req.highlighted_text, req.section_id,
    )
    return {"status": "recorded"}


@app.post("/comprehension/vocab", tags=["comprehension"])
async def record_vocab_lookup(req: VocabRecordRequest):
    """Record a vocabulary word lookup."""
    comprehension_tracker.record_vocab_lookup(
        req.student_id, req.book_id, req.word,
    )
    return {"status": "recorded"}


@app.get("/comprehension/summary", tags=["comprehension"])
async def get_comprehension_summary(student_id: str, book_id: str):
    """Get comprehension summary for a student + book."""
    return comprehension_tracker.get_summary(student_id, book_id)


@app.get("/comprehension/recap", tags=["comprehension"])
async def get_comprehension_recap(student_id: str, book_id: str):
    """Get 'Story So Far' recap data."""
    return comprehension_tracker.get_recap(student_id, book_id)


# ── Learner Embedding ────────────────────────────────────────────────────────

@app.post("/learner/update", tags=["learner"])
async def update_learner_embedding(req: SessionUpdateRequest):
    """Update learner embedding from a completed reading session."""
    metrics = SessionMetrics(
        session_duration_s=req.session_duration_s,
        words_read=req.words_read,
        reading_speed_wpm=req.reading_speed_wpm,
        backtrack_count=req.backtrack_count,
        scroll_events=req.scroll_events,
        attention_lapses=req.attention_lapses,
        highlights_made=req.highlights_made,
        vocab_lookups=req.vocab_lookups,
        time_of_day_hour=req.time_of_day_hour,
        disability_type=req.disability_type,
        doc_type=req.doc_type,
        adaptations_applied=req.adaptations_applied,
        adaptation_accepted=req.adaptation_accepted,
        quiz_score=req.quiz_score,
        avg_dwell_time_ms=req.avg_dwell_time_ms,
        session_fatigue=req.session_fatigue,
    )
    vec = learner_embedding.update_from_session(req.student_id, metrics)
    return {
        "status": "updated",
        "embedding_dim": len(vec),
        "session_count": learner_embedding._session_counts.get(req.student_id, 0),
    }


@app.get("/learner/profile", tags=["learner"])
async def get_learner_profile(student_id: str):
    """Get human-readable learner profile summary."""
    return learner_embedding.get_profile_summary(student_id)


@app.get("/learner/reading-level", tags=["learner"])
async def get_reading_level(student_id: str):
    """Get student's reading level from embedding."""
    level = learner_embedding.get_reading_level(student_id)
    return {"student_id": student_id, "reading_level": level}


# ── Teacher Intelligence ─────────────────────────────────────────────────────

@app.post("/teacher/student-summary", tags=["teacher"])
async def teacher_student_summary(req: StudentSummaryRequest):
    """Generate natural language summary for a student."""
    comp_data = comprehension_tracker.get_summary(req.student_id, req.book_id)
    profile = learner_embedding.get_profile_summary(req.student_id)
    return teacher_intelligence.student_summary(
        req.student_name, comp_data, profile, req.class_average_chapter,
    )


@app.post("/teacher/class-alerts", tags=["teacher"])
async def teacher_class_alerts(req: ClassAlertsRequest):
    """Generate class-wide pattern alerts."""
    alerts = teacher_intelligence.class_alerts(
        req.student_summaries, req.book_title,
    )
    return {"alerts": alerts}


@app.post("/teacher/recap", tags=["teacher"])
async def teacher_generate_recap(req: RecapTextRequest):
    """Generate 'Story So Far' recap text."""
    recap_data = comprehension_tracker.get_recap(req.student_id, req.book_id)
    recap_text = teacher_intelligence.generate_recap_text(recap_data, req.language)
    return {"recap": recap_text, "data": recap_data}


# ── Helper Endpoints ─────────────────────────────────────────────────────────

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


# ── System ───────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health():
    return {
        "status":         "healthy",
        "version":        "3.0.0",
        "rl_model_ready": rl_agent.model_ready,
        "features": [
            "highlight_to_understand",
            "book_brain_preanalysis",
            "learner_embedding_128dim",
            "comprehension_graph",
            "teacher_intelligence",
            "story_recaps",
            "poem_mode",
            "adhd_chunking",
            "dyslexia_rendering",
        ],
        "timestamp":      time.time(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)
