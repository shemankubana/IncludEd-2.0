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
from services.gemini_service import GeminiService

# ── FLAN-T5 vocab pipeline (lazy-loaded) ──────────────────────────────────────

_FLANT5_VOCAB_PIPELINE: Optional[Any] = None
_FLANT5_MODEL = "google/flan-t5-base"
_FLANT5_OK = False

try:
    from transformers import pipeline as _hf_pipeline
    _FLANT5_OK = True
except ImportError:
    pass


def _load_flant5_vocab() -> bool:
    global _FLANT5_VOCAB_PIPELINE
    if _FLANT5_VOCAB_PIPELINE is not None:
        return True
    if not _FLANT5_OK:
        return False
    try:
        print(f"🔬 Loading FLAN-T5 vocab pipeline ({_FLANT5_MODEL}) …")
        _FLANT5_VOCAB_PIPELINE = _hf_pipeline(
            "text2text-generation",
            model=_FLANT5_MODEL,
            max_new_tokens=300,
        )
        print("✅ FLAN-T5 vocab ready")
        return True
    except Exception as exc:
        print(f"⚠️  FLAN-T5 vocab load failed: {exc}")
        _FLANT5_VOCAB_PIPELINE = None
        return False

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

# Emotion keyword bank — lightweight, no ML models needed
_EMOTION_KEYWORDS: Dict[str, List[str]] = {
    "joy":      ["laugh", "smile", "happy", "joy", "delight", "celebrate", "cheer", "merry", "glad", "rejoice", "feast", "dance", "sing", "triumph", "victory"],
    "anger":    ["anger", "rage", "furious", "wrath", "hate", "fury", "curse", "shout", "scream", "violent", "bitter", "wrathful", "indignant", "hostile"],
    "fear":     ["fear", "terror", "dread", "tremble", "horror", "afraid", "ghost", "witch", "dark", "death", "flee", "cower", "shiver", "nightmare", "ominous"],
    "sadness":  ["weep", "cry", "mourn", "grief", "tears", "sad", "sorrow", "lament", "wail", "despair", "misery", "anguish", "pity", "loss", "bereaved"],
    "surprise": ["shock", "sudden", "unexpected", "astonish", "gasp", "startle", "amaze", "wonder", "discover", "reveal", "exclaim"],
    "disgust":  ["disgust", "filth", "vile", "corrupt", "rotten", "shame", "foul", "wicked", "loathe", "abhor", "repulse"],
    "tension":  ["confront", "threaten", "danger", "warn", "challenge", "defy", "accuse", "suspect", "conflict", "betray", "ambush", "sword", "knife"],
}

# Setting patterns — stage directions and location keywords
_SETTING_RE = re.compile(
    r"(?:^\s*\[([^\]]+)\]|"          # [stage direction]
    r"^\s*\(([^)]+)\)|"              # (stage direction)
    r"\b(?:in|at|near|inside|outside|within|before|upon)\s+"
    r"(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*))",
    re.MULTILINE,
)

