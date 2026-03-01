"""
analyzer.py
===========
LiteratureAnalyzer — Main orchestrator.

Pipeline:
  1. Open PDF with PyMuPDF (fitz).
  2. Extract span-level block data (with page numbers injected).
  3. ContentClassifier → doc_type, confidence.
  4. StructuralSegmenter → structured hierarchy (Act>Scene or Chapter>Section).
  5. PedagogicalQuestionGenerator → questions for the first scene/chapter.
  6. Return AnalysisResult dataclass.
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
    print("⚠️  PyMuPDF (fitz) not installed. Run: pip install pymupdf")

from .content_classifier   import ContentClassifier, ClassificationResult
from .structural_segmenter import StructuralSegmenter
from .question_generator   import PedagogicalQuestionGenerator


# ── Result dataclass ───────────────────────────────────────────────────────────

@dataclass
class AnalysisResult:
    document_type: str                  # "play" | "novel" | "generic"
    title:         str
    confidence:    float
    units:         List[Dict[str, Any]] # hierarchical structure
    flat_units:    List[Dict[str, Any]] # flat structure for basic readers
    questions:     List[Dict[str, Any]]
    metadata:      Dict[str, Any]       # pages, chars, processing_time_ms, signals
    classification: Optional[ClassificationResult] = None


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
    >>> result.units          # [ { "id": ..., "title": "ACT I", "children": [...] } ]

    Generate questions (requires Ollama or falls back to templates):
    >>> result = analyzer.analyze(pdf_bytes, generate_questions=True, question_count=5)
    >>> result.questions      # [ {question, options, correctAnswer, explanation} ]
    """

    def __init__(self):
        self._classifier  = ContentClassifier()
        self._segmenter   = StructuralSegmenter()
        self._qgen        = PedagogicalQuestionGenerator()

    # ── Public API ─────────────────────────────────────────────────────────────

    def analyze(
        self,
        pdf_bytes:          bytes,
        filename:           str  = "document.pdf",
        generate_questions: bool = True,
        question_count:     int  = 5,
    ) -> AnalysisResult:
        """
        Analyze a PDF from its raw bytes.

        Parameters
        ----------
        pdf_bytes:
            Raw PDF content (e.g., from ``await file.read()``).
        filename:
            Original filename used for title inference.
        generate_questions:
            If True, generate pedagogical questions for the first content unit.
        question_count:
            Number of questions to generate.

        Returns
        -------
        AnalysisResult dataclass.

        Raises
        ------
        ImportError  – if PyMuPDF is not installed.
        ValueError   – if the PDF is unreadable or contains < 50 chars.
        """
        if not _FITZ_OK:
            raise ImportError(
                "PyMuPDF not installed. Run: pip install pymupdf"
            )

        t0 = time.monotonic()

        # ── Step 1: Open & extract ─────────────────────────────────────────────
        doc   = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = doc.page_count
        all_blocks, total_chars = self._extract_all_blocks(doc)

        if total_chars < 50:
            raise ValueError(
                "Extracted text is too short. The PDF may be scanned/image-based. "
                "Pre-process it with OCR (e.g., pytesseract) first."
            )

        # ── Step 2: Classify ───────────────────────────────────────────────────
        clf = self._classifier.classify(all_blocks)

        # ── Step 3: Infer title ────────────────────────────────────────────────
        title = self._infer_title(all_blocks, doc, filename)

        # ── Step 4: Segment ────────────────────────────────────────────────────
        units = self._segmenter.segment(all_blocks, doc_type=clf.type)
        flat_units = self._flatten_units(units, doc_type=clf.type)

        # ── Step 5: Generate questions ─────────────────────────────────────────
        questions: List[Dict[str, Any]] = []
        if generate_questions:
            sample_content = self._extract_first_content(units, clf.type)
            if sample_content:
                questions = self._qgen.generate(
                    content  = sample_content,
                    doc_type = clf.type,
                    count    = question_count,
                )

        elapsed_ms = round((time.monotonic() - t0) * 1000, 1)

        return AnalysisResult(
            document_type  = clf.type,
            title          = title,
            confidence     = clf.confidence,
            units          = units,
            flat_units     = flat_units,
            questions      = questions,
            metadata       = {
                "source_file":         filename,
                "pages":               pages,
                "total_chars":         total_chars,
                "top_level_units":     len(units),
                "processing_time_ms":  elapsed_ms,
                "play_score":          clf.play_score,
                "novel_score":         clf.novel_score,
                "signals":             clf.signals,
            },
            classification = clf,
        )

    # ── Private helpers ────────────────────────────────────────────────────────

    def analyze_text(
        self,
        text: str,
        filename: str = "document.txt",
        generate_questions: bool = True,
        question_count: int = 5,
    ) -> AnalysisResult:
        """
        Analyze raw text content (no PDF available).
        Synthetic blocks are created to reuse the classifier and segmenter logic.
        """
        start_time = time.monotonic()
        
        # 1. Synthesize blocks from text (simple paragraph-based)
        # Without font metadata, segmentation will rely purely on regex headings.
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        mock_blocks = []
        for i, p in enumerate(paragraphs):
            mock_blocks.append({
                "type": 0,
                "_page": 0,
                "lines": [{
                    "spans": [{
                        "text": p,
                        "size": 12.0,  # Default body size
                        "flags": 0,
                        "font": "System"
                    }]
                }]
            })

        # 2. Classify
        clf_result = self._classifier.classify(mock_blocks)
        doc_type = clf_result.type

        # 3. Segment (Regex-based hierarchy)
        units = self._segmenter.segment(mock_blocks, doc_type)
        flat_units = self._flatten_units(units, doc_type)
        
        print(f"DEBUG RE-ANALYZE: {filename} | type:{doc_type} | units:{len(units)} | flat:{len(flat_units)}")

        # 4. Generate questions (optional)
        questions = []
        if generate_questions and units:
            # Pick first unit's first child content for question context
            context = ""
            if units[0].get("children"):
                context = units[0]["children"][0].get("content") or units[0]["children"][0].get("paragraphs", [""])[0]
            elif units[0].get("content"):
                context = units[0].get("content")
            
            if context:
                questions = self._qgen.generate(context, doc_type, question_count)

        # 5. Build result
        process_ms = round((time.monotonic() - start_time) * 1000, 2)
        
        return AnalysisResult(
            document_type=doc_type,
            title=filename.replace(".pdf", "").replace(".txt", ""),
            confidence=clf_result.confidence,
            units=units,
            flat_units=flat_units,
            questions=questions,
            metadata={
                "pages": 1,
                "total_chars": len(text),
                "top_level_units": len(units),
                "processing_time_ms": process_ms,
                "classification_signals": clf_result.signals,
                "ml_probs": clf_result.ml_probabilities,
                "mode": "text_only_reanalysis"
            },
            classification=clf_result,
        )

    def _extract_blocks(
        self, doc: "fitz.Document"
    ) -> tuple[List[Dict[str, Any]], int]:
        """
        Extract all text blocks from all pages.
        Injects ``"_page"`` (0-indexed) into each block dict.
        """
        all_blocks: List[Dict[str, Any]] = []
        total_chars = 0

        for page_idx in range(doc.page_count):
            page = doc[page_idx]
            page_dict = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
            for block in page_dict.get("blocks", []):
                block["_page"] = page_idx
                all_blocks.append(block)
                # Count chars in text blocks only
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
        """
        Heuristic title inference:
        1. First page bold/large span on page 0.
        2. PDF metadata title.
        3. Filename stem.
        """
        # Collect spans from first page only
        first_page_spans: List[tuple[float, str]] = []  # (size, text)
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
            # Largest font on page 1 is likely the title
            best = max(first_page_spans, key=lambda x: x[0])
            if best[0] > 14:  # Must be meaningfully larger than body text
                return best[1]

        # Fallback: PDF metadata
        try:
            meta = doc.metadata
            if meta and meta.get("title"):
                return meta["title"].strip()
        except Exception:
            pass

        # Fallback: filename stem
        return filename.replace("_", " ").replace("-", " ").rsplit(".", 1)[0].title()

    def _extract_first_content(
        self, units: List[Dict[str, Any]], doc_type: str
    ) -> str:
        """
        Pull a ~2000 char content sample from the first scene/chapter
        for question generation.
        """
        if not units:
            return ""

        first_unit = units[0]

        if doc_type == "play":
            children = first_unit.get("children", [])
            if children:
                first_scene = children[0]
                lines = []
                for b in first_scene.get("blocks", []):
                    c = b.get("character")
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

    def _flatten_units(self, units: List[Dict[str, Any]], doc_type: str) -> List[Dict[str, Any]]:
        """
        Flatten nested hierarchy for backward compatibility with existing readers.
        Expected format: List[{title, content, dialogue: List[DialogueLine]}]
        """
        flat = []
        if doc_type == "play":
            for act in units:
                for scene in act.get("children", []):
                    full_content = []
                    for b in scene.get("blocks", []):
                        if b["type"] == "dialogue":
                            full_content.append(f"{b['character']}: {b['content']}")
                        elif b["type"] == "stage_direction":
                            full_content.append(f"[{b['content']}]")
                        else:
                            full_content.append(b["content"])
                    
                    scene_title = scene.get("title", "Scene")
                    title = f"{act['title']} - {scene_title}" if not scene.get("inferred") else act['title']
                    
                    flat.append({
                        "title": title,
                        "content": "\n\n".join(full_content),
                        "blocks": scene.get("blocks", [])
                    })
        else:
            for chapter in units:
                for section in chapter.get("children", []):
                    flat.append({
                        "title": f"{chapter['title']} - {section['title']}" if section.get("title") else chapter['title'],
                        "content": section.get("content", "") or "\n\n".join(section.get("paragraphs", [])),
                        "dialogue": []
                    })
        return flat
