"""
character_service.py
====================
Two-in-one character intelligence service:

1. BERT NER  — named entity recognition using
   ``dbmdz/bert-large-cased-finetuned-conll03-english``
   Extracts PERSON entities from novel prose (supplements the dialogue-tag
   approach in book_brain.py which works well for plays but misses many
   novel characters).

2. DeBERTa Q&A — extractive question answering using
   ``deepset/deberta-v3-base-squad2``
   Answers spoiler-safe questions about characters based *only* on the text
   the student has read so far:
     "Who is Okonkwo and what has he done so far?"
     "What do we know about Lady Macbeth?"

Both models are lazy-loaded on first use and fall back gracefully.

Public API
----------
    svc = CharacterService()

    # NER: get character names from a text block
    names = svc.extract_person_names(text)          # List[str]

    # Q&A: describe a character from what has been read
    result = svc.describe_character(
        character="Okonkwo",
        context="...full text read so far...",
    )
    # {"character": "Okonkwo", "description": "...", "confidence": 0.87}
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

# ── Optional imports ───────────────────────────────────────────────────────────

_TRANSFORMERS_OK = False
try:
    from transformers import pipeline as hf_pipeline
    _TRANSFORMERS_OK = True
except ImportError:
    pass


# ── Model identifiers ──────────────────────────────────────────────────────────

_NER_MODEL  = "dbmdz/bert-large-cased-finetuned-conll03-english"
_QA_MODEL   = "deepset/deberta-v3-base-squad2"

# ── Singleton pipelines ────────────────────────────────────────────────────────

_ner_pipeline: Optional[Any] = None
_qa_pipeline:  Optional[Any] = None


def _load_ner() -> bool:
    global _ner_pipeline
    if _ner_pipeline is not None:
        return True
    if not _TRANSFORMERS_OK:
        return False
    try:
        print(f"🔬 Loading BERT NER ({_NER_MODEL}) …")
        _ner_pipeline = hf_pipeline(
            "ner",
            model=_NER_MODEL,
            aggregation_strategy="simple",   # merge B-/I- sub-tokens
        )
        print("✅ BERT NER ready")
        return True
    except Exception as exc:
        print(f"⚠️  BERT NER load failed: {exc}")
        _ner_pipeline = None
        return False


def _load_qa() -> bool:
    global _qa_pipeline
    if _qa_pipeline is not None:
        return True
    if not _TRANSFORMERS_OK:
        return False
    try:
        print(f"🔬 Loading DeBERTa Q&A ({_QA_MODEL}) …")
        _qa_pipeline = hf_pipeline("question-answering", model=_QA_MODEL)
        print("✅ DeBERTa Q&A ready")
        return True
    except Exception as exc:
        print(f"⚠️  DeBERTa Q&A load failed: {exc}")
        _qa_pipeline = None
        return False


# ── NER helpers ────────────────────────────────────────────────────────────────

# Noise names we never want — stage directions, common nouns, etc.
_NER_NOISE: set = {
    "I", "A", "THE", "AN", "ACT", "SCENE", "CHAPTER", "PART",
    "ENTER", "EXIT", "EXEUNT", "LORD", "LADY", "MAN", "WOMAN",
}

# Max chars per NER chunk (BERT limit is 512 tokens ≈ ~400 words ≈ ~2000 chars)
_NER_CHUNK_SIZE = 1800


def _chunk_text(text: str, size: int = _NER_CHUNK_SIZE) -> List[str]:
    """Split text into overlapping chunks that fit within BERT's token limit."""
    words = text.split()
    chunks = []
    step = size // 2
    buf = []
    buf_len = 0
    for w in words:
        buf.append(w)
        buf_len += len(w) + 1
        if buf_len >= size:
            chunks.append(" ".join(buf))
            buf = buf[-step:]
            buf_len = sum(len(w) + 1 for w in buf)
    if buf:
        chunks.append(" ".join(buf))
    return chunks or [text]


# ── Service class ──────────────────────────────────────────────────────────────

