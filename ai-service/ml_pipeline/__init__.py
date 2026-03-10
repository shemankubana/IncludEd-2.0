"""
ml_pipeline
===========
ML pipeline for classifying, segmenting, and enriching literary PDFs.

Components:
  • ContentClassifier        – Heuristic + sklearn play/novel classifier (EN + FR).
  • StructuralSegmenter      – Regex heading detector → Act/Scene or Chapter hierarchy
                               with optional emotion tagging on dialogue blocks.
  • PedagogicalQuestionGen   – 3-tier MCQ generator: Gemini → FLAN-T5 → templates.
  • LiteratureAnalyzer       – Orchestrator: PDF bytes → AnalysisResult.
  • EmotionAnalyzer          – DistilRoBERTa + NRC lexicon emotion detection.
  • LanguageDetector         – langdetect + keyword heuristics (EN/FR).
  • FrontMatterDetector      – Page classification: FRONT_MATTER / BODY / BACK_MATTER.
"""

from .content_classifier    import ContentClassifier
from .structural_segmenter  import StructuralSegmenter
from .question_generator    import PedagogicalQuestionGenerator
from .front_matter_detector import FrontMatterDetector, detect_front_matter, filter_body_blocks
from .analyzer              import LiteratureAnalyzer, AnalysisResult
from .emotion_analyzer      import EmotionAnalyzer, get_emotion_analyzer, EMOTION_TO_ANIM
from .language_detector     import LanguageDetector, get_language_detector, detect_language
from .book_brain            import BookBrain, BookBrainResult

__all__ = [
    "ContentClassifier",
    "StructuralSegmenter",
    "PedagogicalQuestionGenerator",
    "FrontMatterDetector",
    "detect_front_matter",
    "filter_body_blocks",
    "LiteratureAnalyzer",
    "AnalysisResult",
    "EmotionAnalyzer",
    "get_emotion_analyzer",
    "EMOTION_TO_ANIM",
    "LanguageDetector",
    "get_language_detector",
    "detect_language",
    "BookBrain",
    "BookBrainResult",
]