# Cultural context bank — pre-built notes for challenging literary concepts
# Mapped to Rwandan/East African student context
_CULTURAL_CONTEXT_BANK: List[Dict[str, str]] = [
    {"phrase": "honour thy father",     "context_note": "In Igbo culture (like Rwanda), respect for parents and elders is a core value."},
    {"phrase": "chi",                   "context_note": "Chi is a personal spirit/guardian in Igbo belief — similar to the concept of umwuka in Kinyarwanda tradition."},
    {"phrase": "efulefu",               "context_note": "Efulefu means a worthless, hollow man in Igbo — someone who abandons their community's values."},
    {"phrase": "egwugwu",               "context_note": "Egwugwu are masked spirit figures representing ancestors. Think of them like the guardians of community law and tradition."},
    {"phrase": "bride price",           "context_note": "Like inkwano (bride wealth) in Rwanda, this is a gift from the groom's family to honor the bride's family."},
    {"phrase": "oracle",                "context_note": "A sacred voice believed to speak for the gods — similar to traditional spiritual advisors in Rwandan culture."},
    {"phrase": "wherefore art thou",    "context_note": "'Wherefore' means 'why', not 'where'. Juliet is asking why Romeo must be a Montague (her enemy), not asking where he is."},
    {"phrase": "to be or not to be",    "context_note": "Hamlet is contemplating whether life is worth living when facing great suffering — a universal human question."},
    {"phrase": "the quality of mercy",  "context_note": "Shakespeare argues that showing mercy (forgiveness) is more powerful than strict law — a divine quality."},
    {"phrase": "district commissioner", "context_note": "The representative of British colonial authority in Nigeria — like administrative officials imposed during colonization."},
    {"phrase": "white man",             "context_note": "In this colonial-era context, refers to European missionaries and administrators who came to change African traditions."},
    {"phrase": "pale faced",            "context_note": "A description used to emphasize cultural difference between African and European characters."},
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


def _detect_emotion(text: str) -> str:
    """Detect the dominant emotion in a text chunk using keyword matching."""
    text_lower = text.lower()
    scores: Dict[str, int] = {emotion: 0 for emotion in _EMOTION_KEYWORDS}
    for emotion, keywords in _EMOTION_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                scores[emotion] += 1
    best_score = max(scores.values())
    if best_score == 0:
        return "neutral"
    return max(scores, key=lambda e: scores[e])


def _detect_setting(text: str) -> str:
    """Extract the first detectable setting from text (stage directions or location phrases)."""
    for match in _SETTING_RE.finditer(text):
        direction = match.group(1) or match.group(2)
        location = match.group(3)
        if direction and len(direction) < 80:
            return direction.strip()
        if location:
            return location.strip()
    return ""


def _archaic_phrases_in(text: str) -> List[Dict[str, str]]:
    """Return list of archaic words found in text with their modern meanings."""
    text_lower = text.lower()
    found = []
    seen: set = set()
    for word, modern in _ARCHAIC_WORDS.items():
        if word in text_lower and word not in seen:
            seen.add(word)
            found.append({"word": word, "modern_meaning": modern})
    return found


def _characters_present_in(text: str, char_names: List[str]) -> List[str]:
    """Return which known character names appear in the given text."""
    text_lower = text.lower()
    present = []
    for name in char_names:
        if name.lower() in text_lower or name.upper() in text:
            present.append(name)
    return present


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
    units: List[Dict[str, Any]], doc_type: str, gemini: Optional[GeminiService] = None
) -> List[Dict[str, Any]]:
    """Extract character information from structured units with flat indexing (Phase 3)."""
    char_lines: Dict[str, List[str]] = defaultdict(list)
    char_scenes: Dict[str, set] = defaultdict(set)
    char_interactions: Dict[str, Counter] = defaultdict(Counter)
    char_first_seen: Dict[str, int] = {}
    char_all_seen: Dict[str, List[int]] = defaultdict(list)

    flat_idx = 0
    if doc_type == "play":
        for act_idx, act in enumerate(units):
            for scene_idx, scene in enumerate(act.get("children", [])):
                scene_chars_in_scene: set = set()
                for block in scene.get("blocks", []):
                    if block.get("type") == "dialogue" and block.get("character"):
                        char_name = block["character"].strip().upper()
                        # Clean common play noise (ENTER, EXIT, etc handled below)
                        char_lines[char_name].append(block.get("content", ""))
                        char_scenes[char_name].add(scene.get("title", f"Act {act_idx+1} Scene {scene_idx+1}"))
                        scene_chars_in_scene.add(char_name)
                        
                        if char_name not in char_first_seen:
                            char_first_seen[char_name] = flat_idx
                        if flat_idx not in char_all_seen[char_name]:
                            char_all_seen[char_name].append(flat_idx)

                # Track co-appearances
                chars_list = list(scene_chars_in_scene)
                for i, c1 in enumerate(chars_list):
                    for c2 in chars_list[i + 1:]:
                        char_interactions[c1][c2] += 1
                        char_interactions[c2][c1] += 1
                flat_idx += 1
    else:
        # Novel: extract from dialogue tags
        dialogue_re = re.compile(
            r'(?:said|replied|asked|whispered|shouted|cried|exclaimed|murmured|added|thought)\s+'
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        )
        for chap_idx, chapter in enumerate(units):
            for sec_idx, section in enumerate(chapter.get("children", [])):
                content = section.get("content", "")
                found_in_section = set()
                for match in dialogue_re.finditer(content):
                    name = match.group(1).strip().upper()
                    char_lines[name].append("")
                    char_scenes[name].add(chapter.get("title", f"Chapter {chap_idx+1}"))
                    found_in_section.add(name)
                    
                    if name not in char_first_seen:
                        char_first_seen[name] = flat_idx
                    if flat_idx not in char_all_seen[name]:
                        char_all_seen[name].append(flat_idx)
                flat_idx += 1

    # ── BERT NER supplement for novels ────────────────────────────────────
    # For novels the dialogue-regex misses characters who are described but
    # never directly quoted.  BERT NER catches them.
    if doc_type != "play":
        try:
            from services.character_service import get_character_service
            _char_svc = get_character_service()
            # Gather a representative sample of text (~8000 chars)
            _ner_text = ""
            for _chap in units:
                for _sec in _chap.get("children", []):
                    _ner_text += _sec.get("content", "") + " "
                    if len(_ner_text) > 8000:
                        break
                if len(_ner_text) > 8000:
                    break
            ner_names = _char_svc.extract_person_names(_ner_text[:8000])
            for _name in ner_names:
                _key = _name.upper()
                if _key not in char_lines and _key not in {"I", "A"}:
                    char_lines[_key] = [""]   # 1 mention — background
                    if _key not in char_first_seen:
                        char_first_seen[_key] = flat_idx
        except Exception as _ner_exc:
            print(f"⚠️  BERT NER character supplement failed: {_ner_exc}")

    characters = []
    noise = {"AND", "THE", "ALL", "BOTH", "ENTER", "EXIT", "ACT", "SCENE", "STORY", "TIME", "DAY", "NIGHT", "MAN", "WOMAN", "BOY", "GIRL"}
    for name, lines in char_lines.items():
        if len(name) < 2 or name in noise:
            continue

        line_count = len(lines)
        top_interactions = char_interactions.get(name, Counter()).most_common(5)

        characters.append({
            "name": name.title(),
            "name_upper": name,
            "line_count": line_count,
            "scene_count": len(char_scenes.get(name, set())),
            "importance": "major" if line_count > 15 else "minor" if line_count > 3 else "background",
            "first_seen_index": char_first_seen.get(name, 0),
            "all_seen_indices": char_all_seen.get(name, []),
            "relationships": [
                {"character": other.title(), "co_appearances": count}
                for other, count in top_interactions
            ],
            "scenes": sorted(char_scenes.get(name, set())),
            "description": "", # To be filled by Gemini
        })

    # Sort by importance
    characters.sort(key=lambda c: c["line_count"], reverse=True)
    major_only = [c["name"] for c in characters if c["importance"] != "background"][:12]

    # Fill descriptions via Gemini (Phase 3 spoiler safety)
    if gemini and gemini.is_available() and major_only:
        prompt = f"""Provide child-friendly, spoiler-safe descriptions for these characters: {", ".join(major_only)}. 
Focus on their personality and physical traits, NOT story twists or endings.
Respond in JSON: {{"CharacterName": "Description"}}"""
        try:
            desc_map = gemini.generate_json(prompt)
            if isinstance(desc_map, dict):
                for c in characters:
                    if c["name"] in desc_map:
                        c["description"] = desc_map[c["name"]]
        except: pass

    return characters


