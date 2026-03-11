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
from collections import namedtuple
from typing import Any, Dict, List, Optional, Tuple

# ── Mistral-7B heading classifier (lazy-loaded, Tier-3) ───────────────────────
#
# Used only for short, isolated text blocks that fail all regex patterns.
# Identifies non-obvious chapter/section headings that lack standard keywords
# (e.g. unnamed sections, unique structural markers in non-Western texts).
#
# Model: mistralai/Mistral-7B-v0.1 (base model, few-shot prompted)
# Falls back silently if model unavailable.

_MISTRAL_OK = False
_MISTRAL_MODEL = "mistralai/Mistral-7B-v0.1"
_mistral_pipe: Optional[Any] = None

try:
    from transformers import pipeline as _hf_pipeline
    import torch as _torch
    _MISTRAL_OK = True
except ImportError:
    pass

# Few-shot prompt template for base model completion
_MISTRAL_HEADING_PROMPT = """\
Below are examples of chapter/section headings found in literary works:
YES: Chapter One
YES: ACT III
YES: PART TWO — The Flood
YES: I. The Beginning
YES: Prologue
YES: SCENE 4
NO: "Come here," she said.
NO: The old man walked slowly toward the door.
NO: It was a dark and stormy night.
NO: He had always known this day would come.

Is the following text a chapter or section heading? Answer YES or NO.
Text: {text}
Answer:"""


