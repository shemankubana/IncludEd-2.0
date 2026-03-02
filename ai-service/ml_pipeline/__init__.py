"""
ml_pipeline
===========
ML pipeline for classifying, filtering, and segmenting literary PDFs
into accessible, structured content for neurodivergent learners.

Components:
  - FrontMatterFilter       - Removes TOC, forewords, prefaces, dedications, epigraphs.
  - ContentClassifier       - Rule/signal-weighted heuristic + ML classifier (play vs novel).
  - StructuralSegmenter     - Font-size + regex heading detector that builds a hierarchy.
  - PedagogicalQuestionGen  - Pedagogy-aware question generator wrapping Ollama.
  - LiteratureAnalyzer      - Orchestrator: PDF bytes -> structured AnalysisResult.
"""

from .content_classifier import ContentClassifier
from .structural_segmenter import StructuralSegmenter
from .question_generator import PedagogicalQuestionGenerator
from .front_matter_filter import FrontMatterFilter
from .analyzer import LiteratureAnalyzer, AnalysisResult

__all__ = [
    "ContentClassifier",
    "StructuralSegmenter",
    "PedagogicalQuestionGenerator",
    "FrontMatterFilter",
    "LiteratureAnalyzer",
    "AnalysisResult",
]
