"""
vocab_analyzer.py
=================
Batch Vocabulary Analyzer for IncludEd 2.0.

Processes an entire book at upload time to pre-compute:
  1. Difficult word list per chapter (difficulty score 0.0–1.0)
  2. Child-friendly definitions with analogies (via Gemini → FLAN-T5 → template)
  3. Pronunciation guides (syllable-split phonetics)
  4. Word categories: vocabulary | archaic | idiom | figurative | cultural
  5. Contextual example sentences pulled directly from the source text

This data is stored in Literature.bookBrain.vocabulary and exposed via
the VocabSidebar component in the Reader.

Per-word schema (matches VocabSidebar.tsx):
  {
    "word":          str,
    "difficulty":    float,          # 0.0 (easy) → 1.0 (very hard)
    "definition":    str,            # simple, child-friendly
    "analogy":       str,            # "Like when…" metaphor for a 10-year-old
    "pronunciation": str,            # e.g. "WHERE-fore"
    "syllables":     int,
    "category":      str,            # vocabulary | archaic | idiom | figurative | cultural
    "context":       str,            # sentence from book containing the word
    "chapter_index": int,            # which chapter this word is from
  }

On-demand /vocab/explain also uses this pipeline for single words tapped
by students during reading.
"""

from __future__ import annotations

import re
import json
import math
import asyncio
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from services.word_difficulty_service import WordDifficultyService

# ── Optional HF Fallback (Tier 2) ──────────────────────────────────────────────
# No local model loading to save memory (D7 compliance)


# ── Archaic / cultural word lists ─────────────────────────────────────────────

_ARCHAIC_WORDS = {
    "thou", "thee", "thy", "thine", "hath", "doth", "art", "wilt", "shalt",
    "ere", "hence", "hither", "thither", "wherefore", "forsooth", "prithee",
    "methinks", "anon", "perchance", "betwixt", "whence", "oft", "nay", "yea",
    "verily", "whereat", "henceforth", "thereof", "herein", "therefrom",
    "o'er", "e'er", "ne'er", "tis", "twas", "twere", "twixt",
}

_FIGURATIVE_PATTERNS = [
    r"\blike\s+a\b",        # simile: "like a rose"
    r"\bas\s+\w+\s+as\b",   # simile: "as brave as a lion"
    r"\bseems\s+to\b",
]

_CULTURAL_MARKERS = {
    "sennet", "alarum", "hautboy", "prologue", "epilogue", "soliloquy",
    "aside", "chorus", "protagonist", "antagonist", "tragic", "comedy",
    "sonnet", "iambic", "pentameter", "couplet", "stanza", "metaphor",
}

# ── Template fallback definitions ─────────────────────────────────────────────

_CATEGORY_TEMPLATES: Dict[str, Dict[str, str]] = {
    "archaic": {
        "definition": "An old-fashioned word that people used long ago.",
        "analogy":    "Like words your great-great-grandparents might have used.",
    },
    "figurative": {
        "definition": "A word or phrase that means something different from its literal meaning.",
        "analogy":    "Like saying 'it's raining cats and dogs' — it doesn't really mean animals are falling!",
    },
    "cultural": {
        "definition": "A word linked to a special custom, tradition, or idea.",
        "analogy":    "Like a word you might only understand if you know the history.",
    },
    "vocabulary": {
        "definition": "A useful word to know for reading and writing.",
        "analogy":    "Like a new tool you can add to your word toolbox.",
    },
    "idiom": {
        "definition": "A phrase where the words together mean something different from their individual meanings.",
        "analogy":    "Like 'kick the bucket' — it doesn't mean kicking an actual bucket!",
    },
}


# ── Categorization ─────────────────────────────────────────────────────────────

def _categorize(word: str, context: str) -> str:
    w = word.lower().strip("'")
    if w in _ARCHAIC_WORDS:
        return "archaic"
    if w in _CULTURAL_MARKERS:
        return "cultural"
    ctx = context.lower()
    if any(re.search(p, ctx) for p in _FIGURATIVE_PATTERNS):
        return "figurative"
    # Idiomatic: word appears in a multi-word phrase that doesn't parse literally
    if re.search(r"\b(?:let|give|take|make|break|run|keep)\s+\w+\s+of\b", ctx):
        return "idiom"
    return "vocabulary"


