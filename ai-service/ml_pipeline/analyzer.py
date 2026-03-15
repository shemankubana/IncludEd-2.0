"""
analyzer.py
===========
LiteratureAnalyzer — Main orchestrator.

Pipeline:
  1. Open PDF with PyMuPDF (fitz) and extract span-level block data.
  2. Gibberish detection → OCR fallback if needed.
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
from services.gemini_service import GeminiService

try:
    import easyocr
    import numpy as np
    from PIL import Image
    import io
    _OCR_OK = True
except ImportError:
    _OCR_OK = False

_OCR_READER = None

def get_easyocr_reader(languages=['en']):
    global _OCR_READER
    if _OCR_READER is None:
        # gpu=False to ensure it works on all systems without CUDA issues
        _OCR_READER = easyocr.Reader(languages, gpu=False)
    return _OCR_READER


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
        self._gemini           = GeminiService()
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

        # ── Step 2: Check for Gibberish (Broken Unicode CMap) ──────────────────
        is_junk = False
        if total_chars > 50:
            sample_text = self._get_sample_text(all_blocks)
            if self._is_gibberish(sample_text):
                print("⚠️ Gibberish detected (broken Unicode map). Forcing OCR fallback...")
                is_junk = True

        if total_chars < 50 or is_junk:
            if _OCR_OK:
                print(f"Falling back to OCR (low density={total_chars < 50}, junk={is_junk})...")
                all_blocks, total_chars = self._ocr_analyze(doc)
            else:
                if is_junk:
                    print("⚠️ Cannot OCR: dependencies missing. Proceeding with garbled text.")
                else:
                    raise ValueError(
                        "Extracted text is too short and OCR dependencies are missing. "
                        "Install pytesseract and tesseract-ocr."
                    )

        # ── Step 3: Remove front/back matter ──────────────────────────────────
        body_blocks = self._front_matter_det.classify_blocks(all_blocks)
        front_pages_removed = len(all_blocks) - len(body_blocks)

        if len(body_blocks) < 10:
            body_blocks = all_blocks
            front_pages_removed = 0

        # ── Step 4: Detect language ────────────────────────────────────────────
        lang_result = self._lang_detector.detect_from_blocks(body_blocks)
        language    = lang_result["language"]
        lang_conf   = lang_result["confidence"]

        # ── Step 5: Classify ───────────────────────────────────────────────────
        clf = self._classifier.classify(body_blocks)

        # ── Step 6: Infer title + author ──────────────────────────────────────
        title  = self._infer_title(all_blocks, doc, filename)
        author = self._infer_author(all_blocks, doc)

        # ── Step 6.5: Gemini Metadata Refinement (Tier 0) ───────────────────
        if self._gemini.is_available():
            try:
                # Use first few content blocks for deep analysis
                sample_text = " ".join([
                    "".join(s["text"] for l in b.get("lines", []) for s in l.get("spans", []))
                    for b in body_blocks[:20] if b.get("type") == 0
                ])[:3000]
                
                refinement_prompt = f"""Analyze this document content:
"{sample_text}"

The current (possibly inaccurate) metadata is:
Title: {title}
Author: {author}
Detected Type: {clf.type}

Respond in JSON with refined metadata focusing on Primary School (P4-P6) categories:
- title: string
- author: string
- type: "folktale" | "poetry" | "novel" | "informational" | "play" | "resource_book"
- primary_suitability: "P4" | "P5" | "P6" | "unknown"
- structure: [{"title": "e.g. Introduction", "text": "the exact text of the heading in the document"}]
"""
                refinement = self._gemini.generate_json(refinement_prompt)
                if refinement:
                    print(f"✨ Gemini Analysis: Title='{refinement.get('title')}', Type='{refinement.get('type')}', Suitability='{refinement.get('primary_suitability')}'")
                    title = refinement.get("title", title)
                    author = refinement.get("author", author)
                    if refinement.get("type"):
                        clf.type = refinement["type"]
                    ai_headings = refinement.get("structure", [])
                    if ai_headings:
                        print(f"🧩 Gemini structural discovery: found {len(ai_headings)} units/chapters.")
                else:
                    ai_headings = []
            except Exception as e:
                print(f"Gemini metadata refinement failed: {e}")
                ai_headings = []
        else:
            ai_headings = []

        # ── Step 7: Segment + emotion tagging ─────────────────────────────────
        units = self._segmenter.segment(
            body_blocks,
            doc_type     = clf.type,
            language     = language,
            add_emotions = True,
            ai_headings  = ai_headings,
        )
        flat_units = self._flatten_units(units, doc_type=clf.type)

        # ── Step 8: AI Introduction Enhancement (Tier 0) ───────────────────
        if self._gemini.is_available() and flat_units:
            # Check if there's a good introduction
            has_intro = any("intro" in u["title"].lower() or "prologue" in u["title"].lower() for u in flat_units)
            if not has_intro:
                try:
                    intro_prompt = f"""Create a warm, encouraging 1-paragraph introduction for a Primary 6 student (age 11) about to read:
