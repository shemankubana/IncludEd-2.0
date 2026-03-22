"""
quiz_generator.py
=================
PedagogicalQuestionGenerator — 3-tier generation pipeline.

Tier 1 (Primary)   — Google Gemini API
                     Best quality; requires GEMINI_API_KEY.
Tier 2 (Secondary) — FLAN-T5 via HuggingFace Transformers
                     Good quality; ~900MB one-time model download.
                     Works fully offline after first download.
Tier 3 (Fallback)  — Content-aware deterministic templates
                     Always available; extracts real sentences from the text.

All tiers return the same schema:
    {
        "question":      str,
        "options":       List[str],   # 4 choices
        "correctAnswer": int,         # 0-based index of correct option
        "explanation":   str,
        "difficulty":    "easy" | "medium" | "hard",
    }

Multilingual: EN and FR content both supported.
"""

from __future__ import annotations

import json
import random
import re
import sys
import os
from typing import Any, Dict, List, Optional, Tuple

# Allow import from parent package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.gemini_service import GeminiService
from services.hf_inference_service import HFInferenceService
_hf_inference = HFInferenceService(os.getenv("HF_API_TOKEN"))

# ── Pedagogical Question Generator ──────────────────────────────────────────

class PedagogicalQuestionGenerator:
    """
    Pedagogical question generator using Cloud AI.
    Priority: Gemini → HF Inference (Serverless) → Templates
    """

    def __init__(self):
        self._gemini = GeminiService()

    # ── Public API ─────────────────────────────────────────────────────────────

    def generate(
        self,
        content:  str,
        doc_type: str = "generic",
        count:    int = 5,
        language: str = "en",
    ) -> List[Dict[str, Any]]:
        """
        Generate `count` pedagogical MCQs about `content`.

        Parameters
        ----------
        content:  Literary text excerpt (up to ~4000 chars used).
        doc_type: "play" | "novel" | "generic"
        count:    Number of questions (1–10 recommended).
        language: "en" | "fr"
        """
        count = max(1, min(count, 10))
        text_sample = content[:4000]

        # ── Tier 1: Gemini (Primary) ────────────────────────────────────────────
        print(f"DEBUG: Tier 1 (Gemini) - Generating {count} {language} questions for {doc_type}")
        if self._gemini.is_available():
            questions = self._generate_gemini(text_sample, doc_type, count, language)
            if questions:
                print(f"DEBUG: Tier 1 (Gemini) success - {len(questions)} questions")
                return questions[:count]
        print("DEBUG: Tier 1 (Gemini) unavailable or failed")

        # ── Tier 2: HF Inference (Serverless) ───────────────────────────────
        print(f"DEBUG: Tier 2 (HF Inference) - Generating {count} questions")
        if os.getenv("USE_HF_INFERENCE") == "1" and _hf_inference.api_token:
            try:
                # We can use the dedicated generate_quiz method
                questions = _hf_inference.generate_quiz(text_sample, count)
                if questions and isinstance(questions, list):
                    print(f"DEBUG: Tier 2 (HF Inference) success - {len(questions)} questions")
                    return [self._normalise_question(q) for q in questions]
            except Exception as e:
                print(f"DEBUG: Tier 2 (HF Inference) error: {e}")
                pass
        print("DEBUG: Tier 2 (HF Inference) skipped or failed")

        # ── Tier 3: Content-aware templates ───────────────────────────────────
        print(f"DEBUG: Tier 3 (Templates) - Generating {count} questions")
        return self._get_templates(text_sample, doc_type, count, language)

    def generate_for_unit(
        self,
        unit: Dict[str, Any],
        doc_type: str,
        count: int = 4,
        language: str = "en",
    ) -> List[Dict[str, Any]]:
        """
        Generate questions for a single structural unit (chapter or scene).
        Extracts relevant text content from the unit dict.
        """
        content = self._extract_unit_content(unit, doc_type)
        if not content:
            return []
        questions = self.generate(content, doc_type, count, language)
        for q in questions:
            q["unit_id"]    = unit.get("id", "")
            q["unit_title"] = unit.get("title", "")
        return questions

    # ── Private helpers ────────────────────────────────────────────────────────

    def _generate_gemini(
        self,
        content: str,
        doc_type: str,
        count: int,
        language: str,
    ) -> List[Dict[str, Any]]:
        """Generate high-quality pedagogical questions using Gemini."""
        system_instruction = (
            "You are an expert primary school teacher specializing in literacy for students aged 9-12 (Primary 4-6). "
            "Create engaging multiple-choice questions about the provided text. "
            "Focus on: understanding plot and characters, predicting outcomes, and identifying themes or morals. "
            "Ensure the vocabulary of the questions is appropriate for 9-12 year olds."
        )

        lang_hint = " Answer in French." if language == "fr" else ""
        prompt = (
            f"Generate {count} multiple-choice questions about this {doc_type} passage.{lang_hint}\n\n"
            f"TEXT:\n{content}\n\n"
            "Respond in JSON with exactly this structure:\n"
            '{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "...", "difficulty": "easy|medium|hard"}]}'
        )

        try:
            result = self._gemini.generate_json(prompt, system_instruction)
            raw_qs = result.get("questions", [])
            if raw_qs:
                return [self._normalise_question(q) for q in raw_qs]
        except Exception as e:
            print(f"⚠️  PedagogicalQGen Gemini error: {e}")
        return []

    @staticmethod
    def _normalise_question(q: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure question dict matches the required schema and strip option labels."""
        options = q.get("options", [])
        if not isinstance(options, list) or len(options) < 2:
            options = ["Option A", "Option B", "Option C", "Option D"]
        
        # Strip prefixes like "A) ", "B. ", "1. ", etc.
        cleaned_options = []
        for opt in options:
            opt_str = str(opt).strip()
            # Match "A) ", "a) ", "A. ", "1) ", "1. " at the start
            cleaned = re.sub(r'^[a-dA-D1-4][\.\)]\s*', '', opt_str)
            cleaned_options.append(cleaned)
        
        options = cleaned_options
        while len(options) < 4:
            options.append("Not enough information")

        correct = q.get("correctAnswer", 0)
        if not isinstance(correct, int):
            try:
                correct = int(correct)
            except (ValueError, TypeError):
                correct = 0
        correct = max(0, min(correct, len(options) - 1))

        res = {
            "question":      str(q.get("question", "What is the main theme of this passage?")),
            "options":       options[:4],
            "correctAnswer": correct,
            "explanation":   str(q.get("explanation", "Based on the passage.")),
            "difficulty":    q.get("difficulty", "medium"),
        }
        
        if "chunk_index" in q:
            res["chunk_index"] = q["chunk_index"]
        if "chapter_title" in q:
            res["chapter_title"] = q["chapter_title"]
            
        return res

    @staticmethod
    def _get_templates(content: str, doc_type: str, count: int, language: str = "en") -> List[Dict[str, Any]]:
        if language == "fr":
            if doc_type == "play":
                return _play_templates_fr(content, count)
            if doc_type == "novel":
                return _novel_templates_fr(content, count)
            return _generic_templates_fr(content, count)

        if doc_type == "play":
            return _play_templates(content, count)
        if doc_type == "novel":
            return _novel_templates(content, count)
        return _generic_templates(content, count)

    @staticmethod
    def _extract_unit_content(unit: Dict[str, Any], doc_type: str) -> str:
        if doc_type == "play":
            lines = []
            for b in unit.get("blocks", []):
                if b.get("type") == "dialogue":
                    char = b.get("character", "")
                    lines.append(f"{char}: {b.get('content', '')}")
                elif b.get("content"):
                    lines.append(b["content"])
            return "\n".join(lines)[:3000]
        else:
            content = unit.get("content", "")
            if not content:
                paras = unit.get("paragraphs", [])
                content = "\n\n".join(paras)
            return content[:3000]

# ── Fallback Templates ────────────────────────────────────────────────────────

def _extract_sentences(content: str, min_words: int = 5) -> List[str]:
    sentences = re.split(r'(?<=[.!?])\s+', content)
    return [s.strip() for s in sentences if len(s.split()) >= min_words]

def _generic_templates(content: str, count: int) -> List[Dict[str, Any]]:
    sentences = _extract_sentences(content)
    qs = []
    for i in range(min(count, len(sentences))):
        sentence = sentences[i]
        qs.append({
            "question": f"According to the text, which statement is true?",
            "options": [sentence, "None of the above", "Cannot be determined", "The opposite is true"],
            "correctAnswer": 0,
            "explanation": "This detail is explicitly mentioned in the text.",
            "difficulty": "easy"
        })
    return qs

def _novel_templates(content: str, count: int) -> List[Dict[str, Any]]:
    qs = _generic_templates(content, count)
    for q in qs:
        q["question"] = "Based on the story, what happens?"
    return qs

def _play_templates(content: str, count: int) -> List[Dict[str, Any]]:
    qs = _generic_templates(content, count)
    for q in qs:
        q["question"] = "Which character's dialogue or action is described?"
    return qs

def _generic_templates_fr(content: str, count: int) -> List[Dict[str, Any]]:
    sentences = _extract_sentences(content)
    qs = []
    for i in range(min(count, len(sentences))):
        qs.append({
            "question": f"Selon le texte, quelle affirmation est vraie ?",
            "options": [sentences[i], "Aucune de ces réponses", "Impossible à déterminer", "Le contraire est vrai"],
            "correctAnswer": 0,
            "explanation": "Ce détail est mentionné explicitement dans le texte.",
            "difficulty": "easy"
        })
    return qs

def _novel_templates_fr(content: str, count: int) -> List[Dict[str, Any]]:
    qs = _generic_templates_fr(content, count)
    for q in qs:
        q["question"] = "Que se passe-t-il dans l'histoire ?"
    return qs

def _play_templates_fr(content: str, count: int) -> List[Dict[str, Any]]:
    qs = _generic_templates_fr(content, count)
    for q in qs:
        q["question"] = "Quel dialogue ou action de personnage est décrit ?"
    return qs