# ── Gemini-powered explanation ────────────────────────────────────────────────

    system = "You are a kind children's reading teacher. Always use simple, encouraging language."
    result = gemini_service.generate_json(prompt, system)
    if result and "definition" in result and "analogy" in result:
        return result
    return None


def _gemini_explain_batch(
    words_data: List[Dict[str, str]],
    gemini_service: Any,
) -> Dict[str, Dict[str, str]]:
    """Call Gemini to explain multiple words at once. Returns {word: {definition, analogy}}."""
    if not gemini_service or not gemini_service.is_available() or not words_data:
        return {}

    prompt = f"""You are explaining these words from a book to a 10-year-old child with dyslexia.
For each word, provide a simple definition and a 'Like when...' analogy.

Words to explain:
{json.dumps(words_data, indent=2)}

Return a JSON object where each key is the word, and the value is an object with:
  "definition" — one simple sentence (max 15 words), no complex vocabulary
  "analogy"    — start with "Like when..." using everyday examples

Return ONLY valid JSON, no markdown formatting."""

    system = "You are a kind children's reading teacher. Always use simple language for kids with dyslexia."
    try:
        results = gemini_service.generate_json(prompt, system)
        if isinstance(results, dict):
            return results
    except Exception as e:
        print(f"⚠️ Batch explanation failed: {e}")
    return {}


def _hf_explain(word: str, context: str, hf_service: Any) -> Optional[Dict[str, str]]:
    """Use Hugging Face API to generate a child-friendly definition."""
    if not hf_service:
        return None
    
    prompt = (
        f'You are a kind teacher. Explain the word "{word}" from this sentence in very simple words '
        f'for a 10-year-old child: "{context[:200]}". '
        f'Respond ONLY with a JSON object: {{"definition": "...", "analogy": "Like when..."}}'
    )
    
    try:
        # Use the high-quality Qwen 72B model for fallback
        response = hf_service.client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=hf_service.models["quiz_generation"],
            max_tokens=200,
        )
        text = response.choices[0].message.content.strip()
        
        # Extract JSON
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "{" in text and "}" in text:
            text = text[text.find("{"):text.rfind("}")+1]
            
        res = json.loads(text)
        if "definition" in res and "analogy" in res:
            return res
    except Exception as e:
        print(f"⚠️ HF Fallback explanation failed: {e}")
    return None


# ── Template fallback ─────────────────────────────────────────────────────────

def _template_explain(word: str, category: str) -> Dict[str, str]:
    tmpl = _CATEGORY_TEMPLATES.get(category, _CATEGORY_TEMPLATES["vocabulary"])
    return {
        "definition": tmpl["definition"],
        "analogy":    tmpl["analogy"],
    }


# ── Core class ────────────────────────────────────────────────────────────────

