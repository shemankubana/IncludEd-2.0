"""
IncludEd AI Service – FastAPI Application v4.0
===============================================
v3.0 features retained +
New in v4.0 (ML Components for Dyslexia Support):
  • POST /ner/extract               — Full NER character + location graph for a book
  • GET  /ner/section-view          — Spoiler-safe graph up to current section
  • POST /vocab/batch-analyze       — Pre-compute vocabulary for a full book at upload
  • POST /tts/synthesize            — TTS with word-level timestamps (disability-aware)
  • POST /quiz/record-attempt       — Record quiz result → update IRT difficulty model
  • GET  /quiz/recommend-difficulty — Get recommended difficulty for next quiz
  • GET  /quiz/student-state        — Full adaptive state for teacher dashboard
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from dotenv import load_dotenv

# Load environment variables IMMEDIATELY
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import asyncio
import time
from services.tts_service                import TTSService
from services.accessibility_adapter      import FreeAccessibilityAdapter
from services.rl_agent_service           import RLAgentService
from services.smart_question_generator   import SmartQuestionGenerator
from services.gemini_service             import GeminiService
from services.simplification_service     import SimplificationService
from services.learner_embedding          import LearnerEmbedding, SessionMetrics
from services.comprehension_tracker      import ComprehensionTracker
from services.teacher_intelligence       import TeacherIntelligence
from services.teacher_recommendations    import get_recommendation_engine, StudentRecommendation
from services.stt_service                import STTAssessmentService
from services.word_difficulty_service    import WordDifficultyService
from ml_pipeline import LiteratureAnalyzer, BookBrain
from ml_pipeline.quiz_generator      import PedagogicalQuestionGenerator
from ml_pipeline.ner_extractor       import get_ner_extractor
from ml_pipeline.vocab_analyzer      import get_vocab_analyzer
from ml_pipeline.difficulty_adapter  import get_difficulty_adapter
from services.tts_service            import get_tts_service
from services.hf_inference_service   import HFInferenceService
from services.pronunciation_service  import PronunciationService

app = FastAPI(title="IncludEd AI Service", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Lazy proxy — instantiates service on first attribute access ───────────────
class _Lazy:
    def __init__(self, factory):
        object.__setattr__(self, '_factory', factory)
        object.__setattr__(self, '_instance', None)

    def _load(self):
        if object.__getattribute__(self, '_instance') is None:
            factory = object.__getattribute__(self, '_factory')
            object.__setattr__(self, '_instance', factory())
        return object.__getattribute__(self, '_instance')

    def __getattr__(self, name):
        return getattr(self._load(), name)

    def __call__(self, *args, **kwargs):
        return self._load()(*args, **kwargs)

# ML pipeline singletons — loaded on first use, not at startup
_literature_analyzer = _Lazy(LiteratureAnalyzer)
_book_brain          = _Lazy(BookBrain)
_quiz_generator      = _Lazy(PedagogicalQuestionGenerator)
question_gen         = _Lazy(SmartQuestionGenerator)
accessibility_adapter= _Lazy(FreeAccessibilityAdapter)
rl_agent             = _Lazy(RLAgentService)
tts_service          = _Lazy(TTSService)
gemini_service       = _Lazy(lambda: GeminiService(os.getenv("GEMINI_API_KEY")))
simplification_svc   = _Lazy(SimplificationService)
learner_embedding    = _Lazy(LearnerEmbedding)
comprehension_tracker= _Lazy(ComprehensionTracker)
teacher_intelligence = _Lazy(TeacherIntelligence)
stt_assessment       = _Lazy(STTAssessmentService)
word_difficulty      = _Lazy(WordDifficultyService)
ner_extractor        = _Lazy(get_ner_extractor)
vocab_analyzer       = _Lazy(lambda: get_vocab_analyzer(gemini_service=gemini_service, hf_service=hf_inference))
difficulty_adapter   = _Lazy(get_difficulty_adapter)
tts_svc              = _Lazy(get_tts_service)
hf_inference         = _Lazy(lambda: HFInferenceService(os.getenv("HF_API_TOKEN")))
pronunciation_svc    = _Lazy(PronunciationService)

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
    section_text: str = ""  # raw section content for theme extraction (D4)
    subjective_difficulty: Optional[int] = None
    reading_speed_wpm: Optional[float] = None


class HighlightRecordRequest(BaseModel):
    student_id: str
    book_id: str
    highlighted_text: str
    section_id: str


class VocabRecordRequest(BaseModel):
    student_id: str
    book_id: str
    word: str
    source: str = "highlight"


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


class RLPredictRequest(BaseModel):
    state_vector: List[float]
    content_type: float = 0.5  # 0.0=generic, 0.5=novel, 1.0=play
    student_id: Optional[str] = None
    book_id: Optional[str] = None
    section_id: Optional[str] = "unknown"


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


class CommonHighlightRequest(BaseModel):
    highlights: List[Dict[str, Any]]  # [{student_name, text, section_id, timestamp}]
    book_title: str = ""
    min_students: int = 2


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
            "difficulty_map":        brain_result.difficulty_map,
            "vocabulary":            brain_result.vocabulary,
            "characters":            brain_result.characters,
            "summary_stats":         brain_result.summary_stats,
            "struggle_zones":        brain_result.struggle_zones,
            "cultural_context_bank": brain_result.cultural_context_bank,
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
            "difficulty_map":        brain_result.difficulty_map,
            "vocabulary":            brain_result.vocabulary,
            "characters":            brain_result.characters,
            "summary_stats":         brain_result.summary_stats,
            "struggle_zones":        brain_result.struggle_zones,
            "cultural_context_bank": brain_result.cultural_context_bank,
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
        "difficulty_map":        result.difficulty_map,
        "vocabulary":            result.vocabulary,
        "characters":            result.characters,
        "summary_stats":         result.summary_stats,
        "struggle_zones":        result.struggle_zones,
        "cultural_context_bank": result.cultural_context_bank,
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
    """
    Generate an engaging literature introduction (v3.0).
    Now uses Gemini as primary for high-quality pedagogical context.
    """
    prompt = f"""Generate an engaging, highly accurate, and short pedagogical introduction (2-3 paragraphs) for a student about to read:
