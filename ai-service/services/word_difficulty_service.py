"""
word_difficulty_service.py
==========================
Word-level difficulty detection and pronunciation guide generation.

Features:
  - Estimates word difficulty using syllable count, word frequency, and length
  - Generates phonetic pronunciation guides
  - Identifies difficult words in a passage
  - Categorizes words (archaic, idiom, figurative, vocabulary)
"""

from __future__ import annotations

import re
import math
from typing import Any, Dict, List, Optional, Tuple


# Common English words (top ~500) — words NOT in this list are likely harder
_COMMON_WORDS = set("""
a about after again all also am an and any are as at back be because been
before being between both but by came can come could day did do does down
each end even every few find first for from get give go going gone good got
great had has have he her here him his how i if in into is it its just know
last let life like little long look made make man many may me might more most
much must my never new no not now number of off old on one only or other our
out over own part people place put quite ran read right said same saw say
see she should show side since so some something still such take tell than
that the their them then there these they thing think this those thought
three through time to too two under up us use very want was water way we
well went were what when where which while who why will with word work
world would write year you your
""".split())

# Phonetic guide rules (simplified English phonetics)
_PHONETIC_MAP = {
    "ph": "f", "gh": "", "ck": "k", "tion": "shun", "sion": "zhun",
    "ous": "us", "ious": "ee-us", "eous": "ee-us",
    "ight": "ite", "ough": "uff", "ture": "cher",
    "ble": "bul", "tle": "tul", "ple": "pul",
}


class WordDifficultyService:
    """Detect difficult words and generate pronunciation guides."""

    def __init__(self):
        try:
            import nltk
            self._nltk_available = True
        except ImportError:
            self._nltk_available = False

    def analyze_passage(
        self,
        text: str,
        difficulty_threshold: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """
        Identify difficult words in a passage.

        Returns list of dicts with:
            word, difficulty, syllables, pronunciation, category, context
        """
        words = re.findall(r"[a-zA-Z']+", text)
        seen = set()
        difficult_words = []

        for word in words:
            clean = word.lower().strip("'")
            if clean in seen or len(clean) < 3:
                continue
            seen.add(clean)

            difficulty = self.estimate_difficulty(clean)
            if difficulty >= difficulty_threshold:
                syllable_count = self.count_syllables(clean)
                pronunciation = self.generate_pronunciation(clean)
                category = self.categorize_word(clean)

                # Extract context (sentence containing the word)
                context = self._extract_context(text, word)

                difficult_words.append({
                    "word": word,
                    "difficulty": round(difficulty, 3),
                    "syllables": syllable_count,
                    "pronunciation": pronunciation,
                    "category": category,
                    "context": context,
                })

        # Sort by difficulty descending
        difficult_words.sort(key=lambda w: w["difficulty"], reverse=True)
        return difficult_words

    def estimate_difficulty(self, word: str) -> float:
        """
        Estimate word difficulty on a 0-1 scale.

        Factors:
          - Word length (longer = harder)
          - Syllable count
          - Common word list membership
          - Letter complexity patterns
        """
        word = word.lower().strip("'")

        # Length factor (0-0.3)
        length_score = min(0.3, len(word) / 30)

        # Syllable factor (0-0.3)
        syllables = self.count_syllables(word)
        syllable_score = min(0.3, (syllables - 1) / 6)

        # Frequency factor (0-0.25)
        freq_score = 0.0 if word in _COMMON_WORDS else 0.25

        # Complexity patterns (0-0.15)
        complexity = 0.0
        if re.search(r"(?:ough|tion|sion|ious|eous|ght)", word):
            complexity += 0.05
        if re.search(r"[^aeiou]{3,}", word):  # Consonant clusters
            complexity += 0.05
        if re.search(r"(?:ph|gh|kn|wr|gn|mb|bt)", word):  # Silent letters
            complexity += 0.05

        total = length_score + syllable_score + freq_score + complexity
        return min(1.0, total)

    def count_syllables(self, word: str) -> int:
        """Estimate the number of syllables in a word."""
        word = word.lower().strip("'")
        if len(word) <= 3:
            return 1

        # Count vowel groups
        vowel_groups = re.findall(r"[aeiouy]+", word)
        count = len(vowel_groups)

        # Adjust for silent e
        if word.endswith("e") and count > 1:
            count -= 1

        # Adjust for -le ending
        if word.endswith("le") and len(word) > 2 and word[-3] not in "aeiou":
            count += 1

        # Adjust for -ed ending
        if word.endswith("ed") and not word.endswith(("ted", "ded")):
            count -= 1

        return max(1, count)

    def generate_pronunciation(self, word: str) -> str:
        """
        Generate a simple phonetic pronunciation guide.

        Uses syllable splitting and phonetic substitutions
        to create a kid-friendly pronunciation guide.
        """
        word = word.lower().strip("'")

        # Split into syllables
        syllables = self._split_syllables(word)

        # Apply phonetic simplifications to each syllable
        phonetic_parts = []
        for syl in syllables:
            phonetic = syl
            for pattern, replacement in _PHONETIC_MAP.items():
                phonetic = phonetic.replace(pattern, replacement)
            phonetic_parts.append(phonetic)

        return "-".join(phonetic_parts)

    def categorize_word(self, word: str) -> str:
        """Categorize a word type for educational purposes."""
        word = word.lower()

        # Archaic words
        archaic = {
            "thou", "thee", "thy", "thine", "hath", "doth", "art", "wilt",
            "shalt", "ere", "hence", "hither", "thither", "wherefore",
            "forsooth", "prithee", "methinks", "anon", "perchance",
            "betwixt", "whence", "oft", "nay", "yea",
        }
        if word in archaic:
            return "archaic"

        # Words ending in common figurative suffixes
        if re.search(r"(?:ness|ment|tion|sion|ity|ous|ive|ful|less)$", word):
            return "vocabulary"

        return "vocabulary"

    def _split_syllables(self, word: str) -> List[str]:
        """Split a word into syllables for pronunciation."""
        vowels = "aeiouy"
        syllables = []
        current = ""

        i = 0
        while i < len(word):
            current += word[i]

            # If we have a vowel followed by consonant(s) and another vowel
            if (
                i > 0
                and word[i] in vowels
                and i < len(word) - 1
                and word[i - 1] not in vowels
                and len(current) > 1
            ):
                # Split before the consonant before this vowel
                split_point = len(current) - 2
                if split_point > 0:
                    syllables.append(current[:split_point])
                    current = current[split_point:]

            i += 1

        if current:
            if syllables and len(current) <= 1:
                syllables[-1] += current
            else:
                syllables.append(current)

        return syllables if syllables else [word]

    def _extract_context(self, text: str, word: str) -> str:
        """Extract the sentence containing the word."""
        sentences = re.split(r"(?<=[.!?])\s+", text)
        for sent in sentences:
            if word in sent:
                # Truncate long sentences
                if len(sent) > 120:
                    idx = sent.find(word)
                    start = max(0, idx - 40)
                    end = min(len(sent), idx + len(word) + 40)
                    return "..." + sent[start:end] + "..."
                return sent
        return ""
