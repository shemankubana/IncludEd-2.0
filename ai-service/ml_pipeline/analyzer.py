"""
analyzer.py
===========
LiteratureAnalyzer — Main orchestrator.

Pipeline:
  1. Open PDF with PyMuPDF (fitz).
  2. Extract span-level block data (with page numbers injected).
  3. FrontMatterDetector → remove front/back matter pages.
  4. LanguageDetector → detect EN/FR.
  5. ContentClassifier → doc_type (play|novel|generic), confidence.
  6. StructuralSegmenter → hierarchical structure with emotion tagging.
  7. PedagogicalQuestionGenerator → per-unit questions.
  8. Return AnalysisResult.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

try:
    import fitz  # PyMuPDF
    _FITZ_OK = True
except ImportError:
    _FITZ_OK = False
    print("PyMuPDF (fitz) not installed. Run: pip install pymupdf")

from .content_classifier    import ContentClassifier, ClassificationResult
from .structural_segmenter  import StructuralSegmenter
from .question_generator    import PedagogicalQuestionGenerator
from .front_matter_detector import FrontMatterDetector, filter_body_blocks
from .language_detector     import get_language_detector


# ── Result dataclass ───────────────────────────────────────────────────────────

@dataclass
class AnalysisResult:
    document_type: str                  # "play" | "novel" | "generic"
    title:         str
    confidence:    float
    units:         List[Dict[str, Any]] # hierarchical structure
    flat_units:    List[Dict[str, Any]] # flat for basic readers
    questions:     List[Dict[str, Any]]
    metadata:      Dict[str, Any]       # pages, chars, processing_time_ms, signals
    classification: Optional[ClassificationResult] = None
    language:      str = "en"           # detected language: "en" | "fr"
    author:        Optional[str] = None # extracted author name (None = unknown)


# ── Analyzer ───────────────────────────────────────────────────────────────────

class LiteratureAnalyzer:
    """
    End-to-end literary PDF analyzer.

    Usage
    -----
    Single-instance; reuse across requests:

    >>> analyzer = LiteratureAnalyzer()
    >>> result = analyzer.analyze(pdf_bytes, filename="macbeth.pdf")
    >>> result.document_type  # "play"
    >>> result.language       # "en"
    >>> result.units[0]["children"][0]["blocks"][0]["emotion"]  # "anger"
    """

    def __init__(self):
        self._classifier       = ContentClassifier()
        self._segmenter        = StructuralSegmenter()
        self._qgen             = PedagogicalQuestionGenerator()
        self._front_matter_det = FrontMatterDetector()
        self._lang_detector    = get_language_detector()

    # ── Public API ─────────────────────────────────────────────────────────────

    def analyze(
        self,
        pdf_bytes:          bytes,
        filename:           str  = "document.pdf",
        generate_questions: bool = True,
        question_count:     int  = 5,
    ) -> AnalysisResult:
        """
        Analyze a PDF from raw bytes.

        Parameters
        ----------
        pdf_bytes:
            Raw PDF content (e.g., from ``await file.read()``).
        filename:
            Original filename used for title inference.
        generate_questions:
            If True, generate pedagogical questions for first content unit.
        question_count:
            Number of questions to generate.
        """
        if not _FITZ_OK:
            raise ImportError(
                "PyMuPDF not installed. Run: pip install pymupdf"
            )

        t0 = time.monotonic()

        # ── Step 1: Open & extract ─────────────────────────────────────────────
        doc   = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = doc.page_count
        all_blocks, total_chars = self._extract_blocks(doc)
        all_blocks, total_chars = self._extract_blocks(doc)

        if total_chars < 50:
            raise ValueError(
                "Extracted text is too short. The PDF may be scanned/image-based. "
                "Pre-process with OCR (e.g., pytesseract) first."
            )

        # ── Step 2: Remove front/back matter ──────────────────────────────────
        body_blocks = self._front_matter_det.classify_blocks(all_blocks)
        front_pages_removed = len(all_blocks) - len(body_blocks)

        if len(body_blocks) < 10:
            body_blocks = all_blocks
            front_pages_removed = 0

        # ── Step 3: Detect language ────────────────────────────────────────────
        lang_result = self._lang_detector.detect_from_blocks(body_blocks)
        language    = lang_result["language"]
        lang_conf   = lang_result["confidence"]

        # ── Step 4: Classify ───────────────────────────────────────────────────
        clf = self._classifier.classify(body_blocks)

        # ── Step 5: Infer title + author ──────────────────────────────────────
        title  = self._infer_title(all_blocks, doc, filename)
        author = self._infer_author(all_blocks, doc)

        # ── Step 6: Segment + emotion tagging ─────────────────────────────────
        units = self._segmenter.segment(
            body_blocks,
            doc_type     = clf.type,
            language     = language,
            add_emotions = True,
        )
        flat_units = self._flatten_units(units, doc_type=clf.type)

        # ── Step 7: Generate questions ─────────────────────────────────────────
        questions: List[Dict[str, Any]] = []
        if generate_questions:
            sample_content = self._extract_first_content(units, clf.type)
            if sample_content:
                questions = self._qgen.generate(
                    content  = sample_content,
                    doc_type = clf.type,
                    count    = question_count,
                    language = language,
                )

        elapsed_ms = round((time.monotonic() - t0) * 1000, 1)

        return AnalysisResult(
            document_type  = clf.type,
            title          = title,
            author         = author,
            confidence     = clf.confidence,
            units          = units,
            flat_units     = flat_units,
            questions      = questions,
            language       = language,
            metadata       = {
                "source_file":          filename,
                "pages":                pages,
                "total_chars":          total_chars,
                "top_level_units":      len(units),
                "processing_time_ms":   elapsed_ms,
                "play_score":           clf.play_score,
                "novel_score":          clf.novel_score,
                "signals":              clf.signals,
                "front_pages_removed":  front_pages_removed,
                "language":             language,
                "language_confidence":  lang_conf,
                "language_method":      lang_result["method"],
            },
            classification = clf,
        )

    def analyze_text(
        self,
        text: str,
        filename: str = "document.txt",
        generate_questions: bool = True,
        question_count: int = 5,
    ) -> AnalysisResult:
        """
        Analyze raw text content (no PDF available).
        Synthetic blocks reuse the classifier and segmenter logic.
        """
        start_time = time.monotonic()

        # ── Step 1: Detect language ────────────────────────────────────────────
        lang_result = self._lang_detector.detect(text[:3000])
        language    = lang_result["language"]

        # ── Step 2: Synthesise blocks ──────────────────────────────────────────
        paragraphs  = [p.strip() for p in text.split("\n\n") if p.strip()]
        mock_blocks = [
            {
                "type": 0,
                "_page": 0,
                "lines": [{
                    "spans": [{
                        "text": p, "size": 12.0, "flags": 0, "font": "System"
                    }]
                }],
            }
            for p in paragraphs
        ]

        # ── Step 3: Classify ───────────────────────────────────────────────────
        clf_result = self._classifier.classify(mock_blocks)
        doc_type   = clf_result.type

        # ── Step 4: Segment ────────────────────────────────────────────────────
        units = self._segmenter.segment(
            mock_blocks,
            doc_type     = doc_type,
            language     = language,
            add_emotions = True,
        )
        flat_units = self._flatten_units(units, doc_type)

        # ── Step 5: Generate questions ─────────────────────────────────────────
        questions = []
        if generate_questions and units:
            context = self._extract_first_content(units, doc_type)
            if context:
                questions = self._qgen.generate(
                    context, doc_type, question_count, language
                )

        process_ms = round((time.monotonic() - start_time) * 1000, 2)

        return AnalysisResult(
            document_type = doc_type,
            title         = filename.replace(".pdf", "").replace(".txt", ""),
            confidence    = clf_result.confidence,
            units         = units,
            flat_units    = flat_units,
            questions     = questions,
            language      = language,
            metadata      = {
                "pages":                1,
                "total_chars":          len(text),
                "top_level_units":      len(units),
                "processing_time_ms":   process_ms,
                "classification_signals": clf_result.signals,
                "ml_probs":             clf_result.ml_probabilities,
                "mode":                 "text_only_reanalysis",
                "language":             language,
                "language_confidence":  lang_result["confidence"],
            },
            classification = clf_result,
        )

    # ── Private helpers ────────────────────────────────────────────────────────

    def _extract_blocks(
        self, doc: "fitz.Document"
    ) -> tuple[List[Dict[str, Any]], int]:
        all_blocks: List[Dict[str, Any]] = []
        total_chars = 0

        for page_idx in range(doc.page_count):
            page = doc[page_idx]
            page_dict = page.get_text(
                "dict", flags=fitz.TEXT_PRESERVE_WHITESPACE
            )
            for block in page_dict.get("blocks", []):
                block["_page"] = page_idx
                all_blocks.append(block)
                if block.get("type") == 0:
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            total_chars += len(span.get("text", ""))

        return all_blocks, total_chars

    def _infer_title(
        self,
        all_blocks: List[Dict[str, Any]],
        doc:        "fitz.Document",
        filename:   str,
    ) -> str:
        # Collect spans from page 0
        first_page_spans: List[tuple[float, str]] = []
        for block in all_blocks:
            if block.get("_page", 99) != 0 or block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    size = float(span.get("size", 12.0))
                    if text and len(text) > 2:
                        first_page_spans.append((size, text))

        if first_page_spans:
            best = max(first_page_spans, key=lambda x: x[0])
            if best[0] > 14:
                return best[1]

        try:
            meta = doc.metadata
            if meta and meta.get("title"):
                return meta["title"].strip()
        except Exception:
            pass

        return (
            filename.replace("_", " ").replace("-", " ")
            .rsplit(".", 1)[0].title()
        )

    def _infer_author(
        self,
        all_blocks: List[Dict[str, Any]],
        doc:        "fitz.Document",
    ) -> Optional[str]:
        """Try to extract the author from PDF metadata or title-page text."""
        import re as _re

        # 1. PDF metadata
        try:
            meta = doc.metadata
            if meta and meta.get("author", "").strip():
                return meta["author"].strip()
        except Exception:
            pass

        # 2. "by <Name>" pattern on the first 5 pages
        _by_re = _re.compile(r"^\s*by\s+([A-Z][a-zA-Z\s\.\-']{2,50})\s*$", _re.IGNORECASE)
        for block in all_blocks:
            if block.get("_page", 99) > 4 or block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    txt = span.get("text", "").strip()
                    m = _by_re.match(txt)
                    if m:
                        return m.group(1).strip()

        return None

    def _extract_first_content(
        self, units: List[Dict[str, Any]], doc_type: str
    ) -> str:
        """Pull ~2000 char content sample from first scene/chapter."""
        if not units:
            return ""

        first_unit = units[0]

        if doc_type == "play":
            children = first_unit.get("children", [])
            if children:
                first_scene = children[0]
                lines = []
                for b in first_scene.get("blocks", []):
                    c   = b.get("character")
                    txt = b.get("content", "")
                    if c:
                        lines.append(f"{c}: {txt}")
                    else:
                        lines.append(txt)
                return "\n".join(lines)[:2000]
        else:
            children = first_unit.get("children", [])
            if children:
                return children[0].get("content", "")[:2000]
            return first_unit.get("content", "")[:2000]

        return ""

    def _flatten_units(
        self, units: List[Dict[str, Any]], doc_type: str
    ) -> List[Dict[str, Any]]:
        """
        Flatten nested hierarchy for backward compatibility.
        Returns: List[{title, content, dialogue, language}]
        """
        flat = []

        if doc_type == "play":
            for act in units:
                for scene in act.get("children", []):
                    full_content = []
                    for b in scene.get("blocks", []):
                        if b["type"] == "dialogue":
                            full_content.append(
                                f"{b['character']}: {b['content']}"
                            )
                        elif b["type"] == "stage_direction":
                            full_content.append(f"[{b['content']}]")
                        else:
                            full_content.append(b["content"])

                    inferred = scene.get("inferred", False)
                    title = (
                        f"{act['title']} - {scene.get('title', 'Scene')}"
                        if not inferred
                        else act["title"]
                    )

                    flat.append({
                        "title":    title,
                        "content":  "\n\n".join(full_content),
                        "dialogue": scene.get("blocks", []),
                    })
        else:
            for chapter in units:
                for section in chapter.get("children", []):
                    flat.append({
                        "title":    (
                            f"{chapter['title']} - {section['title']}"
                            if section.get("title")
                            else chapter["title"]
                        ),
                        "content":  (
                            section.get("content", "")
                            or "\n\n".join(section.get("paragraphs", []))
                        ),
                        "dialogue": [],
                    })

        return flat