# ── Vocabulary extraction ─────────────────────────────────────────────────────

def _extract_vocabulary(
    units: List[Dict[str, Any]], 
    doc_type: str, 
    language: str = "en",
    gemini: Optional[GeminiService] = None
) -> List[Dict[str, Any]]:
    """Extract difficult vocabulary from the text, using Gemini if available."""
    
    # ── Tier 0: Gemini Cloud Acceleration ──────────────────────────────────
    if gemini and gemini.is_available():
        # Use first 4000 chars of content for deep vocabulary extraction
        all_content = ""
        for u in units[:5]:
            all_content += (u.get("content", "") or str(u.get("paragraphs", []))) + "\n"
        all_content = all_content[:4000]

        prompt = f"""Analyze this literary text excerpt:
"{all_content}"

Identify 15-20 difficult or key vocabulary words for a Primary School (P4-P6, ages 9-12) student.
For each word, provide:
- modern_meaning: a very simple, child-friendly definition (1 sentence)
- analogy: a simple comparison to help a child understand
- archaic: boolean (is it an old-fashioned or complex literary word?)

Respond in JSON as a list of objects with keys: "word", "modern_meaning", "analogy", "archaic".
"""
        try:
            result = gemini.generate_json(prompt)
            if isinstance(result, list) and len(result) > 0:
                # Add context metadata to match local schema
                for item in result:
                    # Calibrated difficulty: archaic/literary words are 0.75, others 0.55
                    item["difficulty"] = 0.75 if item.get("archaic") else 0.55
                    if "meaning" in item and "modern_meaning" not in item:
                        item["modern_meaning"] = item.pop("meaning")
                return result
        except Exception as e:
            print(f"Gemini BookBrain vocab extraction failed: {e}")

    # ── Tier 1: FLAN-T5 offline model ─────────────────────────────────────
    if _load_flant5_vocab() and _FLANT5_VOCAB_PIPELINE is not None:
        try:
            all_content = ""
            for u in units[:5]:
                def _get_t(u):
                    t = u.get("content", "") or ""
                    for c in u.get("children", []): t += " " + _get_t(c)
                    for b in u.get("blocks", []): t += " " + b.get("content", "")
                    return t
                all_content += _get_t(u) + "\n"
            all_content = all_content[:2000]

            prompt = (
                "Identify 10 difficult vocabulary words at C1 level in this text and "
                "for each provide a simple one-sentence definition and a short analogy "
                "that a 12-year-old student would understand. "
                "Format each entry as: WORD | definition | analogy\n\n"
                f"Text:\n{all_content}"
            )
            raw_output = _FLANT5_VOCAB_PIPELINE(prompt)[0]["generated_text"]

            # Parse pipe-separated lines
            flant5_vocab = []
            for line in raw_output.strip().split("\n"):
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 2:
                    word = parts[0].lower().strip(".,!? ")
                    if len(word) >= 3 and " " not in word:
                        flant5_vocab.append({
                            "word": word,
                            "modern_meaning": parts[1] if len(parts) > 1 else "",
                            "analogy": parts[2] if len(parts) > 2 else "",
                            "difficulty": 0.65,
                            "archaic": word in _ARCHAIC_WORDS,
                            "syllables": _syllable_count(word),
                            "contexts": [],
                            "frequency": 1,
                        })

            if len(flant5_vocab) >= 5:
                print(f"✅ FLAN-T5 vocab: {len(flant5_vocab)} words extracted")
                return flant5_vocab
        except Exception as exc:
            print(f"⚠️  FLAN-T5 vocab extraction failed: {exc}")

    # ── Tier 2: Local Heuristics ───────────────────────────────────────────
    word_freq: Counter = Counter()
    word_contexts: Dict[str, List[str]] = defaultdict(list)

    # Gather all text
    for unit in units:
        # Recursive gather for hierarchical units
        def _get_text(u):
            t = u.get("content", "") or ""
            for child in u.get("children", []):
                t += " " + _get_text(child)
            for block in u.get("blocks", []):
                t += " " + block.get("content", "")
            return t
        
        content = _get_text(unit)
        if content:
            words = re.findall(r"[a-zA-Z']+", content.lower())
            for w in words:
                word_freq[w] += 1
                if len(word_contexts[w]) < 2:
                    # Simple sentence splitter fallback
                    sentences = re.split(r"[.!?]+", content)
                    for sent in sentences:
                        if w in sent.lower() and len(sent.strip()) > 15:
                            word_contexts[w].append(sent.strip()[:140])
                            break

    vocab_items: List[Dict[str, Any]] = []

    for word, count in word_freq.items():
        if len(word) < 4 or word in _COMMON_WORDS:
            continue

        syllables = _syllable_count(word)
        is_archaic = word in _ARCHAIC_WORDS

        # Calibrated difficulty: more lenient than v3.0
        # 1-2 syll: 0.35, 3 syll: 0.5, 4+ syll: 0.7
        base_diff = 0.35 if syllables <= 2 else (0.5 if syllables == 3 else 0.7)
        difficulty = base_diff + (0.2 if is_archaic else 0)
        difficulty = min(1.0, difficulty)

        if difficulty < 0.4:
            continue

        entry: Dict[str, Any] = {
            "word": word,
            "frequency": count,
            "syllables": syllables,
            "difficulty": round(difficulty, 2),
            "contexts": word_contexts.get(word, [])[:2],
            "archaic": is_archaic,
            "modern_meaning": _ARCHAIC_WORDS.get(word, ""),
            "analogy": "",
        }

        vocab_items.append(entry)

    # Sort by difficulty descending
    vocab_items.sort(key=lambda v: (-v["difficulty"], -v["frequency"]))
    return vocab_items[:120]  # Top 120 words