def _load_mistral() -> bool:
    """Lazy-load Mistral-7B-v0.1. Returns True on success."""
    global _mistral_pipe
    if _mistral_pipe is not None:
        return True
    if not _MISTRAL_OK:
        return False
    try:
        print(f"🔬 Loading Mistral-7B heading classifier ({_MISTRAL_MODEL}) …")
        # Use device_map=auto for multi-GPU / CPU offload; load_in_4bit if available
        model_kwargs: Dict[str, Any] = {
            "device_map": "auto",
        }
        try:
            # Try 4-bit quantisation (requires bitsandbytes)
            from transformers import BitsAndBytesConfig
            model_kwargs["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True)
        except ImportError:
            pass

        _mistral_pipe = _hf_pipeline(
            "text-generation",
            model=_MISTRAL_MODEL,
            dtype=_torch.float16 if _torch.cuda.is_available() else _torch.float32,
            model_kwargs=model_kwargs,
            max_new_tokens=3,
            do_sample=False,
        )
        print("✅ Mistral-7B heading classifier ready")
        return True
    except Exception as exc:
        print(f"⚠️  Mistral-7B load failed: {exc}. Heading detection will use regex only.")
        _mistral_pipe = None
        return False


def _mistral_is_heading(text: str) -> bool:
    """
    Ask Mistral-7B whether ``text`` is a chapter/section heading.
    Returns False (not a heading) if the model is unavailable or errors.
    Only called for short (≤ 80 char), isolated text blocks.
    """
    if not _load_mistral() or _mistral_pipe is None:
        return False
    # Skip if text is too long or looks like prose
    if len(text) > 80 or len(text.split()) > 12:
        return False
    try:
        prompt = _MISTRAL_HEADING_PROMPT.format(text=text.strip())
        output = _mistral_pipe(prompt)[0]["generated_text"]
        # The model completion starts after our prompt
        answer = output[len(prompt):].strip().upper()
        return answer.startswith("YES")
    except Exception as exc:
        print(f"⚠️  Mistral heading check error: {exc}")
        return False

# ── Data types ────────────────────────────────────────────────────────────────

Span = namedtuple("Span", ["text", "size", "flags", "page"])

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

# Running-header detector: lines starting or ending with a page number, 
# or containing book title artifacts.
_RUNNING_HEADER_RE = re.compile(
    r"^\d{1,4}\s+\S|"          # "9 MACBETH..."
    r"^.*\s+\d{1,4}$|"         # "...Before Breakfast 3"
    r"^[A-Z\s]{5,}\s+\d{1,4}$" # "CHARLOTTE'S WEB 4"
)

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
    r"^[A-Z][A-Z\s'\.\d]{0,28}[A-Z]\.?\:?\s*$"
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
        ai_headings: Optional[List[Dict[str, str]]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Segment blocks into hierarchical units.

        Parameters
        ----------
        all_blocks:   List of PyMuPDF block dicts.
        doc_type:     "play" | "novel" | "generic"
        language:     "en" | "fr"
        add_emotions: If True, run EmotionAnalyzer on dialogue blocks (plays only).
        ai_headings:  Optional list of metadata-inferred headings [{"title": "...", "text": "..."}].
        """
        self.ai_headings = ai_headings or []
        tokens = self._tokenise(all_blocks, doc_type)

        if doc_type == "play":
            units = self._build_play_hierarchy(tokens)
            if add_emotions:
                self._enrich_play_emotions(units, language)
            return units

        if doc_type == "poem":
            return self._build_poem_hierarchy(tokens)

        return self._build_novel_hierarchy(tokens)

    # ── Heading threshold ───────────────────────────────────────────────────

    @staticmethod
    def _compute_heading_threshold(spans: List[Span]) -> float:
        """Compute a font-size threshold above which text is likely a heading."""
        if not spans:
            return 14.0
        sizes = sorted(s.size for s in spans)
        n = len(sizes)
        median = sizes[n // 2] if n % 2 else (sizes[n // 2 - 1] + sizes[n // 2]) / 2
        max_size = sizes[-1]
        return median + (max_size - median) * 0.5

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
        """
        Check for heading patterns. 
        Priority: AI-discovered headings -> Regex patterns.
        """
        clean_text = self._normalize_heading(text)
        
        # 1. AI Anchor Match (highest priority)
        if hasattr(self, "ai_headings") and self.ai_headings:
            for ah in self.ai_headings:
                target = self._normalize_heading(ah.get("text", ah.get("title", "")))
                if target and target in clean_text:
                    # Treat as chapter-level for novels/poems, act/scene follows regex logic below
                    return "chapter", True

        t = text[:30]
        # 2. Strong Regex Patterns (must check BEFORE running header as "CHAPTER 2" matches running header)
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

        # 3. Skip running headers (page numbers, book titles at edges)
        if _RUNNING_HEADER_RE.match(text.strip()):
            return "none", False

        # 4. Mistral-7B fallback: ask the model for short, isolated text
        #    that looks like it could be an unnamed heading (e.g. "The Storm",
        #    "I.", roman numerals, numbered titles without the word CHAPTER).
        if len(text.strip()) <= 80 and _mistral_is_heading(text.strip()):
            return "chapter", True

        return "none", False

    @staticmethod
    def _normalize_heading(text: str) -> str:
        """Lowercases and strips common punctuation/whitespace for comparison."""
        return re.sub(r'[^a-zA-Z0-9]', '', text.lower())

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
                        cur_act = {"id": _uid(), "title": "ACT I", "children": [], "inferred": True}
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

            # Strip leading page numbers smushed with text (e.g. "11She's" -> "She's")
            stripped = re.sub(r'^\d{1,3}([A-Z])', r'\1', stripped)

            # Skip running headers
            if _RUNNING_HEADER_RE.match(stripped) or _RUNNING_HEADER_RE.search(stripped):
                if len(stripped) < 50: # Headers are usually short
                    continue

            # Stage direction: entire line wrapped in () or []
            if _STAGE_INLINE_RE.match(stripped):
                blocks.append({
                    "type":      "stage_direction",
                    "character": None,
                    "content":   stripped.strip("[]()").strip(),
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
        MAX_CHUNK_WORDS = 250

        def new_chapter(title: str) -> Dict[str, Any]:
            return {
                "id": _uid(),
                "title": title,
                "children": [],  # We will add chunks here
                "content": "",
            }

        def new_chunk(title: str = "") -> Dict[str, Any]:
            return {
                "id": _uid(),
                "title": title,
                "paragraphs": [],
                "content": "",
                "word_count": 0
            }

        cur_chapter = new_chapter("Beginning")
        cur_chunk = new_chunk("Introduction")
        
        for tok in tokens:
            if tok["type"] == "heading" and tok["level"] == "chapter":
                # Flush current chunk and chapter
                if cur_chunk["paragraphs"]:
                    cur_chapter["children"].append(cur_chunk)
                if cur_chapter["children"]:
                    self._finalize_chapter(cur_chapter)
                    chapters.append(cur_chapter)
                
                cur_chapter = new_chapter(tok["title"])
                cur_chunk = new_chunk()
            
            elif tok["type"] == "content":
                text = tok["text"]
                words = len(text.split())
                
                # If adding this would explode the chunk, flush first
                if cur_chunk["word_count"] > 0 and (cur_chunk["word_count"] + words) > MAX_CHUNK_WORDS:
                    cur_chapter["children"].append(cur_chunk)
                    cur_chunk = new_chunk()
                
                cur_chunk["paragraphs"].append(text)
                cur_chunk["word_count"] += words

        # Final flush
        if cur_chunk["paragraphs"]:
            cur_chapter["children"].append(cur_chunk)
        if cur_chapter["children"]:
            self._finalize_chapter(cur_chapter)
            chapters.append(cur_chapter)

        return chapters

    @staticmethod
    def _finalize_chapter(chapter: Dict[str, Any]):
        """Finalize all chunks in the chapter and set overall content."""
        all_content = []
        for i, chunk in enumerate(chapter["children"]):
            chunk["content"] = "\n\n".join(chunk.get("paragraphs", []))
            # If no specific title, give it a sequence title
            if not chunk["title"]:
                chunk["title"] = f"Part {i+1}"
            all_content.append(chunk["content"])
        chapter["content"] = "\n\n".join(all_content)

    # ── Poem hierarchy ─────────────────────────────────────────────────────────

    def _build_poem_hierarchy(
        self, tokens: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Build stanza-based hierarchy for poems.
        Groups consecutive content lines into stanzas, separated by blank gaps
        or heading tokens.
        """
        poems: List[Dict[str, Any]] = []
        current_poem: Optional[Dict] = None
        current_stanza: List[str] = []
        stanza_num = 0

        def flush_stanza():
            nonlocal stanza_num
            if current_poem is not None and current_stanza:
                stanza_num += 1
                current_poem["children"].append({
                    "id":    _uid(),
                    "title": f"Stanza {stanza_num}",
                    "blocks": [
                        {"type": "verse_line", "content": line}
                        for line in current_stanza
                    ],
                    "content": "\n".join(current_stanza),
                })
                current_stanza.clear()

        for tok in tokens:
            if tok["type"] == "heading":
                flush_stanza()
                if current_poem and current_poem["children"]:
                    poems.append(current_poem)
                current_poem = {"id": _uid(), "title": tok["title"], "children": []}
                stanza_num = 0
            else:
                text = tok.get("text", "").strip()
                if not text:
                    # Empty line = stanza break
                    flush_stanza()
                    continue

                if current_poem is None:
                    current_poem = {"id": _uid(), "title": "The Poem", "children": []}
                current_stanza.append(text)

        # Flush remaining
        flush_stanza()
        if current_poem and current_poem["children"]:
            poems.append(current_poem)

        if not poems:
            # Fallback: treat all content as one poem
            all_lines = [t["text"] for t in tokens if t["type"] == "content"]
            stanzas = []
            current: List[str] = []
            for line in all_lines:
                if not line.strip():
                    if current:
                        stanzas.append(current)
                        current = []
                else:
                    current.append(line)
            if current:
                stanzas.append(current)

            children = [
                {
                    "id": _uid(),
                    "title": f"Stanza {i + 1}",
                    "blocks": [{"type": "verse_line", "content": l} for l in st],
                    "content": "\n".join(st),
                }
                for i, st in enumerate(stanzas)
            ] if stanzas else [{
                "id": _uid(),
                "title": "Content",
                "blocks": [{"type": "verse_line", "content": l} for l in all_lines],
                "content": "\n".join(all_lines),
            }]

            poems = [{
                "id": _uid(),
                "title": "The Poem",
                "children": children,
            }]

        return poems

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