Title: {req.title}
Author: {req.author}
Content Genre: {req.doc_type}

Summary of initial content:
{req.content_summary}

Do not hallucinate plot points. Base your introduction strictly on the provided summary and the known context of the book. Focus on the themes, characters introduced, and why this work matters.
Format: Return only the text of the introduction.
"""
    system_instruction = "You are an expert literature teacher helping students with learning differences feel excited about reading."
    
    # Primary: Gemini
    if gemini_service.is_available():
        intro = gemini_service.generate(prompt, system_instruction)
        if intro:
            return {"introduction": intro, "tier": "gemini"}

    # Fallback: Static template
    return {
        "introduction": f"Welcome to {req.title} by {req.author}. This {req.doc_type} is a classic work that explores important themes and characters.",
        "tier": "template"
    }


# ── Quiz Generation ─────────────────────────────────────────────────────────

class QuizGenerateRequest(BaseModel):
    content: str
    doc_type: str = "generic"
    count: int = 5
    language: str = "en"


@app.post("/quiz/generate", tags=["quiz"])
async def quiz_generate(req: QuizGenerateRequest):
    """On-demand quiz generation for specific content."""
    questions = await asyncio.to_thread(
        _quiz_generator.generate,
        req.content,
        req.doc_type,
        req.count,
        req.language,
    )
    return {"questions": questions}


# ── Character Intelligence ────────────────────────────────────────────────────

class CharacterDescribeRequest(BaseModel):
    character: str
    context: str
    max_context_chars: Optional[int] = 4000

class CharacterNERRequest(BaseModel):
    text: str

@app.post("/characters/describe", tags=["characters"])
async def character_describe(req: CharacterDescribeRequest):
    """Describe a character based on the text read so far (DeBERTa Q&A, no spoilers)."""
    from services.character_service import get_character_service
    svc = get_character_service()
    result = await asyncio.to_thread(
        svc.describe_character, req.character, req.context, req.max_context_chars
    )
    return result

@app.post("/characters/extract-names", tags=["characters"])
async def character_extract_names(req: CharacterNERRequest):
    """Extract PERSON entity names from text using BERT NER."""
    from services.character_service import get_character_service
    svc = get_character_service()
    names = await asyncio.to_thread(svc.extract_person_names, req.text)
    return {"names": names, "count": len(names)}


# ── Comprehension Tracking ───────────────────────────────────────────────────

@app.post("/comprehension/record", tags=["comprehension"])
async def record_section_read(req: ComprehensionRecordRequest):
    """Record that a student read a section."""
    comprehension_tracker.record_section_read(
        req.student_id, req.book_id, req.section_id,
        req.section_title, req.chapter_title,
        req.time_spent_s,        req.quiz_score,
        req.characters_seen,
        req.section_text,
        req.subjective_difficulty,
        req.reading_speed_wpm
    )
    return {"status": "ok", "student_id": req.student_id, "book_id": req.book_id}


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
        req.student_id, req.book_id, req.word, req.source
    )
    return {"status": "recorded", "word": req.word, "source": req.source}


@app.post("/comprehension/vocab-mastered", tags=["comprehension"])
async def record_vocab_mastered(req: VocabRecordRequest):
    """Record that a student has mastered a vocabulary word."""
    comprehension_tracker.record_vocab_mastered(
        req.student_id, req.book_id, req.word,
    )
    return {"status": "recorded"}


class VocabExplainRequest(BaseModel):
    word: str
    context: str = ""
    language: str = "en"


@app.post("/vocab/explain", tags=["vocabulary"])
async def explain_vocab(req: VocabExplainRequest):
    """Generate a child-friendly explanation for a word in context."""
    prompt = f"""Explain the word "{req.word}" in this context: "{req.context}"