# ── Difficulty mapping ────────────────────────────────────────────────────────

def _compute_difficulty_map(
    units: List[Dict[str, Any]],
    doc_type: str,
    char_names: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Compute per-unit difficulty scores with enriched per-chunk metadata."""
    difficulty_map: List[Dict[str, Any]] = []
    char_names = char_names or []

    if doc_type == "play":
        for act in units:
            # Detect faction from act-level character lists (heuristic: first scene speaker)
            act_chars: List[str] = []
            for scene in act.get("children", []):
                for block in scene.get("blocks", []):
                    if block.get("type") == "dialogue" and block.get("character"):
                        act_chars.append(block["character"])

            for scene in act.get("children", []):
                text_parts = []
                scene_chars_present: List[str] = []
                scene_factions: Counter = Counter()
                for block in scene.get("blocks", []):
                    text_parts.append(block.get("content", ""))
                    if block.get("type") == "dialogue" and block.get("character"):
                        c = block["character"].strip().title()
                        if c not in scene_chars_present:
                            scene_chars_present.append(c)
                        if block.get("faction"):
                            scene_factions[block["faction"]] += 1

                full_text = " ".join(text_parts)
                if not full_text.strip():
                    continue

                words = full_text.split()
                word_count = len(words)
                fk_grade = _flesch_kincaid_grade(full_text)

                archaic_count = sum(
                    1 for w in words
                    if w.lower().strip(".,!?;:'\"()") in _ARCHAIC_WORDS
                )
                long_words = sum(1 for w in words if _syllable_count(w) >= 3)

                devices_found = []
                for pattern, device_name in _LITERARY_DEVICE_PATTERNS:
                    if re.search(pattern, full_text, re.IGNORECASE):
                        devices_found.append(device_name)

                vocab_difficulty = min(1.0, (archaic_count / max(word_count, 1)) * 10 + (long_words / max(word_count, 1)) * 3)
                syntax_difficulty = min(1.0, fk_grade / 15)
                conceptual = min(1.0, len(devices_found) * 0.2)
                overall = 0.4 * vocab_difficulty + 0.35 * syntax_difficulty + 0.25 * conceptual

                # Dominant faction in this scene
                dominant_faction = scene_factions.most_common(1)[0][0] if scene_factions else ""

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
                    # Enriched per-chunk metadata
                    "emotion": _detect_emotion(full_text),
                    "setting": _detect_setting(full_text),
                    "characters_present": scene_chars_present[:10],
                    "archaic_phrases": _archaic_phrases_in(full_text),
                    "faction": dominant_faction,
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
                    # Enriched per-chunk metadata
                    "emotion": _detect_emotion(content),
                    "setting": _detect_setting(content),
                    "characters_present": _characters_present_in(content, char_names),
                    "archaic_phrases": _archaic_phrases_in(content),
                    "faction": "",
                })

    return difficulty_map


# ── Book Brain Orchestrator ───────────────────────────────────────────────────

@dataclass
class BookBrainResult:
    """Complete pre-analysis for a book."""
    difficulty_map:       List[Dict[str, Any]]
    vocabulary:           List[Dict[str, Any]]
    characters:           List[Dict[str, Any]]
    summary_stats:        Dict[str, Any]
    struggle_zones:       List[Dict[str, Any]]
    cultural_context_bank: List[Dict[str, str]]  # Pre-built cross-cultural notes


class BookBrain:
    """
    Pre-analyzes an entire book at upload time.

    Usage:
        brain = BookBrain()
        result = brain.analyze(units, doc_type="play", language="en", title="Macbeth")
    """

    def __init__(self):
        self._gemini = GeminiService()

    def analyze(
        self,
        units: List[Dict[str, Any]],
        doc_type: str = "generic",
        language: str = "en",
        title: str = "",
        author: str = "",
    ) -> BookBrainResult:
        # 1. Character graph first (Phase 3: enhanced with flat indexing & spoiler-safe descs)
        characters = _extract_characters_from_units(units, doc_type, self._gemini)
        char_names = [c["name"] for c in characters]

        # 2. Difficulty mapping (enriched with emotion, setting, characters_present, etc.)
        difficulty_map = _compute_difficulty_map(units, doc_type, char_names)

        # 3. Vocabulary extraction (Tiered: Gemini -> Rules)
        vocabulary = _extract_vocabulary(units, doc_type, language, self._gemini)

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
                "emotion": d.get("emotion", "neutral"),
            }
            for d in difficulty_map
            if d.get("predicted_struggle", False)
        ]

        # 6. Cultural context bank — filter to phrases that appear in this book
        all_text = " ".join(
            d.get("section_title", "") + " " + str(d.get("archaic_phrases", ""))
            for d in difficulty_map
        ).lower()
        # Also check full archaic phrases from vocab
        archaic_vocab_words = {v["word"] for v in vocabulary if v.get("archaic")}
        cultural_context_bank = [
            entry for entry in _CULTURAL_CONTEXT_BANK
            if any(word in all_text for word in entry["phrase"].lower().split())
            or any(word in archaic_vocab_words for word in entry["phrase"].lower().split())
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
            "emotions_detected": list({d.get("emotion", "neutral") for d in difficulty_map if d.get("emotion") != "neutral"}),
            "cultural_context_count": len(cultural_context_bank),
        }

        return BookBrainResult(
            difficulty_map=difficulty_map,
            vocabulary=vocabulary,
            characters=characters,
            summary_stats=summary_stats,
            struggle_zones=struggle_zones,
            cultural_context_bank=cultural_context_bank,
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
