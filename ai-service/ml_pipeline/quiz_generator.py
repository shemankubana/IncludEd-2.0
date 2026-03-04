"""
quiz_generator.py
=================
PedagogicalQuestionGenerator — 3-tier generation pipeline.

Tier 1 (Primary)   — Ollama LLM (llama3 / any local model)
                     Best quality; requires Ollama running.
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


# ── System prompts (Ollama) ────────────────────────────────────────────────────

_PLAY_SYSTEM = (
    "You are an expert drama teacher. Create pedagogical multiple-choice questions "
    "about the play passage provided. Focus on: character motivation, dramatic irony, "
    "use of language, staging, themes, and conflicts. "
    "IMPORTANT: Return ONLY valid JSON with this exact schema:\n"
    '{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], '
    '"correctAnswer": 0, "explanation": "...", "difficulty": "easy|medium|hard"}]}'
)

_NOVEL_SYSTEM = (
    "You are an expert literature teacher. Create pedagogical multiple-choice questions "
    "about the novel passage. Focus on: narrative perspective, characterisation, "
    "setting, imagery, themes, and plot structure. "
    "IMPORTANT: Return ONLY valid JSON with this exact schema:\n"
    '{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], '
    '"correctAnswer": 0, "explanation": "...", "difficulty": "easy|medium|hard"}]}'
)

_GENERIC_SYSTEM = (
    "You are an expert educator. Create comprehension questions for the passage. "
    "IMPORTANT: Return ONLY valid JSON with this exact schema:\n"
    '{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], '
    '"correctAnswer": 0, "explanation": "...", "difficulty": "easy|medium|hard"}]}'
)

# ── FLAN-T5 prompt templates ───────────────────────────────────────────────────

_T5_PLAY_PROMPT = (
    "You are a drama teacher. Based on this play excerpt, generate a multiple choice "
    "question. Format exactly as:\n"
    "Question: [question]\n"
    "A) [option]\nB) [option]\nC) [option]\nD) [option]\n"
    "Correct: [A/B/C/D]\n"
    "Explanation: [brief explanation]\n\n"
    "Play excerpt: {text}\n\n"
    "Generate question {num} about {aspect}:"
)

_T5_NOVEL_PROMPT = (
    "You are a literature teacher. Based on this novel excerpt, generate a multiple choice "
    "question. Format exactly as:\n"
    "Question: [question]\n"
    "A) [option]\nB) [option]\nC) [option]\nD) [option]\n"
    "Correct: [A/B/C/D]\n"
    "Explanation: [brief explanation]\n\n"
    "Novel excerpt: {text}\n\n"
    "Generate question {num} about {aspect}:"
)

_PLAY_ASPECTS  = ["character motivation", "dramatic tension", "themes", "language use", "stage setting"]
_NOVEL_ASPECTS = ["narrative perspective", "character development", "setting", "imagery", "themes"]


# ── FLAN-T5 generator ──────────────────────────────────────────────────────────

class FlanT5Generator:
    """
    Offline MCQ generation using google/flan-t5-base.
    ~900MB one-time download; works fully offline thereafter.
    Use flan-t5-small (~300MB) for faster, lower-quality output.
    """

    MODEL_NAME = "google/flan-t5-base"

    def __init__(self):
        self._model     = None
        self._tokenizer = None
        self._ready     = False
        self._load_model()

    def _load_model(self):
        try:
            from transformers import T5ForConditionalGeneration, T5Tokenizer
            print(f"🤖 QuizGen: loading {self.MODEL_NAME}…")
            self._tokenizer = T5Tokenizer.from_pretrained(self.MODEL_NAME)
            self._model     = T5ForConditionalGeneration.from_pretrained(self.MODEL_NAME)
            self._ready     = True
            print("✅ QuizGen: FLAN-T5 ready.")
        except Exception as e:
            print(f"⚠️  QuizGen: FLAN-T5 unavailable ({e}). Will use templates.")

    def generate_single(
        self,
        text: str,
        doc_type: str,
        aspect: str,
        num: int = 1,
    ) -> Optional[Dict[str, Any]]:
        """Generate one MCQ question using FLAN-T5."""
        if not self._ready:
            return None

        template = _T5_PLAY_PROMPT if doc_type == "play" else _T5_NOVEL_PROMPT
        prompt = template.format(text=text[:600], num=num, aspect=aspect)

        try:
            import torch
            inputs = self._tokenizer(
                prompt,
                return_tensors="pt",
                max_length=512,
                truncation=True,
            )
            with torch.no_grad():
                outputs = self._model.generate(
                    inputs.input_ids,
                    max_new_tokens=200,
                    num_beams=4,
                    early_stopping=True,
                    no_repeat_ngram_size=3,
                )
            decoded = self._tokenizer.decode(outputs[0], skip_special_tokens=True)
            return self._parse_t5_output(decoded)
        except Exception as e:
            print(f"⚠️  FLAN-T5 inference error: {e}")
            return None

    def generate_batch(
        self,
        text: str,
        doc_type: str,
        count: int,
    ) -> List[Dict[str, Any]]:
        """Generate `count` questions using FLAN-T5."""
        aspects = _PLAY_ASPECTS if doc_type == "play" else _NOVEL_ASPECTS
        questions = []
        used_aspects = random.sample(aspects, min(count, len(aspects)))

        for i, aspect in enumerate(used_aspects[:count]):
            q = self.generate_single(text, doc_type, aspect, num=i + 1)
            if q:
                questions.append(q)

        return questions

    @staticmethod
    def _parse_t5_output(text: str) -> Optional[Dict[str, Any]]:
        """
        Parse FLAN-T5's free-text output into structured MCQ format.
        Expected (approximately):
            Question: <q>
            A) <a>
            B) <b>
            C) <c>
            D) <d>
            Correct: A
            Explanation: <exp>
        """
        lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
        question = ""
        options  = []
        correct_letter = "A"
        explanation = ""

        for line in lines:
            if line.lower().startswith("question:"):
                question = line[9:].strip()
            elif re.match(r"^[A-D]\)", line):
                options.append(line[2:].strip())
            elif line.lower().startswith("correct:"):
                correct_letter = line[8:].strip().upper()[:1]
            elif line.lower().startswith("explanation:"):
                explanation = line[12:].strip()

        if not question or len(options) < 2:
            return None

        # Pad to 4 options if needed
        while len(options) < 4:
            options.append("Not mentioned in the text")

        correct_idx = ord(correct_letter) - ord("A")
        correct_idx = max(0, min(correct_idx, len(options) - 1))

        return {
            "question":      question,
            "options":       options[:4],
            "correctAnswer": correct_idx,
            "explanation":   explanation or "Based on the passage content.",
            "difficulty":    "medium",
        }

    @property
    def ready(self) -> bool:
        return self._ready


# ── Content-aware template fallback ───────────────────────────────────────────

def _extract_sentences(text: str, max_sentences: int = 8) -> List[str]:
    """Extract meaningful sentences from text for template questions."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    meaningful = [s.strip() for s in sentences if len(s.split()) >= 6]
    return meaningful[:max_sentences]


