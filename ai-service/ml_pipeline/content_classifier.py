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
# Permissive regex for text-only headers
_ACT_RE      = re.compile(r"\bACT\s+([IVX]+|\d+)\b", re.IGNORECASE)
_SCENE_RE    = re.compile(r"\bSCENE\s+([IVX]+|\d+)\b", re.IGNORECASE)
_CUE_RE      = re.compile(r"^[A-Z][A-Z\s'\.]{1,28}[A-Z]\.?\s*$")
_STAGE_RE    = re.compile(r"^[\[(].*[\])]$")
_CAST_RE     = re.compile(r"(DRAMATIS|CAST OF|LIST OF)\s+(PERSONAE|CHARACTERS)", re.IGNORECASE)
_STAGE_VERB  = re.compile(r"\((?:Enter|Exit|Exeunt|Aside|to\s+\w+)[^)]*\)", re.IGNORECASE)

_CHAPTER_RE  = re.compile(r"\b(CHAPTER|PROLOGUE|EPILOGUE|PART)\s+([\dIVX]+|[A-Z][a-z]+)?\b", re.IGNORECASE)
_FIRST_PERS  = re.compile(r"\bI\b(?:'[a-z]+)?\s")
_SAID_RE     = re.compile(r"\b(said|replied|whispered|shouted|murmured|asked)\b")
_PROSE_RE    = re.compile(r"[a-z][a-z\s,;]{60,}[.!?]")

_WEIGHTS: Dict[str, Dict[str, float]] = {
    "play": {
        "act_heading":    8.0,
        "scene_heading":  8.0,
        "character_cue":  2.0,
        "stage_direction":3.0,
        "cast_page":      10.0,
        "stage_verb":     2.0,
    },
    "novel": {
        "chapter_heading": 6.0,
        "first_person":    0.3,
        "said_tag":        0.5,
        "prose_sentence":  0.1,
    },
}

@dataclass
class ClassificationResult:
    type: str
    confidence: float
    play_score: float
    novel_score: float
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
        play_score, novel_score = 0.0, 0.0
        signals = {k: 0 for sub in _WEIGHTS.values() for k in sub}
        lines = self._extract_lines(all_blocks)
        full_text = " ".join(lines)
        line_count = len(lines)

        for idx, text in enumerate(lines):
            t = text.strip()
            if not t: continue
            is_intro = (idx < line_count * 0.1)

            # Use .search() to find ACT/SCENE even if smushed in TOC
            if _ACT_RE.search(t):
                play_score += _WEIGHTS["play"]["act_heading"]
                signals["act_heading"] += 1
            if _SCENE_RE.search(t):
                play_score += _WEIGHTS["play"]["scene_heading"]
                signals["scene_heading"] += 1
            if _CUE_RE.match(t) and len(t.split()) <= 5:
                play_score += _WEIGHTS["play"]["character_cue"]
                signals["character_cue"] += 1
            if _STAGE_RE.search(t) or _STAGE_VERB.search(t): # Permissive stage search
                play_score += _WEIGHTS["play"]["stage_direction"]
                signals["stage_direction"] += 1
            if _CAST_RE.search(t):
                play_score += _WEIGHTS["play"]["cast_page"]
                signals["cast_page"] += 1

            if _CHAPTER_RE.search(t):
                novel_score += _WEIGHTS["novel"]["chapter_heading"]
                signals["chapter_heading"] += 1
            
            p_mult = 0.2 if is_intro else 1.0
            fp = len(_FIRST_PERS.findall(t))
            if fp:
                novel_score += fp * _WEIGHTS["novel"]["first_person"] * p_mult
                signals["first_person"] += fp
            if _SAID_RE.search(t):
                novel_score += _WEIGHTS["novel"]["said_tag"] * p_mult
                signals["said_tag"] += 1
            if _PROSE_RE.search(t):
                novel_score += _WEIGHTS["novel"]["prose_sentence"] * p_mult
                signals["prose_sentence"] += 1

        ml_probs = {"play": 0.0, "novel": 0.0}
        if self.model and self.vectorizer and full_text:
            try:
                vec = self.vectorizer.transform([full_text])
                probs = self.model.predict_proba(vec)[0]
                ml_probs = dict(zip(self.model.classes_, probs))
                play_score += ml_probs.get("play", 0.0) * 10.0
                novel_score += ml_probs.get("novel", 0.0) * 10.0
            except: pass

        # STRICT OVERRIDE FOR PLAYS
        # If we see multiple Acts OR a mix of Act/Scene, it's a play.
        if (signals["act_heading"] >= 1 and signals["scene_heading"] >= 1) or signals["act_heading"] >= 3:
            return ClassificationResult("play", 0.95, play_score, novel_score, ml_probs, signals)

        total = play_score + novel_score
        if total < self.MIN_EVIDENCE:
            return ClassificationResult("generic", 0.5, play_score, novel_score, ml_probs, signals)

        doc_type = "play" if play_score > novel_score else "novel"
        conf = round(max(play_score, novel_score) / total, 3)
        return ClassificationResult(doc_type, conf, play_score, novel_score, ml_probs, signals)

    def _extract_lines(self, blocks: List[Dict[str, Any]]) -> List[str]:
        lines = []
        for b in blocks:
            if b.get("type") != 0: continue
            for l in b.get("lines", []):
                txt = "".join([s.get("text", "") for s in l.get("spans", [])]).strip()
                if txt: lines.append(txt)
        return lines