class CharacterService:
    """
    Provides BERT-NER character extraction and DeBERTa-based character Q&A.
    Both models are loaded lazily and degrade gracefully to heuristic fallbacks.
    """

    # ── NER ───────────────────────────────────────────────────────────────────

    def extract_person_names(self, text: str) -> List[str]:
        """
        Extract unique PERSON entity names from ``text`` using BERT NER.

        Falls back to a simple regex heuristic (ALL-CAPS words / Title-Case
        runs following dialogue verbs) if the model is unavailable.

        Returns a deduplicated, title-cased list sorted by first occurrence.
        """
        if _load_ner() and _ner_pipeline is not None:
            return self._ner_extract(text)
        return self._regex_person_fallback(text)

    def _ner_extract(self, text: str) -> List[str]:
        seen: dict = {}   # name -> first char offset (for order)
        offset = 0
        for chunk in _chunk_text(text):
            try:
                entities = _ner_pipeline(chunk)
                for ent in entities:
                    if ent.get("entity_group") == "PER":
                        name = ent["word"].strip().title()
                        # Filter short / noisy tokens
                        if len(name) >= 2 and name.upper() not in _NER_NOISE:
                            if name not in seen:
                                seen[name] = offset + ent.get("start", 0)
            except Exception as exc:
                print(f"⚠️  NER chunk error: {exc}")
            offset += len(chunk)

        # Sort by first occurrence, return names only
        return [name for name, _ in sorted(seen.items(), key=lambda x: x[1])]

    def _regex_person_fallback(self, text: str) -> List[str]:
        """Heuristic fallback: pull Title-Case names after dialogue verbs."""
        pattern = re.compile(
            r'(?:said|replied|asked|whispered|shouted|cried|exclaimed|murmured|thought)\s+'
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        )
        seen = {}
        for m in pattern.finditer(text):
            name = m.group(1).strip()
            if name not in seen:
                seen[name] = m.start()
        return [n for n, _ in sorted(seen.items(), key=lambda x: x[1])]

    # ── Q&A ───────────────────────────────────────────────────────────────────

    def describe_character(
        self,
        character: str,
        context: str,
        max_context_chars: int = 4000,
    ) -> Dict[str, Any]:
        """
        Answer "Who is {character} and what have they done so far?" using
        the DeBERTa extractive Q&A model against the text already read.

        Parameters
        ----------
        character:
            Character name to describe (e.g. "Okonkwo", "Lady Macbeth").
        context:
            The full text the student has read so far (will be truncated to
            ``max_context_chars`` to fit model limits).
        max_context_chars:
            Safety cap on context length (~4000 chars ≈ 600 tokens).

        Returns
        -------
        {
            "character": str,
            "description": str,
            "confidence": float,
            "model": "deberta" | "fallback"
        }
        """
        # Find the most relevant window of context that mentions the character
        relevant = self._find_relevant_window(character, context, max_context_chars)

        if _load_qa() and _qa_pipeline is not None:
            return self._qa_describe(character, relevant)
        return self._fallback_describe(character, relevant)

    def _find_relevant_window(
        self, character: str, context: str, max_chars: int
    ) -> str:
        """Extract the portion of context most relevant to the character."""
        if len(context) <= max_chars:
            return context

        # Find sentences containing the character name, gather surrounding context
        pattern = re.compile(
            re.escape(character), re.IGNORECASE
        )
        sentences = re.split(r"(?<=[.!?])\s+", context)
        relevant_sentences = [s for s in sentences if pattern.search(s)]

        if not relevant_sentences:
            return context[:max_chars]

        # Take up to max_chars worth of relevant sentences
        result = ""
        for sent in relevant_sentences:
            if len(result) + len(sent) <= max_chars:
                result += sent + " "
            else:
                break
        return result.strip() or context[:max_chars]

    def _qa_describe(self, character: str, context: str) -> Dict[str, Any]:
        """Use DeBERTa to answer questions about the character."""
        question = f"Who is {character} and what have they done so far in the story?"
        try:
            result = _qa_pipeline(question=question, context=context)
            return {
                "character": character,
                "description": result["answer"],
                "confidence": round(result["score"], 3),
                "model": "deberta",
            }
        except Exception as exc:
            print(f"⚠️  DeBERTa Q&A error for '{character}': {exc}")
            return self._fallback_describe(character, context)

    def _fallback_describe(self, character: str, context: str) -> Dict[str, Any]:
        """
        Heuristic fallback: collect sentences that mention the character and
        return the first few as a description.
        """
        pattern = re.compile(re.escape(character), re.IGNORECASE)
        sentences = re.split(r"(?<=[.!?])\s+", context)
        mentions = [s.strip() for s in sentences if pattern.search(s)][:4]
        description = " ".join(mentions) if mentions else f"{character} appears in the story."
        return {
            "character": character,
            "description": description,
            "confidence": 0.0,
            "model": "fallback",
        }

    # ── Bulk character enrichment ─────────────────────────────────────────────

    def enrich_character_list(
        self,
        characters: List[Dict[str, Any]],
        full_text: str,
        max_chars_per_char: int = 3000,
    ) -> List[Dict[str, Any]]:
        """
        Given the character list produced by book_brain.py, fill in the
        ``description`` field for characters that have an empty one using
        DeBERTa Q&A.

        Parameters
        ----------
        characters:
            List of character dicts (name, importance, description, …).
        full_text:
            All body text of the book.

        Returns
        -------
        The same list, with ``description`` fields populated.
        """
        for char in characters:
            if char.get("description"):
                continue   # Already filled by Gemini
            if char.get("importance") == "background":
                continue   # Skip unimportant characters

            result = self.describe_character(
                character=char["name"],
                context=full_text,
                max_context_chars=max_chars_per_char,
            )
            char["description"] = result["description"]
            char["description_confidence"] = result["confidence"]
            char["description_model"] = result["model"]

        return characters


# ── Module-level singleton ─────────────────────────────────────────────────────

_service: Optional[CharacterService] = None


def get_character_service() -> CharacterService:
    global _service
    if _service is None:
        _service = CharacterService()
    return _service