class VocabAnalyzer:
    """
    Analyze vocabulary across a full book or for a single word on demand.

    Parameters
    ----------
    gemini_service:
        Optional GeminiService instance. Pass None to skip Gemini.
    difficulty_threshold:
        Words with difficulty ≥ this value are included (default 0.45).
    max_words_per_chapter:
        Cap on hard words extracted per chapter to keep UI manageable.
    """

    def __init__(
        self,
        gemini_service: Optional[Any] = None,
        hf_service: Optional[Any] = None,
        difficulty_threshold: float = 0.45,
        max_words_per_chapter: int = 30,
    ):
        self._difficulty_svc   = WordDifficultyService()
        self._gemini           = gemini_service
        self._hf               = hf_service
        self._threshold        = difficulty_threshold
        self._max_per_chapter  = max_words_per_chapter

    # ── Public: batch book analysis ──────────────────────────────────────────

    def analyze_book(
        self,
        sections: List[str],
        section_titles: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Analyze all sections and return a flat vocabulary list.

        Called at book upload time; results stored in Literature.bookBrain.vocabulary.

        Parameters
        ----------
        sections:
            List of chapter/section plain texts.
        section_titles:
            Optional title list (same length as sections).

        Returns
        -------
        List of word dicts sorted by (chapter_index, difficulty DESC).
        """
        all_words: List[Dict[str, Any]] = []
        global_seen: set = set()   # deduplicate across whole book

        for idx, text in enumerate(sections):
            chapter_words = self._analyze_section(text, idx)
            for w in chapter_words:
                key = w["word"].lower()
                if key not in global_seen:
                    all_words.append(w)
                    global_seen.add(key)

        return all_words

    def _analyze_section(self, text: str, chapter_index: int) -> List[Dict[str, Any]]:
        """Analyze one section and return its hard word list."""
        raw = self._difficulty_svc.analyze_passage(text, self._threshold)
        # Limit to top N hardest words
        raw = raw[: self._max_per_chapter]

        if not raw:
            return []

        # Prepare batch for Gemini
        gemini_batch = []
        for item in raw:
            word = item["word"]
            context = item.get("context", "")
            category = _categorize(word, context)
            gemini_batch.append({
                "word": word,
                "context": context[:150],
                "category": category
            })

        # Call batch explainer
        batch_explanations = _gemini_explain_batch(gemini_batch, self._gemini)

        results = []
        for item in raw:
            word     = item["word"]
            context  = item.get("context", "")
            category = _categorize(word, context)

            # Get explanation from batch OR fallback
            explanation = batch_explanations.get(word)
            if not explanation:
                explanation = _hf_explain(word, context, self._hf) or _template_explain(word, category)

            results.append({
                "word":          word,
                "difficulty":    item["difficulty"],
                "definition":    explanation.get("definition", ""),
                "analogy":       explanation.get("analogy", ""),
                "pronunciation": item.get("pronunciation", self._difficulty_svc.generate_pronunciation(word.lower())),
                "syllables":     item.get("syllables", self._difficulty_svc.count_syllables(word.lower())),
                "category":      category,
                "context":       context,
                "chapter_index": chapter_index,
            })

        return results

    # ── Public: on-demand single word ─────────────────────────────────────────

    def explain_word(
        self,
        word: str,
        context: str = "",
        chapter_index: int = 0,
    ) -> Dict[str, Any]:
        """
        Explain a single word on demand (called when student taps a word).

        Returns the same schema as batch analysis, for one word.
        """
        difficulty = self._difficulty_svc.estimate_difficulty(word.lower())
        syllables  = self._difficulty_svc.count_syllables(word.lower())
        pronun     = self._difficulty_svc.generate_pronunciation(word.lower())
        category   = _categorize(word, context)

        if not context:
            context = f'The word "{word}" appears in this text.'

        batch_explanations = _gemini_explain_batch([{
            "word": word, 
            "context": context[:150], 
            "category": category
        }], self._gemini)
        
        explanation = batch_explanations.get(word)
        if not explanation:
            explanation = _hf_explain(word, context, self._hf) or _template_explain(word, category)

        return {
            "word":          word,
            "difficulty":    round(difficulty, 3),
            "definition":    explanation.get("definition", ""),
            "analogy":       explanation.get("analogy", ""),
            "pronunciation": pronun,
            "syllables":     syllables,
            "category":      category,
            "context":       context[:200],
            "chapter_index": chapter_index,
        }

    # ── Public: filter words for current section ──────────────────────────────

    @staticmethod
    def words_for_section(
        all_words: List[Dict[str, Any]],
        section_text: str,
        chapter_index: int,
        max_display: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Filter book vocabulary to words actually present in the current section.
        Used by VocabSidebar.tsx to show only relevant words.
        """
        text_lower = section_text.lower()
        # Prioritise words from same chapter, then other chapters
        same = [w for w in all_words if w["chapter_index"] == chapter_index and w["word"].lower() in text_lower]
        other = [w for w in all_words if w["chapter_index"] != chapter_index and w["word"].lower() in text_lower]
        combined = (same + other)[:max_display]
        return sorted(combined, key=lambda w: w["difficulty"], reverse=True)


# ── Module singleton ──────────────────────────────────────────────────────────

_analyzer: Optional[VocabAnalyzer] = None

def get_vocab_analyzer(gemini_service: Optional[Any] = None, hf_service: Optional[Any] = None) -> VocabAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = VocabAnalyzer(gemini_service=gemini_service, hf_service=hf_service)
    return _analyzer