Title: {title}
Author: {author}
Type: {clf.type}

Focus on why this book is exciting and what they might learn about characters or values like courage, friendship, or honesty.
Keep it strictly under 100 words.
"""
                    ai_intro = self._gemini.generate(intro_prompt)
                    if ai_intro:
                        flat_units.insert(0, {
                            "title": "About This Book",
                            "content": ai_intro,
                            "dialogue": []
                        })
                except Exception as e:
                    print(f"Failed to generate AI intro: {e}")

        # ── Step 7: Generate questions (ADHD Bite-sized Learning) ─────────────
        questions: List[Dict[str, Any]] = []
        if generate_questions:
            # If it's a novel or informational text with multiple chunks, generate per-chunk
            if clf.type in ["novel", "informational", "generic"] and len(flat_units) > 1:
                print(f"🧩 Generating micro-quizzes for {len(flat_units)} chunks...")
                for i, unit in enumerate(flat_units):
                    # Skip short/intro units
                    if len(unit.get("content", "")) < 300:
                        continue
                    
                    unit_content = unit.get("content", "")
                    unit_qs = self._qgen.generate(
                        content  = unit_content,
                        doc_type = clf.type,
                        count    = 1, # 1 question per chunk for high engagement
                        language = language,
                    )
                    for q in unit_qs:
                        q["chunk_index"] = i
                        q["chapter_title"] = unit.get("title", "")
                        questions.append(q)
                
                # If still too few questions, generate generic ones for the whole book
                if len(questions) < question_count:
                    sample_content = self._extract_first_content(units, clf.type)
                    extra_qs = self._qgen.generate(
                        content  = sample_content,
                        doc_type = clf.type,
                        count    = question_count - len(questions),
                        language = language,
                    )
                    questions.extend(extra_qs)

            else:
                # Original logic for plays or single-unit docs
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
                "dict", flags=fitz.TEXT_PRESERVE_WHITESPACE | fitz.TEXT_DEHYPHENATE
            )
            
            # Broad layout filtering for headers/footers
            page_rect = page.rect
            header_threshold = page_rect.height * 0.10 # top 10%
            footer_threshold = page_rect.height * 0.90 # bottom 10%

            for block in page_dict.get("blocks", []):
                bbox = block.get("bbox", (0, 0, 0, 0))
                is_header_area = bbox[3] < header_threshold
                is_footer_area = bbox[1] > footer_threshold
                
                if is_header_area or is_footer_area:
                    # Scrub headers/footers that contain book title/author or page numbers
                    txt = "".join("".join(s["text"] for s in l["spans"]) for l in block.get("lines", [])).strip()
                    simple_txt = re.sub(r'[^a-zA-Z0-9]', '', txt.lower())
                    
                    # Fuzzy match against known title/author if available or short junk
                    if txt.isdigit() or len(txt) < 3:
                        continue 
                    
                    # If it's a single line in a margin, it's very likely noise
                    if len(block.get("lines", [])) <= 1 and (len(txt) < 40 or txt.isupper()):
                        continue

                block["_page"] = page_idx
                all_blocks.append(block)
                if block.get("type") == 0:
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            total_chars += len(span.get("text", ""))

        return all_blocks, total_chars

    def _get_sample_text(self, blocks: List[Dict[str, Any]], max_chars: int = 1000) -> str:
        """Extract a small sample of text from body blocks for validation."""
        text = ""
        # Look for blocks that aren't on the cover page (usually page 0)
        body_blocks = [b for b in blocks if b.get("_page", 0) > 0]
        if not body_blocks: body_blocks = blocks
        
        for b in body_blocks:
            if b.get("type") == 0:
                for line in b.get("lines", []):
                    for span in line.get("spans", []):
                        text += span.get("text", "") + " "
                        if len(text) > max_chars:
                            return text
        return text

    def _is_gibberish(self, text: str) -> bool:
        """
        Detect broken Unicode maps (mojibake).
        Signs of junk text:
        - Ratio of symbols/whitespace to letters is extremely high.
        - Common English characters (e.g. 'e', 't', 'a') are missing.
        - Excessive noise characters: }, {, [, @, _, \\, |, ^, ~

        """
        if not text or len(text) < 20:
            return False
            
        # Clean text for counting
        letters = sum(1 for c in text if c.isalpha())
        total = len(text.strip())
        if total == 0: return False
        
        alpha_ratio = letters / total
        
        # ── Decision ─────────────────────────────────────────────────────────
        # Real prose usually has > 70% letters. Broken PDFs often have many symbols.
        if alpha_ratio < 0.5:
            return True
            
        # Check for noise character concentration
        # Added: |, ¤, ¦, §, ©, ®, ±, ¶
        noise_chars = "}{[]@_\\|^~¤¦§©®±¶"
        noise_count = sum(1 for c in text if c in noise_chars)
        if noise_count / total > 0.05: # > 5% junk chars (lowered from 10%)
            return True
            
        # Check for fragmented text (very short non-word "words")
        words = text.split()
        if len(words) > 10:
            short_words = [w for w in words if len(w) <= 2 and w.isalpha()]
            if len(short_words) / len(words) > 0.5: # > 50% are 1-2 char fragments
                return True
                
        # Secondary check: Common English letters (ETAOIN)
        text_lower = text.lower()
        common_missing = sum(1 for char in "etaoin" if char not in text_lower)
        if common_missing >= 3 and letters > 40: # Lowered threshold
            return True

        return False

    def _ocr_analyze(self, doc: "fitz.Document") -> tuple[List[Dict[str, Any]], int]:
        """Perform OCR using EasyOCR on the entire document."""
        all_blocks: List[Dict[str, Any]] = []
        total_chars = 0
        
        # We only OCR the first 50 pages for speed
        max_ocr = min(doc.page_count, 50) 
        reader = get_easyocr_reader()
        
        for page_idx in range(max_ocr):
            page = doc[page_idx]
            # Render page to image (higher zoom for better OCR)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) 
            img_data = pix.tobytes("png")
            
            # EasyOCR can take image path, cv2 image, or byte stream
            # For simplicity and to avoid PIL dependency where not needed:
            results = reader.readtext(img_data, detail=0, paragraph=True)
            
            # Synthesize blocks from OCR text
            for p in results:
                txt = p.strip()
                if not txt: continue
                block = {
                    "type": 0,
                    "_page": page_idx,
                    "lines": [{
                        "spans": [{
                            "text": txt, "size": 11.0, "flags": 0, "font": "OCR"
                        }]
                    }],
                }
                all_blocks.append(block)
                total_chars += len(txt)
                
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
                    content = (
                        section.get("content", "")
                        or "\n\n".join(section.get("paragraphs", []))
                    )
                    
                    # ADHD Sub-chunking: If a section is too long (> 250 words),
                    # break it into smaller manageable chunks for the reader (v3.1 micro-chunks).
                    chunks = self._sub_chunk_content(content, max_words=200)
                    
                    for i, chunk in enumerate(chunks):
                        title = (
                            f"{chapter['title']} - {section['title']}"
                            if section.get("title")
                            else chapter["title"]
                        )
                        if len(chunks) > 1:
                            title += f" (Part {i+1})"
                            
                        flat.append({
                            "title":    title,
                            "content":  chunk,
                            "dialogue": [],
                        })

        return flat

    def _sub_chunk_content(self, text: str, max_words: int = 200) -> List[str]:
        """Split long text into micro-chunks at paragraph boundaries (< 220 words)."""
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not paragraphs: return [text]
        
        chunks = []
        current_chunk = []
        current_word_count = 0
        
        # Allow 30% overflow to avoid tiny fragments (e.g. 260 words is okay)
        overflow_limit = int(max_words * 1.3)

        for p in paragraphs:
            p_word_count = len(p.split())
            
            if current_chunk and (current_word_count + p_word_count > overflow_limit):
                chunks.append("\n\n".join(current_chunk))
                current_chunk = [p]
                current_word_count = p_word_count
            else:
                current_chunk.append(p)
                current_word_count += p_word_count
                
        if current_chunk:
            chunks.append("\n\n".join(current_chunk))
            
        return chunks
