"""
front_matter_filter.py
======================
Detects and filters out front matter from extracted PDF blocks.

Front matter includes:
  - Title pages
  - Copyright / publication info
  - Dedication pages
  - Epigraphs
  - Table of contents (TOC)
  - Foreword / Preface / Introduction / Prologue
  - Acknowledgments
  - "About the Author" sections

The filter works on the raw block list (from PyMuPDF) and returns
only the blocks that contain actual learning content (the body of
the book/play starting from Chapter 1 or Act I).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

# ── Front-matter heading patterns ─────────────────────────────────────────────

_FRONT_MATTER_HEADINGS = re.compile(
    r"^\s*("
    r"TABLE\s+OF\s+CONTENTS|"
    r"CONTENTS|"
    r"FOREWORD|"
    r"FORE\s*WORD|"
    r"PREFACE|"
    r"INTRODUCTION|"
    r"PROLOGUE|"
    r"EPIGRAPH|"
    r"DEDICATION|"
    r"ACKNOWLEDGMENTS?|"
    r"ACKNOWLEDGEMENTS?|"
    r"ABOUT\s+THE\s+AUTHOR|"
    r"EDITOR'?S?\s+NOTE|"
    r"TRANSLATOR'?S?\s+NOTE|"
    r"COPYRIGHT|"
    r"PUBLISHED\s+BY|"
    r"ALL\s+RIGHTS\s+RESERVED|"
    r"ISBN|"
    r"LIBRARY\s+OF\s+CONGRESS|"
    r"FIRST\s+(EDITION|PUBLISHED|PRINTING)|"
    r"DRAMATIS\s+PERSONAE|"
    r"CAST\s+OF\s+CHARACTERS|"
    r"LIST\s+OF\s+CHARACTERS|"
    r"CHARACTERS"
    r")\s*$",
    re.IGNORECASE | re.MULTILINE,
)

# Patterns that signal the START of actual content
_CONTENT_START_PATTERNS = re.compile(
    r"^\s*("
    r"ACT\s+([IVX]+|\d+)|"
    r"SCENE\s+([IVX]+|\d+)|"
    r"CHAPTER\s+([\dIVX]+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)|"
    r"PART\s+([\dIVX]+|ONE|TWO|THREE)|"
    r"BOOK\s+([\dIVX]+|ONE|TWO|THREE)"
    r")\b",
    re.IGNORECASE,
)

# Copyright / publication noise
_COPYRIGHT_RE = re.compile(
    r"(copyright|©|\bISBN\b|all rights reserved|published by|"
    r"first (edition|published|printing)|library of congress|"
    r"printed in|typeset|cover design)",
    re.IGNORECASE,
)

# TOC-like patterns: dense references like "Chapter 1 .... 15"
_TOC_LINE_RE = re.compile(
    r"(chapter|act|scene|part)\s+[\dIVX]+.*?\.{2,}\s*\d+",
    re.IGNORECASE,
)

# Page number patterns (often in headers/footers)
_PAGE_NUM_RE = re.compile(r"^\s*\d{1,4}\s*$")


class FrontMatterFilter:
    """
    Filters front matter from extracted PDF blocks.

    Usage:
        filter = FrontMatterFilter()
        content_blocks, removed_count = filter.filter_blocks(all_blocks, doc_type="novel")
    """

    def filter_blocks(
        self,
        all_blocks: List[Dict[str, Any]],
        doc_type: str = "novel",
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Filter front matter from block list.

        Returns:
            (filtered_blocks, filter_metadata)
            where filter_metadata contains counts of what was removed.
        """
        if not all_blocks:
            return all_blocks, {"removed": 0, "kept": 0}

        # Step 1: Find where the actual content starts
        content_start_idx = self._find_content_start(all_blocks, doc_type)

        # Step 2: From blocks before content_start, identify front-matter
        # Step 3: From blocks after content, identify back-matter
        content_end_idx = self._find_content_end(all_blocks, doc_type)

        # Everything before content_start is front matter
        # Everything after content_end is back matter
        filtered = all_blocks[content_start_idx:content_end_idx]

        # Step 4: Remove page numbers and stray copyright lines within content
        filtered = self._remove_noise_within_content(filtered)

        front_removed = content_start_idx
        back_removed = len(all_blocks) - content_end_idx
        noise_removed = (content_end_idx - content_start_idx) - len(filtered)

        return filtered, {
            "front_matter_removed": front_removed,
            "back_matter_removed": back_removed,
            "noise_removed": noise_removed,
            "total_removed": front_removed + back_removed + noise_removed,
            "kept": len(filtered),
            "original_count": len(all_blocks),
        }

    def _find_content_start(
        self, blocks: List[Dict[str, Any]], doc_type: str
    ) -> int:
        """
        Find the index of the first block that is actual content.
        Scans forward looking for ACT I / CHAPTER 1 style headings.
        """
        lines_by_block = []
        for i, b in enumerate(blocks):
            text = self._block_text(b)
            lines_by_block.append((i, text))

        # Strategy 1: Look for explicit content-start heading
        for idx, text in lines_by_block:
            if _CONTENT_START_PATTERNS.search(text):
                # Check it's not inside a TOC (TOC lines have page refs like "... 15")
                if _TOC_LINE_RE.search(text):
                    continue
                return idx

        # Strategy 2: If no explicit heading found, skip front-matter headings
        last_front_matter_idx = -1
        for idx, text in lines_by_block:
            stripped = text.strip()
            if not stripped:
                continue
            if _FRONT_MATTER_HEADINGS.search(stripped):
                last_front_matter_idx = idx
            elif _COPYRIGHT_RE.search(stripped):
                last_front_matter_idx = idx
            elif _TOC_LINE_RE.search(stripped):
                last_front_matter_idx = idx

        if last_front_matter_idx >= 0:
            # Skip to the block after the last front-matter block
            # Also skip any blank blocks immediately after
            start = last_front_matter_idx + 1
            while start < len(blocks) and not self._block_text(blocks[start]).strip():
                start += 1
            return min(start, len(blocks))

        # Strategy 3: For plays, skip until we see character cues or dialogue
        if doc_type == "play":
            _CUE = re.compile(r"^[A-Z][A-Z\s'\.]{1,28}[A-Z]\.?\s*$")
            for idx, text in lines_by_block:
                for line in text.split("\n"):
                    if _CUE.match(line.strip()) and len(line.strip().split()) <= 5:
                        return max(0, idx - 1)

        # Fallback: skip first 3% of blocks as likely title/copyright
        skip = max(1, len(blocks) // 30)
        return min(skip, len(blocks))

    def _find_content_end(
        self, blocks: List[Dict[str, Any]], doc_type: str
    ) -> int:
        """
        Find where content ends (before appendices, about author, glossary, etc.)
        """
        _BACK_MATTER = re.compile(
            r"^\s*("
            r"APPENDIX|"
            r"GLOSSARY|"
            r"INDEX|"
            r"BIBLIOGRAPHY|"
            r"REFERENCES|"
            r"ABOUT\s+THE\s+AUTHOR|"
            r"NOTES|"
            r"END\s+NOTES|"
            r"FURTHER\s+READING|"
            r"ALSO\s+BY|"
            r"OTHER\s+BOOKS\s+BY"
            r")\s*$",
            re.IGNORECASE,
        )

        # Scan from the end backwards
        for i in range(len(blocks) - 1, max(len(blocks) // 2, 0), -1):
            text = self._block_text(blocks[i]).strip()
            if _BACK_MATTER.search(text):
                return i

        return len(blocks)

    def _remove_noise_within_content(
        self, blocks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Remove stray page numbers and isolated copyright lines within content."""
        filtered = []
        for b in blocks:
            text = self._block_text(b).strip()
            # Skip pure page numbers
            if _PAGE_NUM_RE.match(text):
                continue
            # Skip very short copyright-like lines within content
            if len(text) < 80 and _COPYRIGHT_RE.search(text):
                continue
            filtered.append(b)
        return filtered

    @staticmethod
    def _block_text(block: Dict[str, Any]) -> str:
        """Extract all text from a PyMuPDF block dict."""
        if block.get("type") != 0:
            return ""
        parts = []
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                parts.append(span.get("text", ""))
        return " ".join(parts)
