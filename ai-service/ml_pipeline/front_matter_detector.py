"""
front_matter_detector.py
========================
Hybrid front-matter detection for PDF documents.

Classifies each page as:
    FRONT_MATTER  — title page, copyright, ToC, preface, acknowledgements, etc.
    BODY          — main narrative/dialogue content
    BACK_MATTER   — index, glossary, bibliography, appendix, etc.

Strategy:
  1. Rule-based pattern matching (fast, primary signal)
  2. Heuristic scoring (font size, text density, roman-numeral page numbers)
  3. Fallback: first BODY page determined by running score threshold

The detector is designed to run in <50ms on a 400-page PDF.
No external ML models are loaded (keeps the service lightweight).
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Dict, List, Optional, Tuple


# ── Page labels ──────────────────────────────────────────────────────────────────

class PageLabel(str, Enum):
    FRONT_MATTER = "FRONT_MATTER"
    BODY         = "BODY"
    BACK_MATTER  = "BACK_MATTER"


# ── Regex patterns for front/back matter keywords ────────────────────────────────

_FRONT_PATTERNS = [
    re.compile(r"^\s*(table\s+of\s+contents|contents)\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*copyright\b", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*all\s+rights\s+reserved\b", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*(dedication|dedicated\s+to)\b", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*(foreword|fore\s+word)\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*preface\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*acknowledgements?\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*introduction\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*(about\s+the\s+author|the\s+author)\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*isbn\b", re.IGNORECASE),
    re.compile(r"first\s+published\b", re.IGNORECASE),
    re.compile(r"printed\s+in\s+", re.IGNORECASE),
    re.compile(r"all\s+characters\s+in\s+this\s+publication", re.IGNORECASE),
    re.compile(r"no\s+part\s+of\s+this\s+(book|publication)", re.IGNORECASE),
    re.compile(r"^\s*cast\s+(of\s+)?(characters|persons)\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*dramatis\s+personae\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*list\s+of\s+(characters|illustrations|figures|tables)\s*$", re.IGNORECASE | re.MULTILINE),
]

_BACK_PATTERNS = [
    re.compile(r"^\s*(bibliography|references)\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*index\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*glossary\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*appendix\s+[a-z0-9]", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*further\s+reading\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*also\s+by\s+the\s+author\s*$", re.IGNORECASE | re.MULTILINE),
]

# Detect Roman numeral-only page number (e.g. "iv", "xii") — front matter page numbers
_ROMAN_PAGE_RE = re.compile(r"^\s*[ivxlcdm]+\s*$", re.IGNORECASE)

# Detect Arabic page numbers that are very low (1–10) on the first pages
_ARABIC_PAGE_RE = re.compile(r"^\s*\d{1,2}\s*$")

# Chapter/scene heading patterns — strong body signal
_BODY_HEADING_PATTERNS = [
    re.compile(r"^\s*chapter\s+[ivxlcdm\d]+", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*act\s+[ivxlcdm\d]+", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*scene\s+[ivxlcdm\d]+", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*part\s+(one|two|three|[ivxlcdm\d]+)", re.IGNORECASE | re.MULTILINE),
]


# ── Front Matter Detector ─────────────────────────────────────────────────────────

class FrontMatterDetector:
    """
    Classifies each PDF page as FRONT_MATTER, BODY, or BACK_MATTER.

    Input: list of page-level text strings (one per page).
    Output: list of PageLabel values, one per page.

    The first BODY page starts the body region; subsequent FRONT_MATTER
    classifications (except back-matter) are treated as body.
    """

    def classify_pages(self, page_texts: List[str]) -> List[PageLabel]:
        """
        Args:
            page_texts: List of full-page text strings, one per PDF page.

        Returns:
            List[PageLabel] of equal length to page_texts.
        """
        if not page_texts:
            return []

        raw_labels = [self._classify_single_page(t, idx) for idx, t in enumerate(page_texts)]

        # Post-process: once body is found, don't revert to front_matter
        # (except for genuine back-matter)
        labels     = list(raw_labels)
        body_found = False

        for i, label in enumerate(labels):
            if label == PageLabel.BODY:
                body_found = True
            elif label == PageLabel.FRONT_MATTER and body_found:
                # Already past front matter — reclassify as body unless it looks
                # like back matter content
                if not self._is_back_matter(page_texts[i]):
                    labels[i] = PageLabel.BODY
            elif label == PageLabel.BACK_MATTER:
                # Once back matter is seen, everything after it is back matter
                for j in range(i, len(labels)):
                    if labels[j] != PageLabel.FRONT_MATTER:
                        labels[j] = PageLabel.BACK_MATTER

        return labels

    def filter_body_pages(
        self,
        page_texts: List[str],
    ) -> Tuple[List[str], List[int]]:
        """
        Return only BODY pages and their original 0-based indices.

        Returns:
            (body_texts, body_indices)
        """
        labels = self.classify_pages(page_texts)
        body_texts   = []
        body_indices = []
        for i, (text, label) in enumerate(zip(page_texts, labels)):
            if label == PageLabel.BODY:
                body_texts.append(text)
                body_indices.append(i)
        return body_texts, body_indices

    def classify_blocks(
        self,
        page_blocks: List[Dict],
    ) -> List[Dict]:
        """
        Filter a list of fitz block dicts, removing front/back matter pages.

        page_blocks: list of block dicts with "_page" key (0-based page index).
        Returns: filtered block list (BODY pages only).
        """
        if not page_blocks:
            return page_blocks

        # Determine max page
        max_page = max(b.get("_page", 0) for b in page_blocks) + 1

        # Extract per-page text from blocks
        page_texts = [""] * max_page
        for block in page_blocks:
            pg = block.get("_page", 0)
            text = self._text_from_block(block)
            page_texts[pg] += text + "\n"

        labels = self.classify_pages(page_texts)

        # Return only body blocks
        return [
            block for block in page_blocks
            if labels[block.get("_page", 0)] == PageLabel.BODY
        ]

    # ── Private helpers ──────────────────────────────────────────────────────────

    def _classify_single_page(self, text: str, page_idx: int) -> PageLabel:
        """Score a single page and return its label."""
        if not text or not text.strip():
            return PageLabel.FRONT_MATTER  # Blank pages → front matter

        # Strong back-matter signal
        if self._is_back_matter(text):
            return PageLabel.BACK_MATTER

        front_score = 0
        body_score  = 0

        # ── Front matter signals ─────────────────────────────────────────────
        for pattern in _FRONT_PATTERNS:
            if pattern.search(text):
                front_score += 3

        # Roman numeral page numbers → front matter
        for line in text.split("\n"):
            if _ROMAN_PAGE_RE.match(line.strip()):
                front_score += 2

        # Very short pages with little content → front matter
        word_count = len(text.split())
        if word_count < 30 and page_idx < 20:
            front_score += 1

        # ── Body signals ─────────────────────────────────────────────────────
        for pattern in _BODY_HEADING_PATTERNS:
            if pattern.search(text):
                body_score += 5  # Strong: explicitly chapter/act heading

        # Long prose paragraphs → likely body
        long_paragraphs = [p for p in text.split("\n\n") if len(p.split()) > 30]
        body_score += len(long_paragraphs) * 2

        # Page index > 20 and no front-matter keywords → body
        if page_idx > 20:
            body_score += 3

        # ── Decision ─────────────────────────────────────────────────────────
        if body_score > front_score:
            return PageLabel.BODY
        if front_score > 0 and front_score >= body_score:
            return PageLabel.FRONT_MATTER
        # Default: if early pages with no clear signal → front matter
        if page_idx < 5:
            return PageLabel.FRONT_MATTER
        return PageLabel.BODY

    def _is_back_matter(self, text: str) -> bool:
        for pattern in _BACK_PATTERNS:
            if pattern.search(text):
                return True
        return False

    @staticmethod
    def _text_from_block(block: Dict) -> str:
        """Extract raw text from a fitz block dict."""
        if block.get("type") != 0:
            return ""
        parts = []
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                parts.append(span.get("text", ""))
        return " ".join(parts)


# ── Module-level singleton ────────────────────────────────────────────────────────

_detector = FrontMatterDetector()


def detect_front_matter(page_texts: List[str]) -> List[PageLabel]:
    """Convenience function: classify a list of page text strings."""
    return _detector.classify_pages(page_texts)


def filter_body_blocks(page_blocks: List[Dict]) -> List[Dict]:
    """Convenience function: filter fitz block dicts to BODY pages only."""
    return _detector.classify_blocks(page_blocks)
