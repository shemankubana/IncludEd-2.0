"""
stt_service.py
==============
Speech-to-Text reading assessment service.

Uses the Web Speech API on the frontend side, but this service handles:
1. Comparing expected text vs spoken text (reading accuracy)
2. Calculating reading speed (WPM)
3. Identifying mispronounced or skipped words
4. Generating a reading fluency score
"""

from __future__ import annotations

import re
import difflib
from typing import Any, Dict, List, Optional


class STTAssessmentService:
    """Assess reading fluency by comparing expected vs spoken text."""

    def assess_reading(
        self,
        expected_text: str,
        spoken_text: str,
        duration_seconds: float = 0,
    ) -> Dict[str, Any]:
        """
        Compare expected text with what the student actually said.

        Returns:
            {
                "accuracy": float (0-100),
                "wpm": float,
                "total_words": int,
                "correct_words": int,
                "missed_words": [str],
                "mispronounced_words": [{expected, spoken}],
                "added_words": [str],
                "fluency_score": float (0-100),
                "feedback": str,
            }
        """
        expected_words = self._normalize_words(expected_text)
        spoken_words = self._normalize_words(spoken_text)

        # Use SequenceMatcher for alignment
        matcher = difflib.SequenceMatcher(None, expected_words, spoken_words)

        correct = 0
        missed: List[str] = []
        mispronounced: List[Dict[str, str]] = []
        added: List[str] = []

        for op, i1, i2, j1, j2 in matcher.get_opcodes():
            if op == "equal":
                correct += i2 - i1
            elif op == "delete":
                missed.extend(expected_words[i1:i2])
            elif op == "insert":
                added.extend(spoken_words[j1:j2])
            elif op == "replace":
                for k in range(min(i2 - i1, j2 - j1)):
                    exp_w = expected_words[i1 + k]
                    spk_w = spoken_words[j1 + k]
                    # Check if it's a close mispronunciation vs completely wrong
                    ratio = difflib.SequenceMatcher(None, exp_w, spk_w).ratio()
                    if ratio > 0.5:
                        mispronounced.append({"expected": exp_w, "spoken": spk_w})
                    else:
                        missed.append(exp_w)
                        added.append(spk_w)
                # Handle remaining unmatched words
                if i2 - i1 > j2 - j1:
                    missed.extend(expected_words[i1 + (j2 - j1):i2])
                elif j2 - j1 > i2 - i1:
                    added.extend(spoken_words[j1 + (i2 - i1):j2])

        total_words = len(expected_words)
        accuracy = (correct / total_words * 100) if total_words > 0 else 0

        # Reading speed (words per minute)
        wpm = 0.0
        if duration_seconds > 0:
            wpm = (len(spoken_words) / duration_seconds) * 60

        # Fluency score: combination of accuracy, pace, and flow
        pace_score = min(100, (wpm / 120) * 100) if wpm > 0 else 0
        flow_score = max(0, 100 - len(mispronounced) * 5 - len(missed) * 3)
        fluency_score = accuracy * 0.5 + pace_score * 0.25 + flow_score * 0.25

        # Generate encouraging feedback
        feedback = self._generate_feedback(accuracy, wpm, missed, mispronounced)

        return {
            "accuracy": round(accuracy, 1),
            "wpm": round(wpm, 1),
            "total_words": total_words,
            "correct_words": correct,
            "missed_words": missed[:20],
            "mispronounced_words": mispronounced[:10],
            "added_words": added[:10],
            "fluency_score": round(fluency_score, 1),
            "feedback": feedback,
        }

    def _normalize_words(self, text: str) -> List[str]:
        """Normalize text into lowercase word list."""
        text = re.sub(r"[^\w\s']", " ", text.lower())
        return [w.strip("'") for w in text.split() if w.strip("'")]

    def _generate_feedback(
        self,
        accuracy: float,
        wpm: float,
        missed: List[str],
        mispronounced: List[Dict[str, str]],
    ) -> str:
        """Generate encouraging feedback for the student."""
        parts = []

        if accuracy >= 95:
            parts.append("Excellent reading! You got almost every word right.")
        elif accuracy >= 85:
            parts.append("Great job! You read most of the words correctly.")
        elif accuracy >= 70:
            parts.append("Good effort! Keep practicing and you'll get even better.")
        else:
            parts.append("Nice try! Let's practice some of the tricky words together.")

        if wpm > 0:
            if wpm >= 120:
                parts.append(f"Your reading speed of {wpm:.0f} words per minute is very good!")
            elif wpm >= 80:
                parts.append(f"You read at {wpm:.0f} words per minute - a nice steady pace.")
            else:
                parts.append(f"You read at {wpm:.0f} words per minute. Taking your time is perfectly fine!")

        if mispronounced:
            tricky = [m["expected"] for m in mispronounced[:3]]
            parts.append(f"Some tricky words to practice: {', '.join(tricky)}.")

        return " ".join(parts)
