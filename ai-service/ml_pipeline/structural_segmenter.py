"""
structural_segmenter.py
=======================
Permissive segmenter for plays and novels. Handles smushed lines.
"""

from __future__ import annotations
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

def _uid() -> str:
    return str(uuid.uuid4())[:8]

# Robust regex for text-only (using .search instead of .match)
_ACT_RE      = re.compile(r"\bACT\s+([IVX]+|\d+)\b", re.IGNORECASE)
_SCENE_RE    = re.compile(r"\bSCENE\s+([IVX]+|\d+)\b", re.IGNORECASE)
_CHAPTER_RE  = re.compile(r"\b(CHAPTER|PROLOGUE|EPILOGUE|PART)\s+([\dIVX]+|[A-Z][a-z]+)?\b", re.IGNORECASE)
_CUE_RE      = re.compile(r"^[A-Z][A-Z\s'\.]{1,28}[A-Z]\.?\s*$")

class StructuralSegmenter:
    def segment(self, all_blocks: List[Dict[str, Any]], doc_type: str) -> List[Dict[str, Any]]:
        tokens = self._tokenise(all_blocks, doc_type)
        if doc_type == "play":
            return self._build_play_hierarchy(tokens)
        return self._build_novel_hierarchy(tokens)

    def _tokenise(self, blocks: List[Dict[str, Any]], doc_type: str) -> List[Dict[str, Any]]:
        tokens = []
        for b in blocks:
            if b.get("type") != 0: continue
            for l in b.get("lines", []):
                txt = "".join([s.get("text", "") for s in l.get("spans", [])]).strip()
                if not txt: continue
                
                # Check for headings
                level, matched = self._match_heading(txt, doc_type)
                if matched:
                    # If smushed, we might want to split? 
                    # For now just treat the line as a heading if it STARTS with one.
                    tokens.append({"type": "heading", "level": level, "title": txt, "inferred": False})
                else:
                    tokens.append({"type": "content", "text": txt})
        return tokens

    def _match_heading(self, text: str, doc_type: str) -> Tuple[str, bool]:
        # For segmentation, we prefer it to be at the START of the line or very close to it
        if doc_type == "play":
            if _ACT_RE.search(text[:20]): return "act", True
            if _SCENE_RE.search(text[:20]): return "scene", True
        else:
            if _CHAPTER_RE.search(text[:20]): return "chapter", True
        return "none", False

    def _build_play_hierarchy(self, tokens: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        acts = []
        cur_act, cur_scene = None, None
        content_buffer = []

        def flush():
            if cur_scene and content_buffer:
                cur_scene["blocks"].extend(self._analyse_play_content(content_buffer))
                content_buffer.clear()

        for t in tokens:
            if t["type"] == "heading":
                if t["level"] == "act":
                    flush()
                    if cur_act and cur_scene: cur_act["children"].append(cur_scene)
                    if cur_act: acts.append(cur_act)
                    cur_act = {"id": _uid(), "title": t["title"], "children": []}
                    cur_scene = None
                elif t["level"] == "scene":
                    flush()
                    if cur_act and cur_scene: cur_act["children"].append(cur_scene)
                    if not cur_act: cur_act = {"id": _uid(), "title": "ACT I", "children": []}
                    cur_scene = {"id": _uid(), "title": t["title"], "blocks": []}
            else:
                if not cur_act: continue 
                if not cur_scene: 
                    cur_scene = {"id": _uid(), "title": "Scene 1", "blocks": []}
                content_buffer.append(t["text"])

        flush()
        if cur_act and cur_scene: cur_act["children"].append(cur_scene)
        if cur_act: acts.append(cur_act)
        return acts if acts else self._fallback_single_unit(tokens)

    def _fallback_single_unit(self, tokens):
        text = [t["text"] for t in tokens if t["type"] == "content"]
        return [{"id": _uid(), "title": "The Play", "children": [{"id": _uid(), "title": "Content", "blocks": self._analyse_play_content(text)}]}]

    def _build_novel_hierarchy(self, tokens: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        chapters = []
        cur_chapter = {"id": _uid(), "title": "Beginning", "children": [{"id": _uid(), "title": "", "paragraphs": []}]}
        for t in tokens:
            if t["type"] == "heading" and t["level"] == "chapter":
                if cur_chapter["children"][0]["paragraphs"]: chapters.append(cur_chapter)
                cur_chapter = {"id": _uid(), "title": t["title"], "children": [{"id": _uid(), "title": "", "paragraphs": []}]}
            elif t["type"] == "content":
                cur_chapter["children"][0]["paragraphs"].append(t["text"])
        if cur_chapter["children"][0]["paragraphs"]: chapters.append(cur_chapter)
        for c in chapters:
            for s in c["children"]: s["content"] = "\n\n".join(s["paragraphs"])
        return chapters

    def _analyse_play_content(self, lines: List[str]) -> List[Dict[str, Any]]:
        blocks = []
        for line in lines:
            if _CUE_RE.match(line):
                blocks.append({"type": "dialogue", "character": line, "content": ""})
            elif line.startswith("[") or line.startswith("("):
                blocks.append({"type": "stage_direction", "content": line})
            else:
                if blocks and blocks[-1]["type"] == "dialogue":
                    blocks[-1]["content"] += (" " + line if blocks[-1]["content"] else line)
                else:
                    blocks.append({"type": "narrative", "content": line})
        return blocks
