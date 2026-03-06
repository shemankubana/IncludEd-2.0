"""
emotion_analyzer.py
===================
ML-powered emotion detection for literary dialogue lines.

Architecture (3-tier fallback):
  Tier 1 — HuggingFace DistilRoBERTa  (j-hartmann/emotion-english-distilroberta-base)
           7-class: anger, disgust, fear, joy, neutral, sadness, surprise
           ~70MB download on first use; cached at ~/.cache/huggingface/

  Tier 2 — NRC Emotion Lexicon (rule-based, zero dependencies, instant)
           Covers EN + FR keyword patterns

  Tier 3 — Heuristic punctuation/text-length rules (always available)

Output per line:
  {
    "emotion":     str,          # anger | disgust | fear | joy | neutral | sadness | surprise
    "intensity":   float,        # 0.0 – 1.0 (confidence)
    "anim": {
        "expression": str,       # happy | sad | angry | scared | surprised | disgusted | neutral
        "eyebrows":   str,       # raised | furrowed | drooped | neutral
        "mouth":      str,       # smile | frown | open | tight | closed
        "eyes":       str,       # wide | narrowed | downcast | bright | normal
        "color_tint": str,       # CSS colour hint for avatar background
    }
  }
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

# ── Animation mapping ──────────────────────────────────────────────────────────

EMOTION_TO_ANIM: Dict[str, Dict[str, str]] = {
    "anger":    {"expression": "angry",    "eyebrows": "furrowed", "mouth": "tight",  "eyes": "narrowed",  "color_tint": "#fee2e2"},
    "disgust":  {"expression": "disgusted","eyebrows": "furrowed", "mouth": "curled", "eyes": "squinted",  "color_tint": "#d1fae5"},
    "fear":     {"expression": "scared",   "eyebrows": "raised",   "mouth": "open",   "eyes": "wide",      "color_tint": "#fef9c3"},
    "joy":      {"expression": "happy",    "eyebrows": "raised",   "mouth": "smile",  "eyes": "bright",    "color_tint": "#fef08a"},
    "neutral":  {"expression": "neutral",  "eyebrows": "neutral",  "mouth": "closed", "eyes": "normal",    "color_tint": "#f1f5f9"},
    "sadness":  {"expression": "sad",      "eyebrows": "drooped",  "mouth": "frown",  "eyes": "downcast",  "color_tint": "#dbeafe"},
    "surprise": {"expression": "surprised","eyebrows": "raised",   "mouth": "open",   "eyes": "wide",      "color_tint": "#ede9fe"},
}

_NEUTRAL_ANIM = EMOTION_TO_ANIM["neutral"]

# ── NRC-inspired English keyword lexicon ──────────────────────────────────────

_EN_LEXICON: Dict[str, List[str]] = {
    "anger": [
        "hate", "rage", "fury", "angry", "anger", "furious", "wrathful", "wrath",
        "enraged", "infuriated", "livid", "outraged", "resentful", "hostile",
        "bitter", "loathe", "despise", "curse", "damn", "kill", "murder",
        "villain", "treachery", "betrayed", "vengeance", "revenge", "scoundrel",
    ],
    "disgust": [
        "disgusting", "revolting", "vile", "filth", "filthy", "foul", "repulsive",
        "nauseating", "abhor", "abominable", "sickening", "loathsome", "corrupt",
        "depraved", "wretched", "horrid", "gross", "repugnant",
    ],
    "fear": [
        "fear", "afraid", "scared", "terrified", "terror", "fright", "frightened",
        "dread", "horror", "panic", "anxious", "anxiously", "trembling", "tremble",
        "shudder", "shiver", "ghost", "death", "die", "danger", "peril", "doom",
        "threat", "beware", "flee", "escape", "ominous", "foreboding", "curse",
        "sinister", "dark", "shadow", "lurk", "haunted", "specter",
    ],
    "joy": [
        "joy", "happy", "happiness", "delight", "delighted", "love", "loved",
        "wonderful", "magnificent", "beautiful", "blessed", "bliss", "ecstasy",
        "thrill", "jubilant", "merry", "cheerful", "laugh", "smile", "celebrate",
        "triumph", "victory", "glory", "rejoice", "paradise", "sweet", "treasure",
        "darling", "beloved", "adore",
    ],
    "sadness": [
        "sad", "sorrow", "grief", "mourn", "lament", "weep", "cry", "tears",
        "sob", "despair", "misery", "miserable", "unfortunate", "tragedy",
        "tragedy", "lost", "gone", "departed", "death", "dead", "die",
        "alone", "lonely", "forsaken", "abandoned", "heartbroken", "woeful",
        "melancholy", "gloomy", "dark", "hopeless", "suffer", "pain",
    ],
    "surprise": [
        "surprise", "surprised", "astonished", "astonishment", "amazed",
        "astounded", "wonder", "incredible", "unbelievable", "strange",
        "extraordinary", "unexpected", "sudden", "miracle", "marvel", "behold",
        "what", "how", "why", "impossible", "alas", "forsooth",
    ],
}

# French lexicon (subset)
_FR_LEXICON: Dict[str, List[str]] = {
    "anger": [
        "haine", "colère", "furieux", "rage", "enragé", "courroux", "maudit",
        "maudite", "traître", "traîtresse", "vengeance", "tuer", "mort",
    ],
    "fear": [
        "peur", "crainte", "terrifié", "terreur", "effroi", "tremblement",
        "trembler", "danger", "péril", "fuite", "sinistre", "ombre",
    ],
    "joy": [
        "joie", "bonheur", "amour", "aimé", "ravi", "délice", "merveilleux",
        "célébrer", "triomphe", "gloire", "sourire", "rire",
    ],
    "sadness": [
        "tristesse", "chagrin", "pleurer", "larmes", "douleur", "désespoir",
        "malheur", "seul", "abandonné", "perdu", "mort",
    ],
    "surprise": [
        "surprise", "étonné", "stupéfait", "incroyable", "merveille", "miracle",
        "inattendu", "soudain", "quoi", "comment", "impossible",
    ],
    "disgust": [
        "dégoût", "répugnant", "horrible", "infâme", "abominable", "vil",
    ],
}

# Punctuation/style heuristics
_EXCLAMATION_RE = re.compile(r"!{1,}")
_QUESTION_RE    = re.compile(r"\?{1,}")
_ELLIPSIS_RE    = re.compile(r"\.{3,}|—")
_CAPS_WORDS_RE  = re.compile(r"\b[A-Z]{3,}\b")


# ── EmotionAnalyzer class ──────────────────────────────────────────────────────

class EmotionAnalyzer:
    """
    Emotion detection for literary dialogue.

    Usage
    -----
    >>> ea = EmotionAnalyzer()
    >>> result = ea.analyze("I hate thee most infinitely!")
    >>> result
    {"emotion": "anger", "intensity": 0.87, "anim": {...}}

    >>> batch = ea.analyze_batch(["I love thee!", "Alas, I am undone."])
    """

    EMOTIONS = list(EMOTION_TO_ANIM.keys())

    def __init__(self, use_ml: bool = True):
        """
        Parameters
        ----------
        use_ml:
            If True, attempt to load the HuggingFace DistilRoBERTa model.
            Set to False to force the rule-based path (faster, no download).
        """
        self._pipeline = None
        self._ml_ready = False
        if use_ml:
            self._load_ml_model()

    # ── Model loading ──────────────────────────────────────────────────────────

    def _load_ml_model(self):
        try:
            from transformers import pipeline as hf_pipeline
            print("🧠 EmotionAnalyzer: loading DistilRoBERTa emotion model…")
            self._pipeline = hf_pipeline(
                task            = "text-classification",
                model           = "j-hartmann/emotion-english-distilroberta-base",
                top_k           = None,   # return all class scores
                truncation      = True,
                max_length      = 512,
            )
            self._ml_ready = True
            print("✅ EmotionAnalyzer: ML model ready.")
        except Exception as e:
            print(f"⚠️  EmotionAnalyzer: ML model unavailable ({e}). Using lexicon fallback.")
            self._ml_ready = False

    # ── Public API ─────────────────────────────────────────────────────────────

    def analyze(self, text: str, language: str = "en") -> Dict[str, Any]:
        """
        Analyse a single dialogue line.

        Returns
        -------
        {
            "emotion":   str,   # e.g. "anger"
            "intensity": float, # 0.0 – 1.0
            "anim":      dict,  # animation properties
        }
        """
        if not text or not text.strip():
            return self._build_result("neutral", 0.5)

        # Tier 1: ML model
        if self._ml_ready and self._pipeline and language == "en":
            try:
                raw: List[Dict] = self._pipeline(text[:512])[0]  # top_k=None → list of dicts
                best = max(raw, key=lambda d: d["score"])
                emotion = self._normalise_label(best["label"])
                intensity = round(float(best["score"]), 3)
                return self._build_result(emotion, intensity)
            except Exception as e:
                print(f"⚠️  EmotionAnalyzer ML inference failed: {e}")

        # Tier 2: NRC lexicon
        return self._lexicon_fallback(text, language)

    def analyze_batch(
        self,
        texts: List[str],
        language: str = "en",
    ) -> List[Dict[str, Any]]:
        """
        Analyse multiple dialogue lines efficiently.

        Uses batch inference for the ML model where possible.
        """
        if not texts:
            return []

        # ML batch inference
        if self._ml_ready and self._pipeline and language == "en":
            try:
                truncated = [t[:512] for t in texts]
                batch_raw = self._pipeline(truncated)  # list of list of dicts
                results = []
                for item_scores in batch_raw:
                    best = max(item_scores, key=lambda d: d["score"])
                    emotion = self._normalise_label(best["label"])
                    results.append(self._build_result(emotion, round(float(best["score"]), 3)))
                return results
            except Exception as e:
                print(f"⚠️  EmotionAnalyzer batch ML failed: {e}")

        # Fallback: individual lexicon analysis
        return [self._lexicon_fallback(t, language) for t in texts]

    def enrich_dialogue_blocks(
        self,
        blocks: List[Dict[str, Any]],
        language: str = "en",
    ) -> List[Dict[str, Any]]:
        """
        Add emotion data to a list of play dialogue block dicts.

        Operates in-place AND returns the blocks list.

        Expected block format (from StructuralSegmenter):
          {"type": "dialogue", "character": "ROMEO", "content": "..."}

        After enrichment:
          {"type": "dialogue", "character": "ROMEO", "content": "...",
           "emotion": "sadness", "intensity": 0.82, "anim": {...}}
        """
        dialogue_texts = []
        dialogue_indices = []

        for i, block in enumerate(blocks):
            if block.get("type") == "dialogue" and block.get("content"):
                dialogue_texts.append(block["content"])
                dialogue_indices.append(i)

        if not dialogue_texts:
            return blocks

        emotions = self.analyze_batch(dialogue_texts, language)

        for idx, emotion_data in zip(dialogue_indices, emotions):
            blocks[idx]["emotion"]    = emotion_data["emotion"]
            blocks[idx]["intensity"]  = emotion_data["intensity"]
            blocks[idx]["anim"]       = emotion_data["anim"]

        return blocks

    # ── Lexicon fallback ──────────────────────────────────────────────────────

    def _lexicon_fallback(self, text: str, language: str = "en") -> Dict[str, Any]:
        """NRC-inspired keyword scoring with punctuation heuristics."""
        text_lower = text.lower()
        lexicon = _EN_LEXICON if language == "en" else _FR_LEXICON

        scores: Dict[str, float] = {e: 0.0 for e in self.EMOTIONS}

        # Keyword scoring
        for emotion, keywords in lexicon.items():
            for kw in keywords:
                if kw in text_lower:
                    scores[emotion] += 1.0

        # Punctuation heuristics
        excl_count = len(_EXCLAMATION_RE.findall(text))
        ques_count = len(_QUESTION_RE.findall(text))
        caps_count = len(_CAPS_WORDS_RE.findall(text))
        ellipsis   = bool(_ELLIPSIS_RE.search(text))

        if excl_count >= 2 or caps_count >= 2:
            # Heightened emotion — boost top candidate or anger/joy
            scores["anger"]   += 0.5
            scores["joy"]     += 0.3
            scores["surprise"] += 0.5

        if ques_count >= 1:
            scores["surprise"] += 0.4
            scores["fear"]     += 0.2

        if ellipsis:
            scores["sadness"]  += 0.4
            scores["fear"]     += 0.2

        # Pick winner
        best_emotion = max(scores, key=lambda e: scores[e])
        total = sum(scores.values()) or 1.0
        confidence = round(min(scores[best_emotion] / max(total, 1.0), 1.0), 3)

        # Neutral if no evidence
        if scores[best_emotion] < 0.5:
            return self._build_result("neutral", 0.5)

        return self._build_result(best_emotion, max(confidence, 0.5))

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _normalise_label(label: str) -> str:
        """Normalise HuggingFace emotion labels to our 7-class set."""
        label = label.lower().strip()
        mapping = {
            "anger":    "anger",
            "disgust":  "disgust",
            "fear":     "fear",
            "joy":      "joy",
            "neutral":  "neutral",
            "sadness":  "sadness",
            "surprise": "surprise",
        }
        return mapping.get(label, "neutral")

    @staticmethod
    def _build_result(emotion: str, intensity: float) -> Dict[str, Any]:
        anim = dict(EMOTION_TO_ANIM.get(emotion, _NEUTRAL_ANIM))
        return {
            "emotion":   emotion,
            "intensity": intensity,
            "anim":      anim,
        }

    def analyze_poem_stanzas(
        self,
        poem_text: str,
        language: str = "en",
    ) -> List[Dict[str, Any]]:
        """
        Analyse a full poem, splitting it into stanzas and detecting:
          - emotion + intensity per stanza
          - rhyme scheme (ABAB, AABB, etc.)
          - end words for rhyme highlighting

        Returns list of stanza dicts:
          [{
            "stanza_index": int,
            "lines": [str],
            "emotion": str,
            "intensity": float,
            "anim": dict,
            "rhyme_scheme": str,  # e.g. "ABAB" or "AABB"
            "end_words": [str],
            "color_tint": str,   # CSS colour for stanza background
          }]
        """
        stanzas = self._split_into_stanzas(poem_text)
        results = []

        for i, stanza_lines in enumerate(stanzas):
            stanza_text = " ".join(stanza_lines)
            emotion_data = self.analyze(stanza_text, language)

            end_words = [self._last_word(line) for line in stanza_lines]
            rhyme_scheme = self._detect_rhyme_scheme(end_words)

            results.append({
                "stanza_index": i,
                "lines": stanza_lines,
                "emotion": emotion_data["emotion"],
                "intensity": emotion_data["intensity"],
                "anim": emotion_data["anim"],
                "rhyme_scheme": rhyme_scheme,
                "end_words": end_words,
                "color_tint": emotion_data["anim"]["color_tint"],
            })

        return results

    def _split_into_stanzas(self, text: str) -> List[List[str]]:
        """Split poem text into stanzas (separated by blank lines)."""
        raw_stanzas = re.split(r"\n\s*\n", text.strip())
        result = []
        for raw in raw_stanzas:
            lines = [ln.strip() for ln in raw.strip().splitlines() if ln.strip()]
            if lines:
                result.append(lines)
        return result

    @staticmethod
    def _last_word(line: str) -> str:
        """Extract the last alphabetic word from a line (for rhyme detection)."""
        words = re.findall(r"[a-zA-Z']+", line)
        return words[-1].lower().rstrip("'s") if words else ""

    @staticmethod
    def _detect_rhyme_scheme(end_words: List[str]) -> str:
        """
        Detect rhyme scheme (simplified: checks last 2 chars of end words).
        Returns label like "ABAB", "AABB", "ABCABC", or "free verse".
        """
        if len(end_words) < 2:
            return "free verse"

        # Map end-word suffixes to letters
        suffix_map: Dict[str, str] = {}
        scheme: List[str] = []
        next_letter = ord("A")

        for word in end_words:
            suffix = word[-2:] if len(word) >= 2 else word
            if suffix not in suffix_map:
                suffix_map[suffix] = chr(next_letter)
                next_letter += 1
                if next_letter > ord("Z"):
                    next_letter = ord("A")
            scheme.append(suffix_map[suffix])

        pattern = "".join(scheme)

        # Classify common patterns
        if len(scheme) >= 4:
            if pattern[:4] in ("ABAB", "CDCD", "EFEF"):
                return "ABAB"
            if pattern[:4] in ("AABB", "CCDD", "EEFF"):
                return "AABB"
            if pattern[:4] in ("ABBA", "CDDC"):
                return "ABBA"

        if len(set(scheme)) == 1:
            return "monorhyme"

        if len(set(scheme)) >= len(scheme) * 0.8:
            return "free verse"

        return pattern[:8]

    @property
    def ml_ready(self) -> bool:
        return self._ml_ready


# ── Module-level singleton ─────────────────────────────────────────────────────

_analyzer: Optional[EmotionAnalyzer] = None


def get_emotion_analyzer() -> EmotionAnalyzer:
    """Return the shared EmotionAnalyzer singleton (lazy init)."""
    global _analyzer
    if _analyzer is None:
        _analyzer = EmotionAnalyzer(use_ml=True)
    return _analyzer