Provide:
1. modern_meaning: a very simple definition for a 10-year old.
2. analogy: a simple comparison helpful for a child.
3. category: a short label for the word type (e.g. Vocabulary, Archaic, Idiom).

Respond in JSON with keys: "modern_meaning", "analogy", "category".
"""
    system_instruction = "You are a kind teacher explaining difficult words to children with dyslexia and ADHD. Keep it simple, visual, and encouraging."
    
    # Primary: Gemini
    if gemini_service.is_available():
        res = gemini_service.generate_json(prompt, system_instruction)
        if res: return res

    return {
        "modern_meaning": f"A word used to describe something in the story.",
        "analogy": "Like a puzzle piece that fits in this sentence.",
        "category": "Vocabulary"
    }


# ── Word Phonics & Pronunciation (Project Revamp) ───────────────────────────

class PhonicsRequest(BaseModel):
    word: str

@app.post("/word/phonics", tags=["vocabulary"])
async def get_word_phonics(req: PhonicsRequest):
    """Get syllable breakdown and phonics for a word."""
    return pronunciation_svc.get_phonics_breakdown(req.word)

@app.post("/word/pronunciation-guide", tags=["vocabulary"])
async def get_word_pronunciation_guide(req: PhonicsRequest):
    """
    Get a Google-style pronunciation guide.
    Uses HF Inference (Mistral) if available for better phonetics.
    """
    if os.getenv("USE_HF_INFERENCE") == "1" and hf_inference.api_token:
        # We could use Mistral here to get even better phonics, 
        # but for now, use the dedicated service.
        pass
    
    return pronunciation_svc.get_phonics_breakdown(req.word)


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


class HighlightFeedbackRequest(BaseModel):
    student_id: str
    category: str  # figurative_language | archaic_idiom | cultural_reference | vocabulary_gap | general
    highlighted_text: str = ""
    difficulty_estimate: float = 0.5  # 0-1 how hard the passage seemed


@app.post("/learner/highlight-feedback", tags=["learner"])
async def learner_highlight_feedback(req: HighlightFeedbackRequest):
    """
    Apply targeted EMA update to learner embedding based on highlight category.

    Category → embedding dimension mapping:
      figurative_language → vec[95] (literary device recognition = adaptation slot 7)
      archaic_idiom       → vec[65] (frustration proxy) + vec[117] (vocab lookup freq)
      cultural_reference  → vec[67] (help-seeking behaviour)
      vocabulary_gap      → vec[117] (vocab lookup freq) + vec[65] (mild frustration)
      general             → vec[116] (highlight frequency)
    """
    import numpy as np
    ALPHA = 0.2  # stronger signal than session-end EMA (α=0.15) for real-time feedback
    vec = learner_embedding.get_or_create(req.student_id)
    diff = req.difficulty_estimate

    if req.category == "figurative_language":
        # Student struggled with a literary device — update recognition signal
        vec[95] = (1 - ALPHA) * vec[95] + ALPHA * diff
        vec[67] = (1 - ALPHA) * vec[67] + ALPHA * 0.7  # boost help-seeking
    elif req.category == "archaic_idiom":
        # Archaic language = frustration + high vocab lookup
        vec[65] = (1 - ALPHA) * vec[65] + ALPHA * diff          # frustration
        vec[117] = (1 - ALPHA) * vec[117] + ALPHA * 0.8         # vocab lookup freq
    elif req.category == "cultural_reference":
        # Cultural gap — strengthen help-seeking signal
        vec[67] = (1 - ALPHA) * vec[67] + ALPHA * 0.75
        vec[65] = (1 - ALPHA) * vec[65] + ALPHA * diff * 0.5    # mild frustration
    elif req.category == "vocabulary_gap":
        # Pure vocabulary difficulty
        vec[117] = (1 - ALPHA) * vec[117] + ALPHA * 0.7
        vec[65] = (1 - ALPHA) * vec[65] + ALPHA * diff * 0.4
    else:
        # General highlight — just update highlight frequency
        vec[116] = (1 - ALPHA) * vec[116] + ALPHA * 0.6

    # Clip to [0, 1]
    vec = np.clip(vec, 0.0, 1.0)
    learner_embedding._cache[req.student_id] = vec
    learner_embedding._save(req.student_id, vec)

    return {
        "student_id": req.student_id,
        "category": req.category,
        "embedding_updated": True,
    }


# ── Teacher Intelligence ─────────────────────────────────────────────────────

@app.post("/teacher/student-summary", tags=["teacher"])
async def teacher_student_summary(req: StudentSummaryRequest):
    """Generate natural language summary for a student."""
    comp_data = comprehension_tracker.get_summary(req.student_id, req.book_id)
    profile = learner_embedding.get_profile_summary(req.student_id)
    
    # RL History from comprehension tracker
    rl_history = comp_data.get("rl_action_history", [])
    
    return teacher_intelligence.student_summary(
        req.student_name, comp_data, profile, rl_history, req.class_average_chapter,
    )


@app.post("/teacher/class-alerts", tags=["teacher"])
async def teacher_class_alerts(req: ClassAlertsRequest):
    """Generate class-wide pattern alerts."""
    alerts = teacher_intelligence.class_alerts(
        req.student_summaries, req.book_title,
    )
    return {"alerts": alerts}


@app.get("/teacher/class-wide-stats/{book_id}", tags=["teacher"])
async def teacher_class_wide_stats(book_id: str):
    """Get aggregated stats across all students for a specific book."""
    stats = comprehension_tracker.get_class_wide_stats(book_id)
    return stats


@app.post("/teacher/common-highlights", tags=["teacher"])
async def teacher_common_highlights(req: CommonHighlightRequest):
    """
    Detect passages highlighted by multiple students (D6 deliverable).
    Alerts teacher when ≥ min_students highlight the same passage.
    """
    alerts = teacher_intelligence.common_highlight_alerts(
        req.highlights, req.book_title, req.min_students,
    )
    return {"alerts": alerts}


@app.post("/teacher/recap", tags=["teacher"])
async def teacher_generate_recap(req: RecapTextRequest):
    """Generate 'Story So Far' recap text."""
    recap_data = comprehension_tracker.get_recap(req.student_id, req.book_id)
    recap_text = teacher_intelligence.generate_recap_text(recap_data, req.language)
    return {"recap": recap_text, "data": recap_data}


# ── Teacher Recommendations (D6: Actionable insights) ──────────────────────────

class StudentRecommendationRequest(BaseModel):
    student_id: str
    student_name: str
    student_profile: Dict[str, Any]
    recent_sessions: List[Dict[str, Any]]
    book_id: Optional[str] = None


class ClassRecommendationRequest(BaseModel):
    class_id: str
    students_profiles: List[Dict[str, Any]]
    current_book: Optional[Dict[str, Any]] = None


class RiskAlertRequest(BaseModel):
    student_id: str
    student_name: str
    student_profile: Dict[str, Any]
    recent_sessions: List[Dict[str, Any]]
    alert_threshold: float = 0.3


@app.post("/teacher/recommendations/student", tags=["recommendations"])
async def get_student_recommendations(req: StudentRecommendationRequest):
    """
    Generate 1–3 actionable recommendations for an individual student (D6).
    
    Example use:
    - Student has low attention score → recommend scheduling sessions in morning
    - Student shows high frustration → suggest simplified text or smaller chunks
    - Student frequently backtracks → recommend pre-reading vocabulary
    """
    engine = get_recommendation_engine()
    
    # Enrich profile with STT history if book_id is provided
    profile = req.student_profile.copy()
    if req.book_id:
        comp_summary = comprehension_tracker.get_summary(req.student_id, req.book_id)
        if comp_summary.get("stt_history"):
            profile["stt_history"] = comp_summary["stt_history"]

    recommendations = engine.recommend_for_student(
        req.student_id,
        req.student_name,
        profile,
        req.recent_sessions,
    )
    return {
        "student_id": req.student_id,
        "recommendations": [
            {
                "priority": r.priority,
                "action": r.action,
                "rationale": r.rationale,
                "expected_impact": r.expected_impact,
            }
            for r in recommendations
        ],
    }


@app.post("/teacher/recommendations/class", tags=["recommendations"])
async def get_class_recommendations(req: ClassRecommendationRequest):
    """
    Analyze class-wide patterns and generate cohort recommendations (D6).
    
    Detects patterns like:
    - Widespread attention drift → introduce 10-min chunks with breathing breaks
    - High vocabulary lookup rates → pre-teach key words
    - Subgroup disengagement → check-in or switch book genre
    """
    engine = get_recommendation_engine()
    recommendations = engine.recommend_for_class(
        req.class_id,
        req.students_profiles,
        req.current_book,
    )
    return {
        "class_id": req.class_id,
        "recommendations": [
            {
                "pattern": r.pattern,
                "affected_students": r.affected_students,
                "intervention": r.intervention,
                "resource": r.resource,
                "timeline": r.timeline,
            }
            for r in recommendations
        ],
    }


@app.post("/teacher/alerts/risk", tags=["recommendations"])
async def get_risk_alert(req: RiskAlertRequest):
    """
    Identify students at risk of disengagement or learning loss (D6).
    
    Returns high-priority alert if student shows:
    - Critically low attention (< 0.3)
    - High frustration signals
    - Few sessions completed (early dropout indicators)
    - Declining comprehension scores
    """
    engine = get_recommendation_engine()
    alert = engine.generate_risk_alert(
        req.student_id,
        req.student_name,
        req.student_profile,
        req.recent_sessions,
        req.alert_threshold,
    )
    return {"alert": alert} if alert else {"alert": None, "status": "low_risk"}


# ── Poem Analysis (Phase 2 + Phase 7) ────────────────────────────────────────

class PoemAnalyzeRequest(BaseModel):
    text: str
    language: str = "en"


@app.post("/poem/analyze", tags=["poem"])
async def poem_analyze(req: PoemAnalyzeRequest):
    """
    Analyse a poem: split into stanzas, detect emotion + rhyme scheme per stanza.

    Returns:
      {
        "stanzas": [
          {
            "stanza_index": int,
            "lines": [str],
            "emotion": str,
            "intensity": float,
            "rhyme_scheme": str,
            "end_words": [str],
            "color_tint": str
          }
        ],
        "dominant_emotion": str,
        "rhyme_pattern": str  # overall pattern
      }
    """
    from ml_pipeline.emotion_analyzer import get_emotion_analyzer
    analyzer = get_emotion_analyzer()
    stanzas = await asyncio.to_thread(
        analyzer.analyze_poem_stanzas, req.text, req.language
    )
    if not stanzas:
        return {"stanzas": [], "dominant_emotion": "neutral", "rhyme_pattern": "free verse"}

    # Dominant emotion: most frequent non-neutral emotion
    from collections import Counter as _Counter
    emotion_counts = _Counter(s["emotion"] for s in stanzas if s["emotion"] != "neutral")
    dominant = emotion_counts.most_common(1)[0][0] if emotion_counts else "neutral"

    # Overall rhyme pattern: concatenate first stanza's scheme
    rhyme_pattern = stanzas[0]["rhyme_scheme"] if stanzas else "free verse"

    return {
        "stanzas": stanzas,
        "dominant_emotion": dominant,
        "rhyme_pattern": rhyme_pattern,
    }


# ── Helper Endpoints ─────────────────────────────────────────────────────────

@app.post("/adapt-text")
async def adapt_text(req: Dict[str, Any]):
    """
    Batch adaptation endpoint used by background workers (D2).
    """
    text = req.get("text", "")
    doc_type = req.get("doc_type", "generic")
    
    if not text:
        return {"adaptedText": "", "strategy": "empty"}

    result = await asyncio.to_thread(
        simplification_svc.simplify,
        text,
        "",   # book_title
        "",   # author
        doc_type,
        "",   # chapter_context
        "",   # speaker
        "intermediate",
        "en",
    )
    return {
        "adaptedText": result.get("simple_version", text),
        "strategy": result.get("tier", "rule_based"),
    }

@app.post("/rl/predict", tags=["rl"])
async def rl_predict(req: RLPredictRequest):
    """Get pedagogical action recommendation from RL agent."""
    action_id, action_label, reasoning = rl_agent.predict_from_state_vector(
        req.state_vector, req.content_type
    )
    
    # Record action in comprehension tracker if context provided
    if req.student_id and req.book_id:
        comprehension_tracker.record_rl_action(
            req.student_id, req.book_id, req.section_id,
            action_id, action_label, reasoning
        )

    return {
        "action_id": action_id,
        "action_label": action_label,
        "reasoning": reasoning,
        "fallback": not rl_agent.model_ready
    }

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


@app.post("/teacher/insights", tags=["teacher"])
async def teacher_insights(req: Dict[str, Any]):
    """Generate NL insights using Gemini based on analytics data."""
    import json
    analytics_data = req.get("analytics_data", {})
    if not analytics_data:
        return {"insights": "No data available to generate insights."}
        
    if not gemini_service.is_available():
        return {"insights": "Gemini AI service is not configured. Please check API keys."}
        
    prompt = f"""You are an expert special education teacher. Analyze the following student platform data and provide actionable teaching insights, specifically focusing on ADHD and Dyslexia.
    
