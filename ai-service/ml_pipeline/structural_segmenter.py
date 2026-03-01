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
# Direct regex for structural headings to avoid backtracking
_ACT_RE      = re.compile(r"^\bACT\s+([IVX]+|\d+)\b\.?$", re.IGNORECASE)
_SCENE_RE    = re.compile(r"^\bSCENE\s+([IVX]+|\d+)\b\.?$", re.IGNORECASE)

# permissive versions for smushed detection
_SMUSHED_ACT_RE   = re.compile(r"\bACT\s+([IVX]+|\d+)\b", re.IGNORECASE)
_SMUSHED_SCENE_RE = re.compile(r"\bSCENE\s+([IVX]+|\d+)\b", re.IGNORECASE)

_CHAPTER_RE  = re.compile(r"^(?:[\d\s]*)?\b(CHAPTER|PROLOGUE|EPILOGUE|PART)\s+([\dIVX]+|[A-Z][a-z]+)?\b", re.IGNORECASE)
_CUE_RE      = re.compile(r"^[A-Z][A-Z\s'\.]{1,28}[A-Z]\.?\s*$")

class StructuralSegmenter:
    def segment(self, all_blocks: List[Dict[str, Any]], doc_type: str) -> List[Dict[str, Any]]:
        # Pre-process: detect front-matter (TOC, intros) by looking for dense heading clusters
        tokens = self._tokenise(all_blocks, doc_type)
        if doc_type == "play":
            return self._build_play_hierarchy(tokens)
        return self._build_novel_hierarchy(tokens)

    def _tokenise(self, blocks: List[Dict[str, Any]], doc_type: str) -> List[Dict[str, Any]]:
        tokens = []
        for b in blocks:
            if b.get("type") != 0: continue
            for l in b.get("lines", []):
                line_txt = "".join([s.get("text", "") for s in l.get("spans", [])]).strip()
                if not line_txt: continue
                
                # For long lines (like single-line DB extracts), we search for ALL headings at once.
                # 1. Collect all potential heading matches
                matches = []
                if doc_type == "play":
                    for m in _SMUSHED_ACT_RE.finditer(line_txt):
                        matches.append(("act", m))
                    for m in _SMUSHED_SCENE_RE.finditer(line_txt):
                        matches.append(("scene", m))
                else:
                    for m in _CHAPTER_RE.finditer(line_txt):
                        matches.append(("chapter", m))
                
                # 2. Sort matches by position
                matches.sort(key=lambda x: x[1].start())
                
                # 3. Filter and emit tokens
                last_pos = 0
                for level, m in matches:
                    start, end = m.span()
                    match_txt = m.group(0)
                    
                    # NOISE FILTER: Page headers like '187 Macbeth ACT 5'
                    # Headings bury deep in prose with lowercase nearby (except 'Scene') are likely noise.
                    # We check a small window around the match for lowercase noise.
                    window = line_txt[max(0, start-20):min(len(line_txt), end+20)]
                    has_lowercase = any(c.islower() for c in window if c.isalpha())
                    if has_lowercase and "Scene" not in match_txt and "Scene" not in window:
                        continue
                    
                    # Content before the heading
                    before = line_txt[last_pos:start].strip()
                    if before:
                        tokens.append({"type": "content", "text": before})
                    
                    # The heading
                    tokens.append({"type": "heading", "level": level, "title": match_txt, "inferred": False})
                    last_pos = end
                
                # Remaining content after last heading
                after = line_txt[last_pos:].strip()
                if after:
                    tokens.append({"type": "content", "text": after})
                    
        return tokens

    def _search_heading(self, text: str, doc_type: str) -> Tuple[str, Optional[re.Match]]:
        if not text or len(text) < 3: return "none", None
        
        # Performance: structural headings are almost always at the start or early on.
        # We limit the search to the first 128 characters to avoid O(N) regex scanning on massive strings.
        search_text = text[:128]
        
        if doc_type == "play":
            # 1. Straight match (standalone heading)
            m = _ACT_RE.match(search_text)
            if m: return "act", m
            m = _SCENE_RE.match(search_text)
            if m: return "scene", m
            
            # 2. Search match (smushed in intro or TOC)
            # Avoid page noise (headers like '187 Macbeth ACT 5. SC. 8')
            if any(c.islower() for c in search_text if c.isalpha()) and "Scene" not in search_text:
                return "none", None

            m = _SMUSHED_ACT_RE.search(search_text)
            if m: return "act", m
            m = _SMUSHED_SCENE_RE.search(search_text)
            if m: return "scene", m
        else:
            m = _CHAPTER_RE.match(search_text)
            if m: return "chapter", m
        return "none", None

    def _build_play_hierarchy(self, tokens: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        acts = []
        cur_act, cur_scene = None, None
        content_buffer = []

        def flush():
            if cur_scene and content_buffer:
                cur_scene["blocks"].extend(self._analyse_play_content(content_buffer))
                content_buffer.clear()

        # TOC and Front-Matter skipping logic
        first_heading_found = False
        
        # Enhanced TOC cluster detection: Check for dense headings with LITTLE content between them.
        toc_indices = set()
        num_tokens = len(tokens)
        for i in range(num_tokens):
            if tokens[i]["type"] == "heading":
                # Check next 8 tokens
                lookahead_limit = min(i + 8, num_tokens)
                cluster_indices = [j for j in range(i, lookahead_limit) if tokens[j]["type"] == "heading"]
                if len(cluster_indices) >= 4:
                    # Check total content length between these headings
                    content_length = sum(len(tokens[j].get("text", "")) for j in range(cluster_indices[0], cluster_indices[-1]) if tokens[j]["type"] == "content")
                    if content_length < 200: # Very little content -> likely TOC
                        for idx in cluster_indices:
                            toc_indices.add(idx)

        for i, t in enumerate(tokens):
            if t["type"] == "heading":
                # Skip if it's part of a TOC cluster
                if i in toc_indices:
                    continue
                
                # Further noise filtering: ignore headings that look like they repeat the current state
                # (prevents page headers like 'ACT 5' from splitting a scene)
                if t["level"] == "act" and cur_act and t["title"].upper() in cur_act["title"].upper():
                    continue
                
                # Relaxed noise filter for REAL plays: if an ACT is followed by a SCENE, it's likely real.
                next_t = tokens[i+1] if i+1 < num_tokens else None
                is_scened_act = (t["level"] == "act" and next_t and next_t["level"] == "scene")
                
                if not is_scened_act:
                    # Apply stricter noise filtering for standalone-looking headings
                    # (Checks for page noise like 'Macbeth ACT 5')
                    search_text = t["title"]
                    # If we have lowercase in the original line around this match...
                    # (This logic is already in _tokenise, but we double-check here if needed)
                    pass

                # If it's a scene heading but we have no Act yet, start ACT I
                if t["level"] == "scene" and not cur_act:
                    cur_act = {"id": _uid(), "title": "ACT I", "children": []}

                first_heading_found = True
                
                if t["level"] == "act":
                    # Only switch acts if we have SOME content/scenes in the current one
                    # or if the title is actually different.
                    flush()
                    if cur_act and (cur_act["children"] or content_buffer):
                        if cur_scene: cur_act["children"].append(cur_scene)
                        acts.append(cur_act)
                        cur_act = {"id": _uid(), "title": t["title"], "children": []}
                        cur_scene = None
                    elif not cur_act:
                        cur_act = {"id": _uid(), "title": t["title"], "children": []}
                        cur_scene = None
                elif t["level"] == "scene":
                    flush()
                    if cur_act and cur_scene: cur_act["children"].append(cur_scene)
                    cur_scene = {"id": _uid(), "title": t["title"], "blocks": []}
            else:
                if not first_heading_found:
                    continue
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
            # PERFORMANCE: Skip expensive regex/matching on extremely long lines.
            # Character cues and stage directions are never 1000+ chars.
            if len(line) > 1000:
                if blocks and blocks[-1]["type"] == "dialogue":
                    blocks[-1]["content"] += (" " + line if blocks[-1]["content"] else line)
                else:
                    blocks.append({"type": "narrative", "content": line})
                continue

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
