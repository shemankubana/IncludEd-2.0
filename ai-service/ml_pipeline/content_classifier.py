"""
content_classifier.py
=====================
Heuristic-based ContentClassifier with ML support.
"""

from __future__ import annotations
import re
import os
import joblib
from dataclasses import dataclass, field
from typing import Any, Dict, List

# ── Pattern libraries ──────────────────────────────────────────────────────────
# English play signals
_ACT_RE      = re.compile(r"\bACT\s+([IVX]+|\d+)\b", re.IGNORECASE)
_SCENE_RE    = re.compile(r"\bSCENE\s+([IVX]+|\d+)\b", re.IGNORECASE)
_CUE_RE      = re.compile(r"^[A-Z][A-Z\s'\.]{1,28}[A-Z]\.?\s*$")
_STAGE_RE    = re.compile(r"^[\[(].*[\])]$")
_CAST_RE     = re.compile(r"(DRAMATIS|CAST OF|LIST OF)\s+(PERSONAE|CHARACTERS)", re.IGNORECASE)
_STAGE_VERB  = re.compile(r"\((?:Enter|Exit|Exeunt|Aside|to\s+\w+)[^)]*\)", re.IGNORECASE)

# French play signals
_ACTE_RE        = re.compile(r"\bACTE\s+([IVX]+|\d+)\b", re.IGNORECASE)
_SCENE_FR_RE    = re.compile(r"\bSC[ÈE]NE\s+([IVX]+|\d+)\b", re.IGNORECASE)
_CAST_FR_RE     = re.compile(r"(PERSONNAGES|LISTE DES PERSONNAGES|ACTEURS)", re.IGNORECASE)
_STAGE_FR_VERB  = re.compile(r"\((?:Il entre|Elle entre|Ils entrent|À part|Seul)[^)]*\)", re.IGNORECASE)

# English novel signals
_CHAPTER_RE  = re.compile(r"\b(CHAPTER|PROLOGUE|EPILOGUE|PART)\s+([\dIVX]+|[A-Z][a-z]+)?\b", re.IGNORECASE)
_FIRST_PERS  = re.compile(r"\bI\b(?:'[a-z]+)?\s")
_SAID_RE     = re.compile(r"\b(said|replied|whispered|shouted|murmured|asked)\b")
_PROSE_RE    = re.compile(r"[a-z][a-z\s,;]{60,}[.!?]")

# French novel signals
_CHAPITRE_RE = re.compile(r"\bCHAPITRE\s+([\dIVX]+|[A-Z][a-z]+)?\b", re.IGNORECASE)
_PARTIE_RE   = re.compile(r"\bPARTIE\s+([\dIVX]+|[A-Z][a-z]+)?\b", re.IGNORECASE)
_SAID_FR_RE  = re.compile(r"\b(dit|répondit|murmura|cria|demanda|chuchota)\b")

# Poem signals
_STANZA_GAP_RE  = re.compile(r"\n\s*\n")  # double newlines between stanzas
_RHYME_END_RE   = re.compile(r"[a-z]+[.!?,;]*\s*$", re.IGNORECASE)
_VERSE_LINE_RE  = re.compile(r"^[A-Z][^.!?]{5,60}[,;:]?\s*$")  # Short capitalised lines typical of poetry
_POEM_TITLE_RE  = re.compile(r"\b(POEM|SONNET|ODE|BALLAD|ELEGY|HAIKU|STANZA|VERSE|CANTO)\b", re.IGNORECASE)
_POEM_FR_RE     = re.compile(r"\b(POÈME|SONNET|ODE|BALLADE|ÉLÉGIE|STROPHE|VERS|CHANT)\b", re.IGNORECASE)