Data: {json.dumps(analytics_data)}

Format your response as a professional, encouraging report. Include:
- A brief summary of overall class engagement.
- Specific insights regarding students with ADHD/Dyslexia.
- Actionable recommendations based on the struggle zones and quiz scores.
Keep it strictly under 250 words."""

    try:
        import asyncio
        insights = await asyncio.to_thread(gemini_service.generate, prompt)
        return {"insights": insights}
    except Exception as e:
        print(f"Error generating insights: {e}")
        return {"insights": "Error generating insights."}


# ── STT Reading Assessment ──────────────────────────────────────────────────

class STTAssessmentRequest(BaseModel):
    expected_text: str
    spoken_text: str
    duration_seconds: float = 0
    student_id: Optional[str] = None
    book_id: Optional[str] = None


@app.post("/stt/assess", tags=["stt"])
async def assess_reading(req: STTAssessmentRequest):
    """
    Assess a student's reading by comparing expected text with spoken text.
    Returns accuracy, WPM, missed words, mispronunciations, and feedback.
    """
    result = await asyncio.to_thread(
        stt_assessment.assess_reading,
        req.expected_text,
        req.spoken_text,
        req.duration_seconds,
    )

    # Update comprehension tracker if student context provided
    if req.student_id and req.book_id:
        comprehension_tracker.record_stt_assessment(
            req.student_id, req.book_id, req.book_id, # using book_id as section_id if not specific
            result.get("accuracy", 0),
            result.get("wpm", 0),
            feedback=result.get("feedback", ""),
            mispronounced=[w["expected"] for w in result.get("mispronunciations", [])]
        )

    return result


# ── Word Difficulty & Pronunciation ─────────────────────────────────────────

class WordDifficultyRequest(BaseModel):
    text: str
    difficulty_threshold: float = 0.5


@app.post("/vocab/difficulty", tags=["vocabulary"])
async def analyze_word_difficulty(req: WordDifficultyRequest):
    """
    Analyze a passage and return difficult words with pronunciation guides.
    """
    words = await asyncio.to_thread(
        word_difficulty.analyze_passage,
        req.text,
        req.difficulty_threshold,
    )
    return {"difficult_words": words, "count": len(words)}


class PronunciationRequest(BaseModel):
    word: str


@app.post("/vocab/pronunciation", tags=["vocabulary"])
async def get_pronunciation(req: PronunciationRequest):
    """Get phonetic pronunciation guide for a single word."""
    pronunciation = word_difficulty.generate_pronunciation(req.word)
    syllables = word_difficulty.count_syllables(req.word)
    difficulty = word_difficulty.estimate_difficulty(req.word)
    return {
        "word": req.word,
        "pronunciation": pronunciation,
        "syllables": syllables,
        "difficulty": round(difficulty, 3),
    }


# ── NER / Character Graph ─────────────────────────────────────────────────────

class NERExtractRequest(BaseModel):
    sections:              List[str]           # list of chapter/section texts
    title:                 Optional[str] = ""
    existing_characters:   Optional[List[str]] = None


class NERSectionViewRequest(BaseModel):
    characters:    List[Any]
    relationships: List[Any]
    locations:     List[Any]
    up_to_section: int


@app.post("/ner/extract", tags=["characters"])
async def ner_extract(req: NERExtractRequest):
    """
    Extract a full character + location graph from all book sections.
    Called once at upload time; result stored in Literature.bookBrain.

    Returns full graph: characters (with importance, first_seen_index,
    relationships), relationships (flat list), locations.
    """
    graph = await asyncio.to_thread(
        ner_extractor.extract,
        req.sections,
        req.title or "",
        req.existing_characters,
    )
    return graph


@app.post("/ner/section-view", tags=["characters"])
async def ner_section_view(req: NERSectionViewRequest):
    """
    Return a spoiler-safe graph filtered to characters seen up to
    the current section index. Called by CharacterMapPanel.tsx.
    """
    full_graph = {
        "characters":    req.characters,
        "relationships": req.relationships,
        "locations":     req.locations,
    }
    return ner_extractor.extract_for_section(full_graph, req.up_to_section)


# ── Vocabulary Batch Analysis ─────────────────────────────────────────────────

class VocabBatchRequest(BaseModel):
    sections:        List[str]           # chapter texts
    section_titles:  Optional[List[str]] = None


class VocabSectionRequest(BaseModel):
    section_text:    str
    all_words:       List[Any]           # previously computed word list
    chapter_index:   int = 0
    max_display:     int = 20


class VocabIdentifyRequest(BaseModel):
    text:            str
    language:        str = "en"
    max_words:       int = 8


@app.post("/vocab/batch-analyze", tags=["vocabulary"])
async def vocab_batch_analyze(req: VocabBatchRequest):
    """
    Pre-compute vocabulary difficulty + explanations for a whole book.
    Stored in Literature.bookBrain.vocabulary at upload time.
    Returns a flat list of word dicts (see vocab_analyzer.py schema).
    """
    # Analyzer already initialized with gemini_service in v4.0 main.py
    words = await asyncio.to_thread(
        vocab_analyzer.analyze_book,
        req.sections,
        req.section_titles,
    )
    return {"vocabulary": words, "count": len(words)}


@app.post("/vocab/section-words", tags=["vocabulary"])
async def vocab_section_words(req: VocabSectionRequest):
    """
    Filter the book vocabulary to words present in the current section.
    Used by VocabSidebar.tsx on chapter navigation.
    """
    from ml_pipeline.vocab_analyzer import VocabAnalyzer
    words = VocabAnalyzer.words_for_section(
        req.all_words,
        req.section_text,
        req.chapter_index,
        req.max_display,
    )
    return {"words": words, "count": len(words)}


@app.post("/vocab/identify", tags=["vocabulary"])
async def vocab_identify(req: VocabIdentifyRequest):
    """
    Identify hard words in a text snippet and provide child-friendly 
    definitions + analogies (proactive mode).
    """
    from ml_pipeline.vocab_analyzer import get_vocab_analyzer
    
    # Use analyzer with Gemini if possible
    analyzer = get_vocab_analyzer(gemini_service=gemini_service if gemini_service.is_available() else None)
    
    # 1. Identify hard words using WordDifficultyService (wrapped in analyzer)
    # We use a slightly lower threshold for proactive suggestions to catch more "stretch" words
    words = await asyncio.to_thread(
        analyzer._difficulty_svc.analyze_passage,
        req.text,
        difficulty_threshold=0.45
    )
    
    # 2. Slice to requested limit
    words = words[:req.max_words]
    
    # 3. Enrich with Gemini analogies for each
    results = []
    for w in words:
        enriched = await asyncio.to_thread(
            analyzer.explain_word,
            w["word"],
            w["context"],
            0 # chapter index placeholder
        )
        results.append(enriched)

    return {"words": results, "count": len(results)}


# ── TTS with word-level sync ──────────────────────────────────────────────────

class TTSSynthesizeRequest(BaseModel):
    text:            str
    disability_type: Optional[str] = "none"   # none | dyslexia | adhd | both
    language:        Optional[str] = "english"
    voice_override:  Optional[str] = None
    rate_override:   Optional[str] = None


@app.post("/tts/synthesize", tags=["tts"])
async def tts_synthesize(req: TTSSynthesizeRequest):
    """
    Synthesize text to speech with word-level timestamps.

    Automatically selects disability-appropriate voice and speaking rate.
    Long texts are chunked at sentence boundaries; timestamps are
    offset-adjusted across chunks so they represent absolute positions.

    Returns: audio_base64 (MP3), timestamps [{word, start_ms, end_ms}],
             duration_ms, voice, rate, word_count.
    """
    result = await tts_svc.synthesize(
        text            = req.text,
        disability_type = req.disability_type or "none",
        language        = req.language or "english",
        voice_override  = req.voice_override,
        rate_override   = req.rate_override,
    )
    return result


# ── Adaptive Quiz Difficulty ──────────────────────────────────────────────────

class QuizAttemptRequest(BaseModel):
    student_id:      str
    literature_id:   str
    chapter_index:   int = 0
    score:           float                    # fraction correct 0.0–1.0
    difficulty:      Optional[str] = "medium" # easy | medium | hard
    disability_type: Optional[str] = "none"


class QuizDifficultyQuery(BaseModel):
    student_id:      str
    literature_id:   str
    disability_type: Optional[str] = "none"


@app.post("/quiz/record-attempt", tags=["quiz"])
async def quiz_record_attempt(req: QuizAttemptRequest):
    """
    Record a completed quiz attempt and update the student's IRT ability model.

    Returns:
      - next_difficulty: recommended difficulty for the next quiz
      - theta: updated ability estimate (–2.5 to +2.5)
      - performance_message: encouraging feedback for the student
      - recommendation: teaching insight for the teacher
    """
    result = difficulty_adapter.record_attempt(
        student_id      = req.student_id,
        literature_id   = req.literature_id,
        chapter_index   = req.chapter_index,
        score           = max(0.0, min(1.0, req.score)),
        difficulty      = req.difficulty or "medium",
        disability_type = req.disability_type or "none",
    )
    return result


@app.post("/quiz/recommend-difficulty", tags=["quiz"])
async def quiz_recommend_difficulty(req: QuizDifficultyQuery):
    """
    Get the recommended quiz difficulty for a student's next quiz.
    Call this before generating questions to get the right difficulty level.
    Returns: { "difficulty": "easy" | "medium" | "hard" }
    """
    diff = difficulty_adapter.recommend_difficulty(
        student_id      = req.student_id,
        literature_id   = req.literature_id,
        disability_type = req.disability_type or "none",
    )
    return {"difficulty": diff}


@app.get("/quiz/student-state", tags=["quiz"])
async def quiz_student_state(student_id: str, literature_id: str):
    """
    Get the full adaptive difficulty state for a student + book.
    Used by the teacher dashboard to see progress history and ability level.
    Returns null if no attempts recorded yet.
    """
    state = difficulty_adapter.get_state(student_id, literature_id)
    return state or {"message": "No quiz attempts recorded yet."}


# ── System ───────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health():
    return {
        "status":         "healthy",
        "version":        "3.1.0",
        "rl_model_ready": rl_agent.model_ready,
        "features": [
            "highlight_to_understand",
            "book_brain_preanalysis",
            "learner_embedding_128dim",
            "comprehension_graph",
            "teacher_intelligence",
            "teacher_recommendations",
            "story_recaps",
            "poem_mode",
            "adhd_chunking",
            "dyslexia_rendering",
            "focus_sounds",
            "gemini_acceleration",
            "stt_reading_assessment",
            "word_difficulty_analysis",
            "pronunciation_guides",
            "vocabulary_mastery_tracking",
            # v4.0
            "ner_character_graph",
            "vocab_batch_analysis",
            "tts_word_sync",
            "adaptive_quiz_difficulty_irt",
        ],
        "timestamp":      time.time(),
    }


# ── Startup: Model Size Check (D7 compliance) ────────────────────────────────

@app.on_event("startup")
async def check_model_sizes():
    """
    Verify that loaded model files fit within the 500 MB offline spec (D7).
    This is a non-blocking advisory check — the service starts regardless.
    """
    MODEL_SIZE_LIMIT_MB = 500
    MODEL_EXTENSIONS   = {".bin", ".pt", ".gguf", ".safetensors", ".pkl", ".joblib"}

    # Directories to scan (relative to this file)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    scan_dirs = [
        os.path.join(base_dir, "models"),
        os.path.join(base_dir, "services"),
        os.path.join(base_dir, "..", "rl-engine"),
    ]

    total_bytes = 0
    large_files: list[tuple[str, float]] = []

    for scan_dir in scan_dirs:
        if not os.path.isdir(scan_dir):
            continue
        for root, _, files in os.walk(scan_dir):
            for fname in files:
                if any(fname.endswith(ext) for ext in MODEL_EXTENSIONS):
                    fpath = os.path.join(root, fname)
                    try:
                        size_bytes = os.path.getsize(fpath)
                        total_bytes += size_bytes
                        size_mb = size_bytes / (1024 * 1024)
                        if size_mb > 50:
                            large_files.append((fpath, size_mb))
                    except OSError:
                        pass

    total_mb = total_bytes / (1024 * 1024)
    if large_files:
        large_files.sort(key=lambda x: x[1], reverse=True)

    if total_mb > MODEL_SIZE_LIMIT_MB:
        import logging
        logging.getLogger("included.startup").warning(
            "[MODEL SIZE] ⚠️  Total model files = %.1f MB — EXCEEDS 500 MB offline spec (D7)! "
            "Consider INT4 quantization. Largest files: %s",
            total_mb,
            ", ".join(f"{os.path.basename(f)} ({s:.0f} MB)" for f, s in large_files[:3]),
        )
    else:
        import logging
        logging.getLogger("included.startup").info(
            "[MODEL SIZE] ✅ Total model files = %.1f MB — within 500 MB offline spec (D7).",
            total_mb,
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)

