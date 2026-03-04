"""
book_brain.py
=============
Book Brain — Pre-analysis engine that computes per-book intelligence:

1. Difficulty mapping   — per-chunk difficulty scores (vocabulary, syntax, conceptual)
2. Vocabulary extraction — hard words with definitions, analogies, cultural context
3. Character graph      — character names, relationships, factions
4. Cultural context bank — cross-cultural notes for distant references
5. Predicted struggle zones — sections likely to cause difficulty

All pre-computed at upload time so the student device has instant access.
"""

from __future__ import annotations

import re
import math
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

# ── Difficulty scoring ────────────────────────────────────────────────────────

# Common English words (top 3000) — students at reading level 3-4 should know these
_COMMON_WORDS: set = {
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
    "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
    "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
    "people", "into", "year", "your", "good", "some", "could", "them", "see",
    "other", "than", "then", "now", "look", "only", "come", "its", "over",
    "think", "also", "back", "after", "use", "two", "how", "our", "work",
    "first", "well", "way", "even", "new", "want", "because", "any", "these",
    "give", "day", "most", "us", "great", "man", "woman", "old", "young",
    "house", "world", "long", "still", "own", "place", "find", "here",
    "thing", "many", "very", "much", "before", "right", "too", "mean",
    "same", "where", "help", "through", "should", "big", "little", "never",
    "small", "turn", "hand", "high", "keep", "last", "let", "begin",
    "seem", "country", "live", "leave", "read", "story", "while", "such",
    "tell", "may", "said", "was", "were", "had", "did", "been", "has",
    "are", "is", "am", "going", "went", "done", "made", "came", "got",
    "put", "run", "set", "told", "gave", "took", "found", "left",
    "boy", "girl", "mother", "father", "family", "friend", "school",
    "water", "food", "home", "night", "morning", "head", "face", "eyes",
    "door", "room", "children", "life", "love", "heart", "mind", "name",
}

# Archaic / Shakespearean words that are common in literature but hard for students
_ARCHAIC_WORDS: Dict[str, str] = {
    "thou": "you", "thee": "you", "thy": "your", "thine": "yours",
    "hath": "has", "doth": "does", "art": "are (you are)",
    "wherefore": "why", "whence": "from where", "ere": "before",
    "betwixt": "between", "forsooth": "truly", "prithee": "please",
    "methinks": "I think", "hence": "from here / therefore",
    "hither": "to here", "thither": "to there", "nay": "no",
    "perchance": "perhaps", "anon": "soon", "verily": "truly",
    "alas": "unfortunately", "oft": "often", "whilst": "while",
    "wilt": "will", "shalt": "shall", "dost": "do",
    "wouldst": "would", "couldst": "could", "shouldst": "should",
}

# Literary devices patterns
_LITERARY_DEVICE_PATTERNS = [
    (r"\blike\s+(?:a|an)\b", "simile"),
    (r"\bas\s+\w+\s+as\b", "simile"),
    (r"\bis\s+(?:a|an)\s+\w+(?:\s+\w+)?\s+(?:of|that)\b", "metaphor"),
    (r"\b(?:O|Oh)\s+\w+", "apostrophe"),
    (r"[.!?]\s*[.!?]", "ellipsis"),
]


def _syllable_count(word: str) -> int:
    """Estimate syllable count for English word."""
    word = word.lower().strip(".,!?;:'\"()-")
    if not word:
        return 0
    count = 0
    vowels = "aeiouy"
    prev_vowel = False
    for ch in word:
        is_vowel = ch in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    if word.endswith("e") and count > 1:
        count -= 1
    return max(1, count)


def _flesch_kincaid_grade(text: str) -> float:
    """Compute Flesch-Kincaid grade level for a text chunk."""
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return 5.0

    words = text.split()
    if not words:
        return 5.0

    total_syllables = sum(_syllable_count(w) for w in words)
    word_count = len(words)
    sent_count = max(len(sentences), 1)

    grade = (
        0.39 * (word_count / sent_count)
        + 11.8 * (total_syllables / word_count)
        - 15.59
    )
    return max(0, min(20, grade))


# ── Character extraction ─────────────────────────────────────────────────────

