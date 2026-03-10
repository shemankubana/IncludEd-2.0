"""
question_generator.py — compatibility shim
==========================================
All generation logic lives in quiz_generator.py (3-tier: Gemini → FLAN-T5 → templates).
This shim keeps existing imports working.
"""
from .quiz_generator import PedagogicalQuestionGenerator, FlanT5Generator  # noqa: F401