def _play_templates(content: str, count: int) -> List[Dict[str, Any]]:
    sentences = _extract_sentences(content)
    snippet = sentences[0][:120] if sentences else content[:120]

    questions = [
        {
            "question":      f"What emotion is most clearly expressed in the line: \"{snippet}...\"?",
            "options":       ["Anger and resentment", "Joy and celebration", "Fear and uncertainty", "Love and tenderness"],
            "correctAnswer": 2,
            "explanation":   "The diction and context of the line convey tension and uncertainty.",
            "difficulty":    "medium",
        },
        {
            "question":      "What literary device is most prominent in the characters' dialogue?",
            "options":       ["Alliteration", "Dramatic irony", "Onomatopoeia", "Hyperbole"],
            "correctAnswer": 1,
            "explanation":   "The audience often holds knowledge the characters lack — a hallmark of dramatic irony.",
            "difficulty":    "medium",
        },
        {
            "question":      "What does the setting at the opening of this scene suggest?",
            "options":       ["Peace and security", "Tension and conflict", "Wealth and prosperity", "Isolation and loneliness"],
            "correctAnswer": 1,
            "explanation":   "Stage directions and imagery establish a tense atmosphere.",
            "difficulty":    "easy",
        },
        {
            "question":      "Which best describes the relationship between the two main speakers?",
            "options":       ["Allies working together", "Rivals in direct conflict", "Strangers meeting for the first time", "Old friends reconciling"],
            "correctAnswer": 1,
            "explanation":   "Their exchanges reveal opposing motives and goals.",
            "difficulty":    "hard",
        },
        {
            "question":      "What theme is most developed in this extract?",
            "options":       ["The importance of loyalty", "The conflict between love and duty", "The pursuit of wealth", "The fear of death"],
            "correctAnswer": 1,
            "explanation":   "The characters' choices and language reflect a central tension between personal feeling and obligation.",
            "difficulty":    "hard",
        },
    ]
    return questions[:count]


def _novel_templates(content: str, count: int) -> List[Dict[str, Any]]:
    sentences = _extract_sentences(content)
    snippet = sentences[0][:120] if sentences else content[:120]

    questions = [
        {
            "question":      "What narrative perspective is used in this passage?",
            "options":       ["First person", "Second person", "Third person limited", "Third person omniscient"],
            "correctAnswer": 2,
            "explanation":   "The narrator describes thoughts but stays close to one character's perspective.",
            "difficulty":    "easy",
        },
        {
            "question":      f"What does the phrase \"{snippet[:60]}...\" most likely suggest about the narrator's attitude?",
            "options":       ["Indifference to the events", "Critical distance from society", "Admiration for the protagonist", "Fear of the antagonist"],
            "correctAnswer": 1,
            "explanation":   "The word choice implies a detached, observational — and subtly critical — voice.",
            "difficulty":    "medium",
        },
        {
            "question":      "What mood is established at the opening of this chapter?",
            "options":       ["Joyful and optimistic", "Tense and unsettled", "Melancholic and resigned", "Humorous and light"],
            "correctAnswer": 1,
            "explanation":   "The descriptive language and imagery create a sense of unease.",
            "difficulty":    "medium",
        },
        {
            "question":      "Which technique does the author use to reveal the protagonist's character?",
            "options":       ["Direct description by the narrator", "Dialogue with another character", "Interior monologue", "All of the above"],
            "correctAnswer": 3,
            "explanation":   "Authors typically combine multiple techniques for multi-dimensional characterisation.",
            "difficulty":    "hard",
        },
        {
            "question":      "What does the setting symbolise in this chapter?",
            "options":       ["Freedom and possibility", "Entrapment and constraint", "Prosperity and ambition", "Decay and corruption"],
            "correctAnswer": 1,
            "explanation":   "The described environment mirrors the protagonist's emotional state.",
            "difficulty":    "hard",
        },
    ]
    return questions[:count]