_CHARACTER_CUE_RE = re.compile(r"^[A-Z][A-Z\s'\.]{0,28}[A-Z]\.?\:?\s*$")


def _extract_characters_from_units(
    units: List[Dict[str, Any]], doc_type: str
) -> List[Dict[str, Any]]:
    """Extract character information from structured units."""
    char_lines: Dict[str, List[str]] = defaultdict(list)
    char_scenes: Dict[str, set] = defaultdict(set)
    char_interactions: Dict[str, Counter] = defaultdict(Counter)

    if doc_type == "play":
        for act in units:
            for scene in act.get("children", []):
                scene_chars_in_scene: List[str] = []
                for block in scene.get("blocks", []):
                    if block.get("type") == "dialogue" and block.get("character"):
                        char_name = block["character"].strip().upper()
                        char_lines[char_name].append(block.get("content", ""))
                        char_scenes[char_name].add(scene.get("title", ""))
                        scene_chars_in_scene.append(char_name)

                # Track co-appearances for relationship inference
                for i, c1 in enumerate(scene_chars_in_scene):
                    for c2 in scene_chars_in_scene[i + 1:]:
                        if c1 != c2:
                            char_interactions[c1][c2] += 1
                            char_interactions[c2][c1] += 1
    else:
        # Novel: extract from dialogue tags
        dialogue_re = re.compile(
            r'(?:said|replied|asked|whispered|shouted|cried|exclaimed|murmured)\s+'
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        )
        for chapter in units:
            for section in chapter.get("children", []):
                content = section.get("content", "")
                for match in dialogue_re.finditer(content):
                    name = match.group(1).strip()
                    char_lines[name].append("")
                    char_scenes[name].add(chapter.get("title", ""))

    characters = []
    for name, lines in char_lines.items():
        # Filter out very short names that are likely noise
        if len(name) < 2 or name in {"AND", "THE", "ALL", "BOTH", "ENTER", "EXIT"}:
            continue

        line_count = len(lines)
        top_interactions = char_interactions.get(name, Counter()).most_common(5)

        characters.append({
            "name": name.title(),
            "name_upper": name,
            "line_count": line_count,
            "scene_count": len(char_scenes.get(name, set())),
            "importance": "major" if line_count > 20 else "minor" if line_count > 5 else "background",
            "relationships": [
                {"character": other.title(), "co_appearances": count}
                for other, count in top_interactions
            ],
            "scenes": sorted(char_scenes.get(name, set())),
        })

    # Sort by line count (most important first)
    characters.sort(key=lambda c: c["line_count"], reverse=True)
    return characters


# ── Vocabulary extraction ─────────────────────────────────────────────────────

def _extract_vocabulary(
    units: List[Dict[str, Any]], doc_type: str, language: str = "en"
) -> List[Dict[str, Any]]:
    """Extract difficult vocabulary from the text."""
    word_freq: Counter = Counter()
    word_contexts: Dict[str, List[str]] = defaultdict(list)

    # Gather all text
    all_text_chunks: List[str] = []

    if doc_type == "play":
        for act in units:
            for scene in act.get("children", []):
                for block in scene.get("blocks", []):
                    content = block.get("content", "")
                    if content:
                        all_text_chunks.append(content)
                        words = re.findall(r"[a-zA-Z']+", content.lower())
                        for w in words:
                            word_freq[w] += 1
                            if len(word_contexts[w]) < 2:
                                # Store sentence context
                                for sent in re.split(r"[.!?]+", content):
                                    if w in sent.lower() and sent.strip():
                                        word_contexts[w].append(sent.strip()[:120])
                                        break
    else:
        for chapter in units:
            for section in chapter.get("children", []):
                content = section.get("content", "")
                if content:
                    all_text_chunks.append(content)
                    words = re.findall(r"[a-zA-Z']+", content.lower())
                    for w in words:
                        word_freq[w] += 1
                        if len(word_contexts[w]) < 2:
                            for sent in re.split(r"[.!?]+", content):
                                if w in sent.lower() and sent.strip():
                                    word_contexts[w].append(sent.strip()[:120])
                                    break

    vocab_items: List[Dict[str, Any]] = []

    for word, count in word_freq.items():
        if len(word) < 4:
            continue
        if word in _COMMON_WORDS:
            continue

        syllables = _syllable_count(word)
        is_archaic = word in _ARCHAIC_WORDS

        # Difficulty score: longer words + less common = harder
        difficulty = min(1.0, (syllables - 1) * 0.15 + 0.3)
        if is_archaic:
            difficulty = min(1.0, difficulty + 0.3)

        if difficulty < 0.35:
            continue

        entry: Dict[str, Any] = {
            "word": word,
            "frequency": count,
            "syllables": syllables,
            "difficulty": round(difficulty, 2),
            "contexts": word_contexts.get(word, [])[:2],
        }

        if is_archaic:
            entry["archaic"] = True
            entry["modern_meaning"] = _ARCHAIC_WORDS[word]

        vocab_items.append(entry)

    # Sort by difficulty descending, then by frequency descending
    vocab_items.sort(key=lambda v: (-v["difficulty"], -v["frequency"]))
    return vocab_items[:150]  # Top 150 hardest words


