"""
structural_segmenter.py
=======================
Permissive segmenter for plays and novels. Handles smushed lines.

Enhancements over v1:
  - Emotion tagging on dialogue blocks (lazily loaded EmotionAnalyzer)
  - Better character cue parsing (handles "ROMEO.", "LADY MACBETH", "FIRST WITCH")
  - French play/novel headings (ACTE, SCÈNE, CHAPITRE, PARTIE)
  - Stage direction parsing improved (handles both () and [])
  - Novel paragraph grouping: consecutive lines merged into paragraphs
  - language parameter propagated through for multilingual emotion analysis
"""

from __future__ import annotations

import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

# ── Helpers ───────────────────────────────────────────────────────────────────

def _uid() -> str:
    return str(uuid.uuid4())[:8]


# ── Heading regexes ───────────────────────────────────────────────────────────

# English play headings
_ACT_RE      = re.compile(r"\bACT\s+([IVX]+|\d+)\b", re.IGNORECASE)
_SCENE_RE    = re.compile(r"\bSCENE\s+([IVX]+|\d+)\b", re.IGNORECASE)
# Abbreviated scene (e.g. Folger Shakespeare "SC. 2")
_SCENE_SC_RE = re.compile(r"\bSC\.\s*(\d+|[IVX]+)\b", re.IGNORECASE)

# French play headings
_ACTE_RE     = re.compile(r"\bACTE\s+([IVX]+|\d+)\b", re.IGNORECASE)
_SCENE_FR_RE = re.compile(r"\bSC[ÈE]NE\s+([IVX]+|\d+)\b", re.IGNORECASE)

# Running-header detector: lines starting with a page number followed by text
# (e.g. "9 MACBETH ACT 1. SC. 2 DUNCAN MALCOLM...") — must NOT be treated as headings
_RUNNING_HEADER_RE = re.compile(r"^\d{1,4}\s+\S")

# English novel headings
_CHAPTER_RE  = re.compile(
    r"\b(CHAPTER|PROLOGUE|EPILOGUE|PART|BOOK)\s+([\dIVX]+|[A-Z][a-z]+)?\b",
    re.IGNORECASE,
)

# French novel headings
_CHAPITRE_RE = re.compile(r"\bCHAPITRE\s+([\dIVX]+|[A-Z][a-z]+)?\b", re.IGNORECASE)
_PARTIE_RE   = re.compile(r"\bPARTIE\s+([\dIVX]+|[A-Z][a-z]+)?\b", re.IGNORECASE)
_LIVRE_RE    = re.compile(r"\bLIVRE\s+([\dIVX]+|[A-Z][a-z]+)?\b", re.IGNORECASE)

# Character cue: ALL CAPS line (1–5 words), optional period/colon, <30 chars total
# Handles: "ROMEO", "LADY MACBETH", "FIRST WITCH.", "THE GHOST:"
_CUE_RE = re.compile(
    r"^[A-Z][A-Z\s'\.]{0,28}[A-Z]\.?\:?\s*$"
)

# Stage directions
_STAGE_INLINE_RE = re.compile(r"^\[.*\]$|^\(.*\)$")

# Default neutral animation block
_NEUTRAL_ANIM = {
    "expression": "neutral",
    "eyebrows":   "neutral",
    "mouth":      "closed",
    "eyes":       "normal",
    "color_tint": "#f1f5f9",
}


# ── Segmenter ─────────────────────────────────────────────────────────────────

