"""
ner_extractor.py
================
NER-based Character & Entity Graph Extractor for IncludEd 2.0.

Processes a full book section-by-section to produce:
  1. Character list with importance, first appearance, description
  2. Relationship graph (co-occurrence + dialogue + context-inferred type)
  3. Location/setting list
  4. Spoiler-safe: only exposes characters seen up to current section index

Pipeline:
  Tier 1 — BERT NER   (dbmdz/bert-large-cased-finetuned-conll03-english)
  Tier 2 — spaCy NER  (en_core_web_sm)
  Tier 3 — Regex heuristics (ALL-CAPS dialogue names, Title-Case after verbs)

Output schema (matches CharacterMapPanel.tsx):
  {
    "characters": [
      {
        "name":             str,
        "importance":       "major" | "minor" | "background",
        "first_seen_index": int,          # section index (0-based)
        "description":      str,
        "faction":          str | None,   # montague / capulet / etc.
        "section_count":    int,          # how many sections they appear in
        "relationships": [
          { "target": str, "type": str, "count": int }
        ]
      }
    ],
    "relationships": [
      { "source": str, "target": str, "type": str, "count": int }
    ],
    "locations": [
      { "name": str, "first_seen_index": int, "section_count": int }
    ]
  }
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple


# ── Optional heavy models (lazy-loaded) ───────────────────────────────────────

_BERT_PIPELINE:  Optional[Any] = None
_SPACY_NLP:      Optional[Any] = None
_BERT_OK  = False
_SPACY_OK = False

try:
    from transformers import pipeline as _hf_pipeline
    _BERT_OK = True
except ImportError:
    pass

try:
    import spacy as _spacy_mod
    _SPACY_OK = True
except ImportError:
    pass


# ── Constants ─────────────────────────────────────────────────────────────────

_BERT_NER_MODEL = "dbmdz/bert-large-cased-finetuned-conll03-english"
_BERT_CHUNK     = 1800   # chars per BERT chunk (512-token safe)

# Words that look like names but are structural noise
_NOISE_NAMES: Set[str] = {
    "I", "A", "The", "An", "Act", "Scene", "Chapter", "Part",
    "Enter", "Exit", "Exeunt", "Lord", "Lady", "Man", "Woman",
    "He", "She", "They", "We", "You", "Narrator", "All", "Both",
    "First", "Second", "Third", "Re", "End",
}

# Relationship inference keyword sets
_REL_LOVE     = {"love", "kiss", "marry", "wife", "husband", "beloved", "sweetheart", "adore", "affection", "heart", "darling"}
_REL_CONFLICT = {"fight", "kill", "murder", "hate", "enemy", "oppose", "attack", "sword", "duel", "quarrel", "feud", "threaten", "betray"}
_REL_FAMILY   = {"father", "mother", "son", "daughter", "brother", "sister", "uncle", "aunt", "cousin", "parent", "child", "family", "kin", "heir"}
_REL_FRIEND   = {"friend", "ally", "companion", "loyal", "trust", "side", "together", "fellow"}
_REL_SERVANT  = {"servant", "nurse", "maid", "master", "mistress", "obey", "serve", "orders"}

# Factions inferred from common literary works
_FACTION_KEYWORDS: Dict[str, List[str]] = {
    "montague": ["montague", "romeo", "benvolio", "mercutio", "abraham"],
    "capulet":  ["capulet", "juliet", "tybalt", "paris", "nurse"],
    "roman":    ["caesar", "brutus", "cassius", "antony", "casca", "calpurnia"],
    "danish":   ["hamlet", "claudius", "gertrude", "polonius", "ophelia", "laertes", "horatio"],
}


# ── Model loaders ─────────────────────────────────────────────────────────────

def _load_bert() -> bool:
    global _BERT_PIPELINE
    if _BERT_PIPELINE is not None:
        return True
    if not _BERT_OK:
        return False
    try:
        print(f"🔬 NER: Loading BERT ({_BERT_NER_MODEL})…")
        _BERT_PIPELINE = _hf_pipeline(
            "ner", model=_BERT_NER_MODEL, aggregation_strategy="simple"
        )
        print("✅ NER: BERT ready")
        return True
    except Exception as e:
        print(f"⚠️  NER: BERT load failed ({e}), will try spaCy")
        _BERT_PIPELINE = None
        return False


def _load_spacy() -> bool:
    global _SPACY_NLP
    if _SPACY_NLP is not None:
        return True
    if not _SPACY_OK:
        return False
    try:
        print("🔬 NER: Loading spaCy en_core_web_sm…")
        _SPACY_NLP = _spacy_mod.load("en_core_web_sm")
        print("✅ NER: spaCy ready")
        return True
    except Exception as e:
        print(f"⚠️  NER: spaCy load failed ({e}), will use regex")
        _SPACY_NLP = None
        return False


# ── Low-level extraction helpers ──────────────────────────────────────────────

def _chunk_text(text: str, size: int = _BERT_CHUNK) -> List[str]:
    words = text.split()
    chunks, buf, buf_len = [], [], 0
    step = size // 2
    for w in words:
        buf.append(w)
        buf_len += len(w) + 1
        if buf_len >= size:
            chunks.append(" ".join(buf))
            buf = buf[-step:]
            buf_len = sum(len(w) + 1 for w in buf)
    if buf:
        chunks.append(" ".join(buf))
    return chunks or [text]


def _bert_extract(text: str) -> Tuple[List[str], List[str]]:
    """Return (person_names, location_names) using BERT NER."""
    persons, locs = [], []
    seen_p: Set[str] = set()
    seen_l: Set[str] = set()
    for chunk in _chunk_text(text):
        try:
            for ent in _BERT_PIPELINE(chunk):
                name = ent["word"].strip().title()
                if len(name) < 2 or name in _NOISE_NAMES:
                    continue
                if ent["entity_group"] == "PER" and name not in seen_p:
                    persons.append(name)
                    seen_p.add(name)
                elif ent["entity_group"] in ("LOC", "GPE") and name not in seen_l:
                    locs.append(name)
                    seen_l.add(name)
        except Exception:
            pass
    return persons, locs


def _spacy_extract(text: str) -> Tuple[List[str], List[str]]:
    """Return (person_names, location_names) using spaCy NER."""
    persons, locs = [], []
    seen_p: Set[str] = set()
    seen_l: Set[str] = set()
    # spaCy doc max ~1M chars; chunk to be safe
    for chunk in _chunk_text(text, size=50000):
        doc = _SPACY_NLP(chunk)
        for ent in doc.ents:
            name = ent.text.strip().title()
            if len(name) < 2 or name in _NOISE_NAMES:
                continue
            if ent.label_ == "PERSON" and name not in seen_p:
                persons.append(name)
                seen_p.add(name)
            elif ent.label_ in ("GPE", "LOC", "FAC") and name not in seen_l:
                locs.append(name)
                seen_l.add(name)
    return persons, locs


def _regex_extract(text: str) -> Tuple[List[str], List[str]]:
    """Heuristic fallback: extract Title-Case names from dialogue and ALL-CAPS cues."""
    persons: List[str] = []
    seen_p: Set[str] = set()

    # Dialogue speaker pattern: NAME. or NAME:
    for m in re.finditer(r"^([A-Z][A-Z\s]{1,20})[.:]", text, re.MULTILINE):
        name = m.group(1).strip().title()
        if name not in _NOISE_NAMES and name not in seen_p and len(name) >= 2:
            persons.append(name)
            seen_p.add(name)

    # Speech verb pattern: "said Romeo", "Romeo replied"
    for m in re.finditer(
        r'(?:said|replied|asked|whispered|shouted|cried|exclaimed|murmured|answered|called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        text
    ):
        name = m.group(1).strip()
        if name not in _NOISE_NAMES and name not in seen_p and len(name) >= 2:
            persons.append(name)
            seen_p.add(name)

    return persons, []


def _extract_names(text: str) -> Tuple[List[str], List[str]]:
    """Dispatch to best available NER tier."""
    if _load_bert():
        return _bert_extract(text)
    if _load_spacy():
        return _spacy_extract(text)
    return _regex_extract(text)


# ── Relationship inference ─────────────────────────────────────────────────────

def _infer_rel_type(sentence: str) -> str:
    """Infer a relationship type label from a sentence containing two names."""
    s = sentence.lower()
    if any(w in s for w in _REL_LOVE):
        return "love_interest"
    if any(w in s for w in _REL_CONFLICT):
        return "conflict"
    if any(w in s for w in _REL_FAMILY):
        return "family"
    if any(w in s for w in _REL_SERVANT):
        return "master_servant"
    if any(w in s for w in _REL_FRIEND):
        return "friendship"
    return "associated"


def _build_cooccurrence(
    sections: List[str],
    character_sections: Dict[str, Set[int]],
) -> Dict[Tuple[str, str], Dict[str, Any]]:
    """
    For each pair of characters that co-occur in the same paragraph,
    record the count and infer relationship type from context.
    """
    names = list(character_sections.keys())
    pairs: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for sec_idx, section_text in enumerate(sections):
        # Split into paragraphs
        paragraphs = re.split(r"\n{2,}", section_text)
        for para in paragraphs:
            para_lower = para.lower()
            present = [n for n in names if n.lower() in para_lower]
            if len(present) < 2:
                continue
            # Record all pairs in this paragraph
            sentences = re.split(r"(?<=[.!?])\s+", para)
            for i in range(len(present)):
                for j in range(i + 1, len(present)):
                    a, b = sorted([present[i], present[j]])
                    key = (a, b)
                    if key not in pairs:
                        pairs[key] = {"count": 0, "type": "associated", "types": Counter()}
                    pairs[key]["count"] += 1
                    # Try to find a sentence where both appear for type inference
                    for sent in sentences:
                        sl = sent.lower()
                        if a.lower() in sl and b.lower() in sl:
                            rel = _infer_rel_type(sent)
                            pairs[key]["types"][rel] += 1
                            break

    # Resolve most common type for each pair
    for key, data in pairs.items():
        if data["types"]:
            data["type"] = data["types"].most_common(1)[0][0]
        del data["types"]

    return pairs


def _infer_faction(name: str) -> Optional[str]:
    """Infer character faction from name lookup."""
    n = name.lower()
    for faction, members in _FACTION_KEYWORDS.items():
        if any(member in n for member in members):
            return faction
    return None


def _score_importance(section_count: int, total_sections: int) -> str:
    """Classify character importance by how many sections they appear in."""
    if total_sections == 0:
        return "background"
    ratio = section_count / total_sections
    if ratio >= 0.3:
        return "major"
    if ratio >= 0.1:
        return "minor"
    return "background"


# ── Public API ────────────────────────────────────────────────────────────────

class NERExtractor:
    """
    Extract a full character graph from a list of section texts.

    Usage:
        extractor = NERExtractor()
        graph = extractor.extract(sections=["Act 1 text...", "Act 2 text..."])
    """

    def extract(
        self,
        sections: List[str],
        title: str = "",
        existing_characters: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Process all sections and build the complete character/entity graph.

        Parameters
        ----------
        sections:
            List of section texts in reading order (index = section number).
        title:
            Book/play title (used to avoid treating it as a character).
        existing_characters:
            Optional pre-seeded character names (from dialogue tags, etc.).

        Returns
        -------
        Full graph dict (see module docstring for schema).
        """
        # Track which sections each character/location appears in
        char_sections: Dict[str, Set[int]]  = defaultdict(set)
        loc_sections:  Dict[str, Set[int]]  = defaultdict(set)

        # Seed from existing characters if provided
        if existing_characters:
            for name in existing_characters:
                clean = name.strip().title()
                if clean and clean not in _NOISE_NAMES:
                    char_sections[clean]  # just ensure key exists

        title_words = set(title.lower().split()) if title else set()

        # ── Pass 1: Extract names per section ─────────────────────────────────
        for sec_idx, text in enumerate(sections):
            persons, locs = _extract_names(text)

            for name in persons:
                # Skip if name is a title word
                if name.lower() in title_words:
                    continue
                char_sections[name].add(sec_idx)

            for loc in locs:
                if loc.lower() not in title_words:
                    loc_sections[loc].add(sec_idx)

        total = len(sections)

        # ── Pass 2: Build co-occurrence relationship graph ────────────────────
        pairs = _build_cooccurrence(sections, char_sections)

        # ── Assemble character list ────────────────────────────────────────────
        characters = []
        for name, sec_set in sorted(char_sections.items(), key=lambda x: min(x[1]) if x[1] else 9999):
            if not sec_set:
                sec_set = {0}
            section_count = len(sec_set)
            importance    = _score_importance(section_count, total)
            faction       = _infer_faction(name)

            # Build this character's relationship list
            char_rels = []
            for (a, b), data in pairs.items():
                if a == name:
                    char_rels.append({"target": b, "type": data["type"], "count": data["count"]})
                elif b == name:
                    char_rels.append({"target": a, "type": data["type"], "count": data["count"]})
            char_rels.sort(key=lambda r: r["count"], reverse=True)

            characters.append({
                "name":             name,
                "importance":       importance,
                "first_seen_index": min(sec_set),
                "description":      "",   # filled later by CharacterService / Gemini
                "faction":          faction,
                "section_count":    section_count,
                "relationships":    char_rels,
            })

        # Sort: major first, then by first appearance
        _order = {"major": 0, "minor": 1, "background": 2}
        characters.sort(key=lambda c: (_order[c["importance"]], c["first_seen_index"]))

        # ── Assemble flat relationship list ────────────────────────────────────
        relationships = [
            {"source": a, "target": b, "type": data["type"], "count": data["count"]}
            for (a, b), data in sorted(pairs.items(), key=lambda x: x[1]["count"], reverse=True)
        ]

        # ── Assemble location list ─────────────────────────────────────────────
        locations = [
            {
                "name":             loc,
                "first_seen_index": min(sec_set),
                "section_count":    len(sec_set),
            }
            for loc, sec_set in sorted(loc_sections.items(), key=lambda x: min(x[1]))
        ]

        return {
            "characters":    characters,
            "relationships": relationships,
            "locations":     locations,
        }

    def extract_for_section(
        self,
        full_graph: Dict[str, Any],
        up_to_section: int,
    ) -> Dict[str, Any]:
        """
        Return a spoiler-safe view of the graph — only characters/locations
        first seen at or before ``up_to_section``.
        Used by the frontend CharacterMapPanel.
        """
        safe_chars = [
            c for c in full_graph["characters"]
            if c["first_seen_index"] <= up_to_section
        ]
        safe_names = {c["name"] for c in safe_chars}

        safe_rels = [
            r for r in full_graph["relationships"]
            if r["source"] in safe_names and r["target"] in safe_names
        ]

        safe_locs = [
            l for l in full_graph["locations"]
            if l["first_seen_index"] <= up_to_section
        ]

        return {
            "characters":    safe_chars,
            "relationships": safe_rels,
            "locations":     safe_locs,
        }


# ── Module singleton ──────────────────────────────────────────────────────────

_extractor: Optional[NERExtractor] = None

def get_ner_extractor() -> NERExtractor:
    global _extractor
    if _extractor is None:
        _extractor = NERExtractor()
    return _extractor