def _generic_templates(content: str, count: int) -> List[Dict[str, Any]]:
    snippet = content[:100].replace('"', "'")
    return [
        {
            "question":      "What is the main topic of this passage?",
            "options":       ["A personal narrative", "A description of events", "An argument about ideas", "A description of a place"],
            "correctAnswer": 1,
            "explanation":   "The passage focuses on a sequence of described events.",
            "difficulty":    "easy",
        },
        {
            "question":      f"The passage begins: \"{snippet}...\" What does this suggest about the text?",
            "options":       ["The narrator is unreliable", "The reader needs background knowledge", "The story has already begun", "The author is addressing the reader directly"],
            "correctAnswer": 2,
            "explanation":   "Beginning in media res draws the reader into an ongoing situation.",
            "difficulty":    "medium",
        },
    ][:count]


# ── Main generator class ───────────────────────────────────────────────────────

class PedagogicalQuestionGenerator:
    """
    Three-tier pedagogical question generator.

    Priority: Ollama → FLAN-T5 → Content-aware templates
    """

    def __init__(self):
        self._ollama: Optional[Any] = None
        self._t5: Optional[FlanT5Generator] = None
        self._init_ollama()
        # T5 loaded lazily to avoid startup delay

    def _init_ollama(self):
        try:
            from services.ollama_service import OllamaService
            self._ollama = OllamaService()
        except Exception:
            self._ollama = None

    def _get_t5(self) -> FlanT5Generator:
        if self._t5 is None:
            self._t5 = FlanT5Generator()
        return self._t5

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

        # ── Tier 1: Ollama ────────────────────────────────────────────────────
        if self._ollama and self._is_ollama_available():
            questions = self._generate_ollama(text_sample, doc_type, count, language)
            if questions:
                return questions[:count]

        # ── Tier 2: FLAN-T5 ──────────────────────────────────────────────────
        t5 = self._get_t5()
        if t5.ready:
            questions = t5.generate_batch(text_sample, doc_type, count)
            if len(questions) >= min(count, 2):
                # Pad with templates if T5 didn't produce enough
                if len(questions) < count:
                    templates = self._get_templates(text_sample, doc_type, count - len(questions))
                    questions.extend(templates)
                return questions[:count]

        # ── Tier 3: Content-aware templates ───────────────────────────────────
        return self._get_templates(text_sample, doc_type, count)

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

    def _generate_ollama(
        self,
        content: str,
        doc_type: str,
        count: int,
        language: str,
    ) -> List[Dict[str, Any]]:
        system_map = {
            "play":    _PLAY_SYSTEM,
            "novel":   _NOVEL_SYSTEM,
        }
        system = system_map.get(doc_type, _GENERIC_SYSTEM)

        lang_hint = (
            " Answer in French." if language == "fr"
            else ""
        )
        user_prompt = (
            f"Create {count} pedagogical multiple-choice questions about this "
            f"literary text.{lang_hint}\n\nTEXT:\n{content}"
        )

        try:
            result = self._ollama.generate_json(user_prompt, system)
            raw_qs = result.get("questions", [])
            if raw_qs:
                return [self._normalise_question(q) for q in raw_qs]
        except Exception as e:
            print(f"⚠️  PedagogicalQGen Ollama error: {e}")
        return []

    @staticmethod
    def _normalise_question(q: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure question dict matches the required schema."""
        options = q.get("options", [])
        if not isinstance(options, list) or len(options) < 2:
            options = ["Option A", "Option B", "Option C", "Option D"]
        while len(options) < 4:
            options.append("Not enough information")

        correct = q.get("correctAnswer", 0)
        if not isinstance(correct, int):
            try:
                correct = int(correct)
            except (ValueError, TypeError):
                correct = 0
        correct = max(0, min(correct, len(options) - 1))

        return {
            "question":      str(q.get("question", "What is the main theme of this passage?")),
            "options":       options[:4],
            "correctAnswer": correct,
            "explanation":   str(q.get("explanation", "Based on the passage.")),
            "difficulty":    q.get("difficulty", "medium"),
        }

    @staticmethod
    def _get_templates(content: str, doc_type: str, count: int) -> List[Dict[str, Any]]:
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

    def _is_ollama_available(self) -> bool:
        try:
            return bool(self._ollama and self._ollama.is_available())
        except Exception:
            return False
