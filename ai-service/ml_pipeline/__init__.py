"""
ml_pipeline
===========
Heuristic-first ML pipeline for classifying and segmenting literary PDFs.

Components:
  • ContentClassifier        – Rule/signal-weighted heuristic classifier (no LLM).
  • StructuralSegmenter      – Font-size + regex heading detector that builds a hierarchy.
  • PedagogicalQuestionGen   – Pedagogy-aware question generator wrapping Ollama.
  • LiteratureAnalyzer       – Orchestrator: PDF bytes → structured AnalysisResult.
"""

from .content_classifier import ContentClassifier
from .structural_segmenter import StructuralSegmenter
from .question_generator import PedagogicalQuestionGenerator
from .analyzer import LiteratureAnalyzer, AnalysisResult

__all__ = [
    "ContentClassifier",
    "StructuralSegmenter",
    "PedagogicalQuestionGenerator",
    "LiteratureAnalyzer",
    "AnalysisResult",
]