_WEIGHTS: Dict[str, Dict[str, float]] = {
    "play": {
        "act_heading":     8.0,
        "scene_heading":   8.0,
        "acte_heading":    8.0,   # French
        "scene_fr_heading":8.0,   # French
        "character_cue":   2.0,
        "stage_direction": 3.0,
        "cast_page":       10.0,
        "cast_fr_page":    10.0,  # French
        "stage_verb":      2.0,
        "stage_fr_verb":   2.0,   # French
    },
    "novel": {
        "chapter_heading": 6.0,
        "chapitre_heading":6.0,   # French
        "partie_heading":  4.0,   # French
        "first_person":    0.3,
        "said_tag":        0.5,
        "said_fr_tag":     0.5,   # French
        "prose_sentence":  0.1,
    },
    "poem": {
        "poem_title":      10.0,
        "poem_fr_title":   10.0,  # French
        "verse_line":      0.3,   # short capitalised lines
        "short_line_ratio": 8.0,  # high ratio of short lines
    },
}

@dataclass
class ClassificationResult:
    type: str              # "play" | "novel" | "poem" | "generic"
    confidence: float
    play_score: float
    novel_score: float
    poem_score: float = 0.0
    ml_probabilities: Dict[str, float] = field(default_factory=dict)
    signals: Dict[str, int] = field(default_factory=dict)

