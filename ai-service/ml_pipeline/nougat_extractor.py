"""
nougat_extractor.py
===================
Tier-0 PDF extraction using Meta's Nougat model (facebook/nougat-base).

Nougat is a Vision Encoder-Decoder transformer that converts PDF page images
into structured academic markdown.  Its output is far richer than PyMuPDF:

    # Chapter 1 — The Night of the Storm
    ## Scene i
    Regular paragraph text …

This structured markdown feeds directly into FrontMatterDetector and
StructuralSegmenter, which already expect heading patterns.

Pipeline
--------
1. Render each PDF page to a PIL Image via PyMuPDF (fitz).
2. Batch images through NougatProcessor → VisionEncoderDecoderModel.
3. Decode raw tokens → markdown text per page.
4. Parse markdown into the same fitz-block dict format used by the rest of
   the pipeline so no downstream code needs to change.

Fallback
--------
If the model cannot be loaded (no GPU, insufficient RAM, network unavailable)
the extractor returns None and analyzer.py falls back to PyMuPDF as before.

Usage
-----
    extractor = NougatExtractor()
    blocks, total_chars = extractor.extract(pdf_bytes)
    if blocks is None:
        # fall back to fitz
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

_NOUGAT_OK = False
_MODEL_NAME = "facebook/nougat-base"

try:
    import torch
    from transformers import NougatProcessor, VisionEncoderDecoderModel
    from PIL import Image
    _NOUGAT_OK = True
except ImportError:
    pass

try:
    import fitz as _fitz
    _FITZ_FOR_RENDER = True
except ImportError:
    _FITZ_FOR_RENDER = False


# ── Singleton loader ───────────────────────────────────────────────────────────

_processor: Optional[Any] = None
_model:     Optional[Any] = None


def _load_nougat() -> bool:
    """Lazy-load Nougat processor + model. Returns True on success."""
    global _processor, _model
    if _processor is not None:
        return True
    if not _NOUGAT_OK:
        return False
    try:
        print(f"🔬 Loading Nougat model ({_MODEL_NAME}) …")
        _processor = NougatProcessor.from_pretrained(_MODEL_NAME)
        _model = VisionEncoderDecoderModel.from_pretrained(_MODEL_NAME)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _model = _model.to(device)
        _model.eval()
        print(f"✅ Nougat ready on {device}")
        return True
    except Exception as exc:
        print(f"⚠️  Nougat load failed ({exc}). Will use PyMuPDF fallback.")
        _processor = None
        _model = None
        return False


# ── Markdown → block converter ─────────────────────────────────────────────────

_HEADING1_RE = re.compile(r"^#+\s+(.+)$", re.MULTILINE)


def _markdown_to_blocks(
    page_markdowns: List[str],
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Convert a list of per-page markdown strings into the fitz block-dict
    format consumed by the rest of the pipeline.

    Each paragraph/heading becomes one block of type 0 (text block).
    Headings get a large font size (20) so StructuralSegmenter's heading
    detector fires; body paragraphs get size 12.
    """
    blocks: List[Dict[str, Any]] = []
    total_chars = 0

    for page_idx, md_text in enumerate(page_markdowns):
        if not md_text or not md_text.strip():
            continue

        # Split into logical chunks on blank lines
        chunks = [c.strip() for c in re.split(r"\n{2,}", md_text) if c.strip()]

        for chunk in chunks:
            # Determine if this chunk is a heading
            is_heading = bool(_HEADING1_RE.match(chunk))
            clean_text = _HEADING1_RE.sub(r"\1", chunk).strip() if is_heading else chunk
            font_size  = 20.0 if is_heading else 12.0
            flags      = 20 if is_heading else 0   # bold flag for headings

            block: Dict[str, Any] = {
                "type": 0,
                "_page": page_idx,
                "_nougat": True,           # provenance marker
                "lines": [{
                    "spans": [{
                        "text":  clean_text,
                        "size":  font_size,
                        "flags": flags,
                        "font":  "Nougat",
                    }]
                }],
            }
            blocks.append(block)
            total_chars += len(clean_text)

    return blocks, total_chars


# ── Main extractor ─────────────────────────────────────────────────────────────

class NougatExtractor:
    """
    Tier-0 PDF text extractor using Meta's Nougat model.

    Call ``extract(pdf_bytes)`` — returns (blocks, total_chars) on success,
    or (None, 0) if the model is unavailable or fails.
    """

    # Maximum pages to process through Nougat (keeps latency reasonable)
    MAX_PAGES = 60

    def extract(
        self,
        pdf_bytes: bytes,
        max_pages: int = MAX_PAGES,
    ) -> Tuple[Optional[List[Dict[str, Any]]], int]:
        """
        Run Nougat on pdf_bytes.

        Returns
        -------
        (blocks, total_chars)  — compatible with fitz block format, or
        (None, 0)              — if Nougat is unavailable / fails.
        """
        if not _FITZ_FOR_RENDER:
            return None, 0
        if not _load_nougat():
            return None, 0

        try:
            import fitz
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page_count = min(doc.page_count, max_pages)

            images: List[Image.Image] = []
            for i in range(page_count):
                page = doc[i]
                # Render at 150 DPI (1x zoom ≈ 72 DPI, so 2x = 144 DPI)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                images.append(img)

            if not images:
                return None, 0

            page_markdowns = self._run_nougat(images)
            blocks, total_chars = _markdown_to_blocks(page_markdowns)
            print(f"✅ Nougat extracted {total_chars} chars from {len(images)} pages")
            return blocks, total_chars

        except Exception as exc:
            print(f"⚠️  Nougat extraction error: {exc}")
            return None, 0

    # ── Private ───────────────────────────────────────────────────────────────

    def _run_nougat(self, images: List["Image.Image"]) -> List[str]:
        """Run the Nougat model on a list of PIL Images, batched for speed."""
        if _processor is None or _model is None:
            return [""] * len(images)

        device = next(_model.parameters()).device
        batch_size = 4   # Nougat-base can handle ~4 A4 pages at once in RAM

        all_texts: List[str] = []
        for i in range(0, len(images), batch_size):
            batch_imgs = images[i : i + batch_size]
            try:
                pixel_values = _processor(
                    images=batch_imgs,
                    return_tensors="pt",
                ).pixel_values.to(device)

                with torch.no_grad():
                    outputs = _model.generate(
                        pixel_values,
                        min_length=1,
                        max_new_tokens=512,
                        bad_words_ids=[[_processor.tokenizer.unk_token_id]],
                        return_dict_in_generate=True,
                        output_scores=False,
                    )

                page_texts = _processor.batch_decode(
                    outputs.sequences, skip_special_tokens=True
                )
                # Nougat post-processing: remove repeated [MISSING] tokens
                page_texts = [
                    re.sub(r"\[MISSING_PAGE[^\]]*\]", "", t).strip()
                    for t in page_texts
                ]
                all_texts.extend(page_texts)

            except Exception as exc:
                print(f"⚠️  Nougat batch {i//batch_size} failed: {exc}")
                all_texts.extend([""] * len(batch_imgs))

        return all_texts


# ── Module-level singleton ─────────────────────────────────────────────────────

_extractor: Optional[NougatExtractor] = None


def get_nougat_extractor() -> NougatExtractor:
    global _extractor
    if _extractor is None:
        _extractor = NougatExtractor()
    return _extractor