# ── Difficulty mapping ────────────────────────────────────────────────────────

def _compute_difficulty_map(
    units: List[Dict[str, Any]], doc_type: str
) -> List[Dict[str, Any]]:
    """Compute per-unit difficulty scores."""
    difficulty_map: List[Dict[str, Any]] = []

    if doc_type == "play":
        for act in units:
            for scene in act.get("children", []):
                text_parts = []
                for block in scene.get("blocks", []):
                    text_parts.append(block.get("content", ""))
                full_text = " ".join(text_parts)

                if not full_text.strip():
                    continue

                words = full_text.split()
                word_count = len(words)
                fk_grade = _flesch_kincaid_grade(full_text)

                # Count archaic words
                archaic_count = sum(
                    1 for w in words
                    if w.lower().strip(".,!?;:'\"()") in _ARCHAIC_WORDS
                )

                # Count long words (3+ syllables)
                long_words = sum(1 for w in words if _syllable_count(w) >= 3)

                # Detect literary devices
                devices_found = []
                for pattern, device_name in _LITERARY_DEVICE_PATTERNS:
                    if re.search(pattern, full_text, re.IGNORECASE):
                        devices_found.append(device_name)

                # Composite difficulty [0, 1]
                vocab_difficulty = min(1.0, (archaic_count / max(word_count, 1)) * 10 + (long_words / max(word_count, 1)) * 3)
                syntax_difficulty = min(1.0, fk_grade / 15)
                conceptual = min(1.0, len(devices_found) * 0.2)

                overall = 0.4 * vocab_difficulty + 0.35 * syntax_difficulty + 0.25 * conceptual

                difficulty_map.append({
                    "unit_title": act.get("title", ""),
                    "section_title": scene.get("title", ""),
                    "section_id": scene.get("id", ""),
                    "word_count": word_count,
                    "flesch_kincaid_grade": round(fk_grade, 1),
                    "vocab_difficulty": round(vocab_difficulty, 3),
                    "syntax_difficulty": round(syntax_difficulty, 3),
                    "conceptual_difficulty": round(conceptual, 3),
                    "overall_difficulty": round(overall, 3),
                    "archaic_word_count": archaic_count,
                    "long_word_count": long_words,
                    "literary_devices": devices_found,
                    "predicted_struggle": overall > 0.6,
                    "estimated_read_minutes": max(1, round(word_count / 150, 1)),
                })
    else:
        for chapter in units:
            for section in chapter.get("children", []):
                content = section.get("content", "")
                if not content.strip():
                    continue

                words = content.split()
                word_count = len(words)
                fk_grade = _flesch_kincaid_grade(content)

                long_words = sum(1 for w in words if _syllable_count(w) >= 3)
                vocab_difficulty = min(1.0, (long_words / max(word_count, 1)) * 3)
                syntax_difficulty = min(1.0, fk_grade / 15)

                devices_found = []
                for pattern, device_name in _LITERARY_DEVICE_PATTERNS:
                    if re.search(pattern, content, re.IGNORECASE):
                        devices_found.append(device_name)

                conceptual = min(1.0, len(devices_found) * 0.2)
                overall = 0.4 * vocab_difficulty + 0.35 * syntax_difficulty + 0.25 * conceptual

                difficulty_map.append({
                    "unit_title": chapter.get("title", ""),
                    "section_title": section.get("title", ""),
                    "section_id": section.get("id", ""),
                    "word_count": word_count,
                    "flesch_kincaid_grade": round(fk_grade, 1),
                    "vocab_difficulty": round(vocab_difficulty, 3),
                    "syntax_difficulty": round(syntax_difficulty, 3),
                    "conceptual_difficulty": round(conceptual, 3),
                    "overall_difficulty": round(overall, 3),
                    "long_word_count": long_words,
                    "literary_devices": devices_found,
                    "predicted_struggle": overall > 0.6,
                    "estimated_read_minutes": max(1, round(word_count / 150, 1)),
                })

    return difficulty_map


