"""
language_detector.py
====================
Lightweight language detector for EN/FR literary text.

Architecture (2-tier):
  Tier 1 — langdetect library  (fast, probabilistic, ~1ms per call)
  Tier 2 — Keyword heuristics  (zero dependencies, always available)

Supported languages: English ("en"), French ("fr")
Falls back to "en" for all other detected languages.

Usage
-----
>>> from ml_pipeline.language_detector import LanguageDetector
>>> ld = LanguageDetector()
>>> ld.detect("To be, or not to be, that is the question.")
{"language": "en", "confidence": 0.98, "method": "langdetect"}
>>> ld.detect("Être ou ne pas être, telle est la question.")
{"language": "fr", "confidence": 0.97, "method": "langdetect"}
"""

from __future__ import annotations

import re
from typing import Dict, List

# ── French keyword signals ────────────────────────────────────────────────────
# A sampled vocabulary that's unambiguously French (not found in English texts)
_FR_KEYWORDS = [
    "est", "une", "les", "des", "dans", "pour", "mais", "avec", "sur", "pas",
    "que", "qui", "lui", "elle", "nous", "vous", "leur", "leur", "ses", "mon",
    "ton", "son", "nos", "vos", "ces", "aux", "au", "du", "ce", "cet",
    "cette", "tout", "plus", "bien", "très", "aussi", "encore", "maintenant",
    "donc", "ainsi", "alors", "quand", "comme", "même", "être", "avoir",
    "faire", "dire", "voir", "savoir", "vouloir", "pouvoir", "aller",
    "chapitre", "acte", "scène", "personnage", "dialogue", "réplique",
]

# Compile as whole-word pattern for efficiency
_FR_RE = re.compile(
    r"\b(" + "|".join(re.escape(w) for w in _FR_KEYWORDS) + r")\b",
    re.IGNORECASE,
)

# Clear French-only diacritics (not in standard English)
_DIACRITICS_RE = re.compile(r"[àâäéèêëîïôùûüçœæÀÂÄÉÈÊËÎÏÔÙÛÜÇŒÆ]")

# English markers not present in French prose
_EN_MARKERS_RE = re.compile(
    r"\b(the|and|that|this|with|from|have|been|they|their|would|could|should|"
    r"chapter|act|scene|prologue|epilogue|said|replied)\b",
    re.IGNORECASE,
)

_SUPPORTED = {"en", "fr"}


class LanguageDetector:
    """
    Detect whether a text is English or French.

    Singleton-friendly: instantiate once and reuse across requests.
    """

    def __init__(self):
        self._langdetect_ok = False
        self._load_langdetect()

    def _load_langdetect(self):
        try:
            import langdetect  # noqa: F401
            self._langdetect_ok = True
        except ImportError:
            print("⚠️  langdetect not installed — using keyword heuristics. "
                  "Run: pip install langdetect")

    # ── Public API ─────────────────────────────────────────────────────────────

    def detect(self, text: str) -> Dict[str, object]:
        """
        Detect the language of *text*.

        Returns
        -------
        {
            "language":   "en" | "fr",
            "confidence": float,        # 0.0 – 1.0
            "method":     str,          # "langdetect" | "heuristic"
        }
        """
        sample = self._sample(text)
        if not sample:
            return {"language": "en", "confidence": 0.5, "method": "default"}

        # Tier 1: langdetect
        if self._langdetect_ok:
            result = self._langdetect_inference(sample)
            if result:
                return result

        # Tier 2: keyword heuristics
        return self._heuristic_detect(sample)

    def detect_from_blocks(self, blocks: List[Dict]) -> Dict[str, object]:
        """
        Detect language from PyMuPDF block dicts (with 'lines'/'spans' structure).
        Extracts up to ~2000 chars of text for detection.
        """
        texts = []
        char_count = 0
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    t = span.get("text", "").strip()
                    if t:
                        texts.append(t)
                        char_count += len(t)
            if char_count > 2000:
                break
        return self.detect(" ".join(texts))

    # ── Private methods ────────────────────────────────────────────────────────

    def _langdetect_inference(self, text: str) -> Dict | None:
        try:
            import langdetect
            from langdetect import detect_langs
            results = detect_langs(text)
            if results:
                top = results[0]
                lang = top.lang[:2]  # "en", "fr", "de", etc.
                if lang not in _SUPPORTED:
                    lang = "en"  # default unsupported languages to English
                return {
                    "language":   lang,
                    "confidence": round(float(top.prob), 3),
                    "method":     "langdetect",
                }
        except Exception:
            pass
        return None

    @staticmethod
    def _heuristic_detect(text: str) -> Dict[str, object]:
        """
        Keyword ratio heuristic.
        French: count French keywords + diacritics
        English: count English markers
        """
        word_count = max(len(text.split()), 1)

        fr_hits = len(_FR_RE.findall(text)) + len(_DIACRITICS_RE.findall(text)) * 2
        en_hits = len(_EN_MARKERS_RE.findall(text))

        fr_score = fr_hits / word_count
        en_score = en_hits / word_count

        if fr_score > en_score and fr_score > 0.03:
            confidence = min(fr_score / max(fr_score + en_score, 0.01), 0.95)
            return {"language": "fr", "confidence": round(confidence, 3), "method": "heuristic"}

        confidence = min(en_score / max(fr_score + en_score, 0.01), 0.95)
        return {"language": "en", "confidence": round(max(confidence, 0.6), 3), "method": "heuristic"}

    @staticmethod
    def _sample(text: str, max_chars: int = 3000) -> str:
        """Use up to max_chars from the start of the text for detection."""
        return text[:max_chars].strip()


# ── Module-level singleton ─────────────────────────────────────────────────────

_detector: LanguageDetector | None = None


def get_language_detector() -> LanguageDetector:
    """Return the shared LanguageDetector singleton (lazy init)."""
    global _detector
    if _detector is None:
        _detector = LanguageDetector()
    return _detector


def detect_language(text: str) -> str:
    """Convenience function: return just the language code ("en" or "fr")."""
    return get_language_detector().detect(text)["language"]