class StructuralSegmenter:
    """
    Converts a flat list of PyMuPDF block dicts into a hierarchical structure:
      - Plays:  [Act → [Scene → [blocks]]]
      - Novels: [Chapter → [Section → paragraphs]]

    After segmentation, dialogue blocks in plays can be optionally enriched
    with emotion data via the EmotionAnalyzer singleton.
    """

    # ── Public API ─────────────────────────────────────────────────────────────

    def segment(
        self,
        all_blocks: List[Dict[str, Any]],
        doc_type: str,
        language: str = "en",
        add_emotions: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Segment blocks into hierarchical units.

        Parameters
        ----------
        all_blocks:   List of PyMuPDF block dicts.
        doc_type:     "play" | "novel" | "generic"
        language:     "en" | "fr"
        add_emotions: If True, run EmotionAnalyzer on dialogue blocks (plays only).
        """
        tokens = self._tokenise(all_blocks, doc_type)

        if doc_type == "play":
            units = self._build_play_hierarchy(tokens)
            if add_emotions:
                self._enrich_play_emotions(units, language)
            return units

        return self._build_novel_hierarchy(tokens)

    # ── Tokenisation ──────────────────────────────────────────────────────────

    def _tokenise(
        self, blocks: List[Dict[str, Any]], doc_type: str
    ) -> List[Dict[str, Any]]:
        tokens: List[Dict[str, Any]] = []

        for b in blocks:
            if b.get("type") != 0:
                continue
            for line_obj in b.get("lines", []):
                txt = "".join(
                    s.get("text", "") for s in line_obj.get("spans", [])
                ).strip()
                if not txt:
                    continue

                level, matched = self._match_heading(txt, doc_type)
                if matched:
                    tokens.append({
                        "type":     "heading",
                        "level":    level,
                        "title":    txt,
                        "inferred": False,
                    })
                else:
                    tokens.append({"type": "content", "text": txt})

        return tokens

    def _match_heading(self, text: str, doc_type: str) -> Tuple[str, bool]:
        """Check first 30 chars for heading patterns."""
        # Skip running headers (page-number-prefixed lines like "9 MACBETH ACT 1. SC. 2 DUNCAN...")
        if _RUNNING_HEADER_RE.match(text.strip()):
            return "none", False
        t = text[:30]
        if doc_type == "play":
            if _ACT_RE.search(t):      return "act",   True
            if _ACTE_RE.search(t):     return "act",   True
            if _SCENE_RE.search(t):    return "scene", True
            if _SCENE_SC_RE.search(t): return "scene", True
            if _SCENE_FR_RE.search(t): return "scene", True
        else:
            if _CHAPTER_RE.search(t):  return "chapter", True
            if _CHAPITRE_RE.search(t): return "chapter", True
            if _PARTIE_RE.search(t):   return "chapter", True
            if _LIVRE_RE.search(t):    return "chapter", True
        return "none", False

    # ── Play hierarchy ─────────────────────────────────────────────────────────

    def _build_play_hierarchy(
        self, tokens: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        acts: List[Dict[str, Any]] = []
        cur_act:   Optional[Dict] = None
        cur_scene: Optional[Dict] = None
        content_buffer: List[str] = []

        def flush():
            if cur_scene is not None and content_buffer:
                cur_scene["blocks"].extend(
                    self._parse_play_content(content_buffer)
                )
                content_buffer.clear()

        for tok in tokens:
            if tok["type"] == "heading":
                if tok["level"] == "act":
                    flush()
                    if cur_act and cur_scene:
                        cur_act["children"].append(cur_scene)
                    if cur_act:
                        acts.append(cur_act)
                    cur_act   = {"id": _uid(), "title": tok["title"], "children": []}
                    cur_scene = None

                elif tok["level"] == "scene":
                    flush()
                    if cur_act and cur_scene:
                        cur_act["children"].append(cur_scene)
                    if cur_act is None:
                        cur_act = {"id": _uid(), "title": "ACT I", "children": []}
                    cur_scene = {"id": _uid(), "title": tok["title"], "blocks": []}

            else:  # content token
                if cur_act is None:
                    continue
                if cur_scene is None:
                    cur_scene = {
                        "id": _uid(), "title": "Scene 1", "blocks": [],
                        "inferred": True,
                    }
                content_buffer.append(tok["text"])

        # Flush final scene/act
        flush()
        if cur_act and cur_scene:
            cur_act["children"].append(cur_scene)
        if cur_act:
            acts.append(cur_act)

        return acts if acts else self._play_fallback(tokens)

    def _parse_play_content(self, lines: List[str]) -> List[Dict[str, Any]]:
        """
        Convert flat text lines into structured block dicts.

        Block types:
          "dialogue"        – character speech
          "stage_direction" – [Enter Juliet] or (aside)
          "narrative"       – other text
        """
        blocks: List[Dict[str, Any]] = []

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Skip running headers: page-number-prefixed lines
            # (e.g. "15 Macbeth ACT 1. SC. 3 SECOND WITCH FIRST WITCH...")
            if re.match(r"^\d{1,4}\s+\S", stripped):
                continue

            # Stage direction: entire line wrapped in () or []
            if _STAGE_INLINE_RE.match(stripped):
                blocks.append({
                    "type":    "stage_direction",
                    "content": stripped.strip("[]()").strip(),
                })
                continue

            # Character cue (ALL CAPS, ≤6 words, short line)
            word_count = len(stripped.split())
            if _CUE_RE.match(stripped) and word_count <= 6:
                cue = stripped.rstrip(":. \t")
                blocks.append({
                    "type":      "dialogue",
                    "character": cue,
                    "content":   "",
                    "emotion":   "neutral",
                    "intensity": 0.5,
                    "anim":      dict(_NEUTRAL_ANIM),
                })
                continue

            # Append to last dialogue block if mid-speech
            if blocks and blocks[-1]["type"] == "dialogue":
                # Skip bare page numbers (e.g. "5", "12") slipping into speech
                if re.match(r"^\d{1,4}$", stripped):
                    continue
                sep = " " if blocks[-1]["content"] else ""
                blocks[-1]["content"] += sep + stripped
                continue

            # Narrative line
            blocks.append({"type": "narrative", "content": stripped})

        return blocks

    def _play_fallback(self, tokens: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Single-unit fallback when no act/scene headings found."""
        text_lines = [t["text"] for t in tokens if t["type"] == "content"]
        return [{
            "id":    _uid(),
            "title": "The Play",
            "children": [{
                "id":     _uid(),
                "title":  "Content",
                "blocks": self._parse_play_content(text_lines),
            }],
        }]

    # ── Novel hierarchy ────────────────────────────────────────────────────────

    def _build_novel_hierarchy(
        self, tokens: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        chapters: List[Dict[str, Any]] = []

        def new_chapter(title: str) -> Dict[str, Any]:
            return {
                "id": _uid(),
                "title": title,
                "children": [{
                    "id": _uid(),
                    "title": "",
                    "paragraphs": [],
                    "content": "",
                }],
            }

        cur = new_chapter("Beginning")

        for tok in tokens:
            if tok["type"] == "heading" and tok["level"] == "chapter":
                if cur["children"][0]["paragraphs"]:
                    self._finalize_chapter(cur)
                    chapters.append(cur)
                cur = new_chapter(tok["title"])
            elif tok["type"] == "content":
                cur["children"][0]["paragraphs"].append(tok["text"])

        if cur["children"][0]["paragraphs"]:
            self._finalize_chapter(cur)
            chapters.append(cur)

        return chapters

    @staticmethod
    def _finalize_chapter(chapter: Dict[str, Any]):
        """Merge paragraph list into a single content string."""
        for section in chapter["children"]:
            section["content"] = "\n\n".join(section.get("paragraphs", []))

    # ── Emotion enrichment ────────────────────────────────────────────────────

    def _enrich_play_emotions(
        self, acts: List[Dict[str, Any]], language: str = "en"
    ):
        """
        Walk Act → Scene → Block tree and add emotion data to all dialogue blocks.
        """
        try:
            from .emotion_analyzer import get_emotion_analyzer
            ea = get_emotion_analyzer()
        except Exception as e:
            print(f"⚠️  StructuralSegmenter: emotion enrichment skipped ({e})")
            return

        for act in acts:
            for scene in act.get("children", []):
                blocks = scene.get("blocks", [])
                try:
                    ea.enrich_dialogue_blocks(blocks, language=language)
                except Exception as exc:
                    print(
                        f"⚠️  Emotion error in scene "
                        f"'{scene.get('title', '?')}': {exc}"
                    )