# ── Book Brain Orchestrator ───────────────────────────────────────────────────

@dataclass
class BookBrainResult:
    """Complete pre-analysis for a book."""
    difficulty_map:  List[Dict[str, Any]]
    vocabulary:      List[Dict[str, Any]]
    characters:      List[Dict[str, Any]]
    summary_stats:   Dict[str, Any]
    struggle_zones:  List[Dict[str, Any]]


class BookBrain:
    """
    Pre-analyzes an entire book at upload time.

    Usage:
        brain = BookBrain()
        result = brain.analyze(units, doc_type="play", language="en", title="Macbeth")
    """

    def analyze(
        self,
        units: List[Dict[str, Any]],
        doc_type: str = "generic",
        language: str = "en",
        title: str = "",
        author: str = "",
    ) -> BookBrainResult:
        # 1. Difficulty mapping
        difficulty_map = _compute_difficulty_map(units, doc_type)

        # 2. Vocabulary extraction
        vocabulary = _extract_vocabulary(units, doc_type, language)

        # 3. Character graph
        characters = _extract_characters_from_units(units, doc_type)

        # 4. Summary statistics
        total_words = sum(d["word_count"] for d in difficulty_map)
        avg_difficulty = (
            sum(d["overall_difficulty"] for d in difficulty_map) / len(difficulty_map)
            if difficulty_map else 0
        )
        total_read_mins = sum(d.get("estimated_read_minutes", 0) for d in difficulty_map)

        # 5. Struggle zones (sections with difficulty > 0.6)
        struggle_zones = [
            {
                "unit_title": d["unit_title"],
                "section_title": d["section_title"],
                "section_id": d["section_id"],
                "overall_difficulty": d["overall_difficulty"],
                "reason": self._struggle_reason(d),
            }
            for d in difficulty_map
            if d.get("predicted_struggle", False)
        ]

        summary_stats = {
            "title": title,
            "author": author,
            "doc_type": doc_type,
            "language": language,
            "total_words": total_words,
            "total_sections": len(difficulty_map),
            "average_difficulty": round(avg_difficulty, 3),
            "estimated_total_read_minutes": round(total_read_mins, 1),
            "vocabulary_count": len(vocabulary),
            "character_count": len(characters),
            "major_characters": len([c for c in characters if c["importance"] == "major"]),
            "struggle_zone_count": len(struggle_zones),
            "archaic_words_present": any(v.get("archaic") for v in vocabulary),
        }

        return BookBrainResult(
            difficulty_map=difficulty_map,
            vocabulary=vocabulary,
            characters=characters,
            summary_stats=summary_stats,
            struggle_zones=struggle_zones,
        )

    def _struggle_reason(self, d: Dict[str, Any]) -> str:
        reasons = []
        if d.get("vocab_difficulty", 0) > 0.5:
            reasons.append("complex vocabulary")
        if d.get("syntax_difficulty", 0) > 0.5:
            reasons.append("complex sentence structure")
        if d.get("archaic_word_count", 0) > 3:
            reasons.append("archaic language")
        if d.get("conceptual_difficulty", 0) > 0.3:
            reasons.append("literary devices")
        return "; ".join(reasons) if reasons else "overall complexity"
