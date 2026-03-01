"""
question_generator.py
=====================
PedagogicalQuestionGenerator
-----------------------------
A pedagogy-aware question generator that wraps the existing SmartQuestionGenerator
with literary-specific system prompts.

Document-type-aware prompts guide the LLM toward:
  • Play  → character motivation, dramatic irony, dialogue purpose, theme questions
  • Novel → narrative technique, setting, character development questions

Falls back to deterministic template questions if Ollama is unavailable.
"""

from __future__ import annotations

import sys
import os
from typing import Any, Dict, List, Optional

# Allow import from the parent ai-service package when running as a module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    from services.ollama_service import OllamaService
    _OLLAMA_AVAILABLE = True
except ImportError:
    _OLLAMA_AVAILABLE = False


# ── System prompt templates ────────────────────────────────────────────────────

_PLAY_SYSTEM = (
    "You are an expert drama teacher who creates pedagogical questions for students "
    "studying plays. Focus on: character motivation, dramatic irony, use of language, "
    "staging choices, themes, and conflicts. "
    "Return ONLY a JSON object: {\"questions\": [ ... ]}. "
    "Each question must have: 'question' (str), 'options' (4-element list), "
    "'correctAnswer' (0-based index), 'explanation' (str), 'difficulty' ('easy'|'medium'|'hard')."
)

_NOVEL_SYSTEM = (
    "You are an expert literature teacher who creates pedagogical questions for students "
    "studying novels. Focus on: narrative perspective, characterisation, setting, "
    "imagery, themes, and plot structure. "
    "Return ONLY a JSON object: {\"questions\": [ ... ]}. "
    "Each question must have: 'question' (str), 'options' (4-element list), "
    "'correctAnswer' (0-based index), 'explanation' (str), 'difficulty' ('easy'|'medium'|'hard')."
)

_GENERIC_SYSTEM = (
    "You are an expert educator. Create comprehension questions about the provided text. "
    "Return ONLY a JSON object: {\"questions\": [ ... ]}. "
    "Each question must have: 'question' (str), 'options' (4-element list), "
    "'correctAnswer' (0-based index), 'explanation' (str), 'difficulty' ('easy'|'medium'|'hard')."
)


# ── Fallback template factories ────────────────────────────────────────────────

def _play_fallback(content: str, count: int) -> List[Dict[str, Any]]:
    snippet = content[:200].replace('"', "'")
    return [
        {
            "question":      "What is the primary setting described in this scene?",
            "options":       ["A grand palace", "A public square", "As described in the text", "An unknown location"],
            "correctAnswer": 2,
            "explanation":   "The stage directions describe the setting explicitly.",
            "difficulty":    "easy",
        },
        {
            "question":      "What literary device is most evident in the characters' dialogue?",
            "options":       ["Alliteration", "Dramatic irony", "Onomatopoeia", "Hyperbole"],
            "correctAnswer": 1,
            "explanation":   "The audience often knows more than the characters, creating dramatic irony.",
            "difficulty":    "medium",
        },
        {
            "question":      f"Which best summarises the tone of this section: '{snippet[:80]}...'?",
            "options":       ["Comedic", "Tragic", "Satirical", "Romantic"],
            "correctAnswer": 1,
            "explanation":   "The diction and context suggest a serious, tragic tone.",
            "difficulty":    "medium",
        },
    ][:count]


def _novel_fallback(content: str, count: int) -> List[Dict[str, Any]]:
    return [
        {
            "question":      "What narrative perspective is used in this passage?",
            "options":       ["First person", "Second person", "Third person limited", "Third person omniscient"],
            "correctAnswer": 2,
            "explanation":   "The narrator describes thoughts but stays close to one character.",
            "difficulty":    "easy",
        },
        {
            "question":      "What mood is established in the opening of this chapter?",
            "options":       ["Joyful", "Tense", "Melancholic", "Humorous"],
            "correctAnswer": 1,
            "explanation":   "The descriptive language creates a sense of unease and tension.",
            "difficulty":    "medium",
        },
    ][:count]


# ── Generator class ────────────────────────────────────────────────────────────

class PedagogicalQuestionGenerator:
    """
    Generate pedagogically rich questions for a literary passage.

    Parameters
    ----------
    doc_type:
        "play" | "novel" | "generic"

    Usage
    -----
    >>> gen = PedagogicalQuestionGenerator()
    >>> questions = gen.generate(content="...", doc_type="play", count=5)
    """

    def __init__(self):
        self._ollama: Optional[Any] = None
        if _OLLAMA_AVAILABLE:
            try:
                self._ollama = OllamaService()
            except Exception:
                self._ollama = None

    def generate(
        self,
        content:  str,
        doc_type: str = "generic",
        count:    int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Generate `count` questions about `content`.

        Falls back to deterministic templates if Ollama is unavailable.
        """
        system_prompt = {
            "play":    _PLAY_SYSTEM,
            "novel":   _NOVEL_SYSTEM,
        }.get(doc_type, _GENERIC_SYSTEM)

        user_prompt = (
            f"Create {count} pedagogical multiple-choice questions about the following "
            f"literary text.\n\nTEXT:\n{content[:4000]}"
        )

        if self._ollama and self._is_ollama_available():
            try:
                result = self._ollama.generate_json(user_prompt, system_prompt)
                questions = result.get("questions", [])
                if questions:
                    return questions[:count]
            except Exception as e:
                print(f"⚠️  PedagogicalQuestionGenerator Ollama error: {e}")

        # Fallback
        if doc_type == "play":
            return _play_fallback(content, count)
        elif doc_type == "novel":
            return _novel_fallback(content, count)
        return [
            {
                "question":      "What is the main topic of this passage?",
                "options":       ["Option A", "Option B", "Option C", "Option D"],
                "correctAnswer": 0,
                "explanation":   "Read carefully to find the central idea.",
                "difficulty":    "easy",
            }
        ][:count]

    def _is_ollama_available(self) -> bool:
        try:
            return bool(self._ollama and self._ollama.is_available())
        except Exception:
            return False