class ContentClassifier:
    MIN_EVIDENCE = 2.0
    MIN_RATIO = 1.2

    def __init__(self):
        self.model = None
        self.vectorizer = None
        self._load_model()

    def _load_model(self):
        try:
            model_dir = os.path.join(os.path.dirname(__file__), "../models")
            model_path = os.path.join(model_dir, "classifier_v1.joblib")
            vec_path = os.path.join(model_dir, "vectorizer_v1.joblib")
            if os.path.exists(model_path):
                self.model = joblib.load(model_path)
                self.vectorizer = joblib.load(vec_path)
        except: pass

    def classify(self, all_blocks: List[Dict[str, Any]]) -> ClassificationResult:
        play_score, novel_score, poem_score = 0.0, 0.0, 0.0
        signals = {k: 0 for sub in _WEIGHTS.values() for k in sub}
        lines = self._extract_lines(all_blocks)
        full_text = " ".join(lines)
        line_count = len(lines)

        for idx, text in enumerate(lines):
            t = text.strip()
            if not t: continue
            is_intro = (idx < line_count * 0.1)

            # ── English play signals ──
            if _ACT_RE.search(t):
                play_score += _WEIGHTS["play"]["act_heading"]
                signals["act_heading"] += 1
            if _SCENE_RE.search(t):
                play_score += _WEIGHTS["play"]["scene_heading"]
                signals["scene_heading"] += 1
            
            # Character cues and stage directions
            if _CUE_RE.match(t) and len(t.split()) <= 5:
                play_score += _WEIGHTS["play"]["character_cue"]
                signals["character_cue"] += 1
            if _STAGE_RE.search(t) or _STAGE_VERB.search(t):
                play_score += _WEIGHTS["play"]["stage_direction"]
                signals["stage_direction"] += 1
            if _CAST_RE.search(t):
                play_score += _WEIGHTS["play"]["cast_page"]
                signals["cast_page"] += 1

            # ── French play signals ──
            if _ACTE_RE.search(t):
                play_score += _WEIGHTS["play"]["acte_heading"]
                signals["acte_heading"] += 1
            if _SCENE_FR_RE.search(t):
                play_score += _WEIGHTS["play"]["scene_fr_heading"]
                signals["scene_fr_heading"] += 1
            if _CAST_FR_RE.search(t):
                play_score += _WEIGHTS["play"]["cast_fr_page"]
                signals["cast_fr_page"] += 1
            if _STAGE_FR_VERB.search(t):
                play_score += _WEIGHTS["play"]["stage_fr_verb"]
                signals["stage_fr_verb"] += 1

            # ── English novel signals ──
            if _CHAPTER_RE.search(t):
                novel_score += _WEIGHTS["novel"]["chapter_heading"]
                signals["chapter_heading"] += 1

            # ── French novel signals ──
            if _CHAPITRE_RE.search(t):
                novel_score += _WEIGHTS["novel"]["chapitre_heading"]
                signals["chapitre_heading"] += 1
            if _PARTIE_RE.search(t):
                novel_score += _WEIGHTS["novel"]["partie_heading"]
                signals["partie_heading"] += 1

            p_mult = 0.2 if is_intro else 1.0
            fp = len(_FIRST_PERS.findall(t))
            if fp:
                novel_score += fp * _WEIGHTS["novel"]["first_person"] * p_mult
                signals["first_person"] += fp
            if _SAID_RE.search(t):
                novel_score += _WEIGHTS["novel"]["said_tag"] * p_mult
                signals["said_tag"] += 1
            if _SAID_FR_RE.search(t):
                novel_score += _WEIGHTS["novel"]["said_fr_tag"] * p_mult
                signals["said_fr_tag"] += 1
            if _PROSE_RE.search(t):
                novel_score += _WEIGHTS["novel"]["prose_sentence"] * p_mult
                signals["prose_sentence"] += 1

            # ── Poem signals ──
            if _POEM_TITLE_RE.search(t):
                poem_score += _WEIGHTS["poem"]["poem_title"]
                signals["poem_title"] += 1
            if _POEM_FR_RE.search(t):
                poem_score += _WEIGHTS["poem"]["poem_fr_title"]
                signals["poem_fr_title"] += 1
            if _VERSE_LINE_RE.match(t) and len(t.split()) <= 12:
                poem_score += _WEIGHTS["poem"]["verse_line"]
                signals["verse_line"] += 1

        # Poem: high ratio of short lines (< 60 chars) is a strong signal
        if line_count > 5:
            short_lines = sum(1 for l in lines if len(l.strip()) < 60 and len(l.strip()) > 3)
            short_ratio = short_lines / line_count
            if short_ratio > 0.7:
                poem_score += _WEIGHTS["poem"]["short_line_ratio"]
                signals["short_line_ratio"] = int(short_ratio * 100)

        # Check heuristic evidence BEFORE ML boost — sparse docs stay generic
        heuristic_total = play_score + novel_score + poem_score

        ml_probs = {"play": 0.0, "novel": 0.0, "poem": 0.0, "generic": 0.0}
        if self.model and self.vectorizer and full_text:
            try:
                vec = self.vectorizer.transform([full_text])
                probs = self.model.predict_proba(vec)[0]
                ml_probs = dict(zip(self.model.classes_, probs))
                play_score  += ml_probs.get("play",  0.0) * 10.0
                novel_score += ml_probs.get("novel", 0.0) * 10.0
            except: pass

        # STRICT OVERRIDE FOR PLAYS (English OR French)
        en_play = (signals["act_heading"] >= 1 and signals["scene_heading"] >= 1) or signals["act_heading"] >= 3
        fr_play = (signals["acte_heading"] >= 1 and signals["scene_fr_heading"] >= 1) or signals["acte_heading"] >= 3
        if en_play or fr_play:
            return ClassificationResult("play", 0.95, play_score, novel_score, poem_score, ml_probs, signals)

        # STRICT OVERRIDE FOR POEMS
        if signals.get("poem_title", 0) >= 1 or (poem_score > play_score and poem_score > novel_score and poem_score >= self.MIN_EVIDENCE):
            total = play_score + novel_score + poem_score
            conf = round(poem_score / max(total, 1), 3) if total > 0 else 0.8
            return ClassificationResult("poem", max(conf, 0.7), play_score, novel_score, poem_score, ml_probs, signals)

        total = play_score + novel_score + poem_score
        if heuristic_total < self.MIN_EVIDENCE:
            return ClassificationResult("generic", 0.5, play_score, novel_score, poem_score, ml_probs, signals)

        scores = {"play": play_score, "novel": novel_score, "poem": poem_score}
        doc_type = max(scores, key=scores.get)
        conf = round(scores[doc_type] / total, 3)
        return ClassificationResult(doc_type, conf, play_score, novel_score, poem_score, ml_probs, signals)

    def _extract_lines(self, blocks: List[Dict[str, Any]]) -> List[str]:
        lines = []
        for b in blocks:
            if b.get("type") != 0: continue
            for l in b.get("lines", []):
                txt = "".join([s.get("text", "") for s in l.get("spans", [])]).strip()
                if txt: lines.append(txt)
        return lines
