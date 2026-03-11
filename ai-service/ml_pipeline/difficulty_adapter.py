"""
difficulty_adapter.py
=====================
Adaptive Quiz Difficulty Engine for IncludEd 2.0.

Algorithm
---------
Uses a simplified Item Response Theory (IRT) model with a per-student
ability estimate (theta) that updates after every quiz attempt:

  θ_{t+1} = θ_t + α × (score − expected_score(θ_t, difficulty))

where:
  θ  — student ability on a –2 to +2 scale (stored per student)
  α  — learning rate (default 0.3)
  difficulty — item difficulty mapped from "easy"→–1, "medium"→0, "hard"→+1

Target difficulty is selected so the expected score ≈ 0.70 (the 70%
Goldilocks zone — challenging but achievable for all learners).

Disability adjustments
----------------------
  dyslexia : θ_init = –0.3  (start slightly easier)
  adhd     : α = 0.4         (faster adaptation to keep engagement high)
  both     : θ_init = –0.5, α = 0.4

State storage
-------------
In-memory dict keyed by (student_id, literature_id) — survives the
process lifetime of the AI service. For persistence across restarts,
call `export_state()` and store in your DB; `import_state()` reloads it.

Public API
----------
  adapter = get_difficulty_adapter()

  # After student completes a quiz:
  result = adapter.record_attempt(
      student_id="uid_123",
      literature_id="lit_456",
      chapter_index=2,
      score=0.75,            # fraction correct  (0.0 – 1.0)
      difficulty="medium",   # difficulty of the quiz just taken
      disability_type="dyslexia",
  )
  # → {"next_difficulty": "hard", "theta": 0.4, "streak": 3, ...}

  # Before generating a quiz, ask what difficulty to use:
  rec = adapter.recommend_difficulty(
      student_id="uid_123",
      literature_id="lit_456",
      disability_type="dyslexia",
  )
  # → "easy" | "medium" | "hard"
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

# ── IRT constants ──────────────────────────────────────────────────────────────

_DIFFICULTY_MAP: Dict[str, float] = {
    "easy":   -1.0,
    "medium":  0.0,
    "hard":    1.0,
}

_THETA_TO_DIFFICULTY: List[Tuple[float, str]] = [
    (-2.0, "easy"),
    (-0.4, "medium"),
    ( 0.6, "hard"),
]

_DEFAULT_THETA   = 0.0
_LEARNING_RATE   = 0.3
_TARGET_SCORE    = 0.70   # Goldilocks zone
_THETA_MIN       = -2.5
_THETA_MAX       =  2.5

# Disability-specific init adjustments
_DISABILITY_THETA: Dict[str, float] = {
    "dyslexia": -0.3,
    "adhd":      0.0,
    "both":     -0.5,
    "none":      0.0,
}
_DISABILITY_ALPHA: Dict[str, float] = {
    "dyslexia":  0.3,
    "adhd":      0.4,   # adapt faster to keep them engaged
    "both":      0.4,
    "none":      0.3,
}


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class StudentQuizState:
    """Per-(student, literature) quiz difficulty state."""
    theta:          float = _DEFAULT_THETA      # current ability estimate
    attempts:       int   = 0                   # total attempts
    streak_correct: int   = 0                   # consecutive ≥ 70% attempts
    streak_wrong:   int   = 0                   # consecutive < 50% attempts
    last_difficulty: str  = "medium"
    history:        List[Dict[str, Any]] = field(default_factory=list)

    def current_difficulty(self) -> str:
        """Map theta to a difficulty label."""
        for threshold, label in reversed(_THETA_TO_DIFFICULTY):
            if self.theta >= threshold:
                return label
        return "easy"


# ── IRT helpers ────────────────────────────────────────────────────────────────

def _expected_score(theta: float, item_difficulty: float) -> float:
    """
    1PL (Rasch) model: probability of correct response.

    P(correct) = 1 / (1 + exp(-(θ – b)))
    where b = item difficulty parameter.
    """
    return 1.0 / (1.0 + math.exp(-(theta - item_difficulty)))


def _update_theta(
    theta: float,
    score: float,
    item_difficulty: float,
    alpha: float,
) -> float:
    """
    Gradient-ascent update on theta.

    Δθ = α × (actual_score – expected_score)
    """
    expected = _expected_score(theta, item_difficulty)
    delta    = alpha * (score - expected)
    return max(_THETA_MIN, min(_THETA_MAX, theta + delta))


def _select_target_difficulty(theta: float) -> str:
    """
    Choose the difficulty label whose expected score is closest to TARGET_SCORE.
    """
    best_label    = "medium"
    best_distance = float("inf")
    for label, b in _DIFFICULTY_MAP.items():
        expected  = _expected_score(theta, b)
        distance  = abs(expected - _TARGET_SCORE)
        if distance < best_distance:
            best_distance = distance
            best_label    = label
    return best_label


# ── Adapter class ─────────────────────────────────────────────────────────────

class DifficultyAdapter:
    """
    Tracks per-student ability and recommends quiz difficulty.

    State is in-memory. Export/import for persistence.
    """

    def __init__(self):
        # key: (student_id, literature_id) → StudentQuizState
        self._states: Dict[Tuple[str, str], StudentQuizState] = {}

    def _get_or_create(
        self,
        student_id: str,
        literature_id: str,
        disability_type: str = "none",
    ) -> StudentQuizState:
        key = (student_id, literature_id)
        if key not in self._states:
            init_theta = _DISABILITY_THETA.get(disability_type, 0.0)
            self._states[key] = StudentQuizState(theta=init_theta)
        return self._states[key]

    # ── Public: record a quiz attempt ─────────────────────────────────────────

    def record_attempt(
        self,
        student_id:     str,
        literature_id:  str,
        chapter_index:  int,
        score:          float,          # fraction correct (0.0–1.0)
        difficulty:     str = "medium", # difficulty of the quiz just taken
        disability_type: str = "none",
    ) -> Dict[str, Any]:
        """
        Update student ability estimate after a quiz attempt.

        Parameters
        ----------
        score:
            Fraction of questions answered correctly (e.g. 7/10 = 0.7).
        difficulty:
            The difficulty level of the quiz that was just taken.

        Returns
        -------
        {
          "next_difficulty":     "easy" | "medium" | "hard",
          "theta":               float,
          "streak_correct":      int,
          "streak_wrong":        int,
          "attempts":            int,
          "performance_message": str,    # human-readable feedback
          "recommendation":      str,    # next-step advice for teacher
        }
        """
        state = self._get_or_create(student_id, literature_id, disability_type)
        alpha = _DISABILITY_ALPHA.get(disability_type, _LEARNING_RATE)
        item_b = _DIFFICULTY_MAP.get(difficulty, 0.0)

        # Update IRT theta
        old_theta   = state.theta
        state.theta = _update_theta(state.theta, score, item_b, alpha)
        state.attempts += 1

        # Update streaks
        if score >= 0.70:
            state.streak_correct += 1
            state.streak_wrong    = 0
        elif score < 0.50:
            state.streak_wrong   += 1
            state.streak_correct  = 0
        else:
            # Neutral zone — don't break either streak
            pass

        next_diff = _select_target_difficulty(state.theta)
        state.last_difficulty = next_diff

        # Log history (keep last 20)
        state.history.append({
            "chapter":    chapter_index,
            "score":      round(score, 3),
            "difficulty": difficulty,
            "theta":      round(state.theta, 3),
        })
        state.history = state.history[-20:]

        return {
            "next_difficulty":     next_diff,
            "theta":               round(state.theta, 3),
            "theta_delta":         round(state.theta - old_theta, 3),
            "streak_correct":      state.streak_correct,
            "streak_wrong":        state.streak_wrong,
            "attempts":            state.attempts,
            "performance_message": self._performance_message(score, state),
            "recommendation":      self._recommendation(score, state, disability_type),
        }

    # ── Public: recommend difficulty before generating quiz ───────────────────

    def recommend_difficulty(
        self,
        student_id:     str,
        literature_id:  str,
        disability_type: str = "none",
    ) -> str:
        """
        Return the recommended quiz difficulty for the student's current level.
        Defaults to "medium" for first-time students.
        """
        state = self._get_or_create(student_id, literature_id, disability_type)
        if state.attempts == 0:
            # First quiz: start easy for dyslexia/both, medium otherwise
            return "easy" if disability_type in ("dyslexia", "both") else "medium"
        return _select_target_difficulty(state.theta)

    # ── Public: get full state summary (for teacher dashboard) ────────────────

    def get_state(
        self,
        student_id:    str,
        literature_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Return the current state dict for a student + book, or None."""
        state = self._states.get((student_id, literature_id))
        if not state:
            return None
        return {
            "theta":           round(state.theta, 3),
            "ability_label":   self._ability_label(state.theta),
            "current_level":   state.current_difficulty(),
            "attempts":        state.attempts,
            "streak_correct":  state.streak_correct,
            "streak_wrong":    state.streak_wrong,
            "last_difficulty": state.last_difficulty,
            "history":         state.history,
        }

    # ── Persistence helpers ───────────────────────────────────────────────────

    def export_state(self) -> List[Dict[str, Any]]:
        """Export all states to a serialisable list (for DB persistence)."""
        rows = []
        for (sid, lid), state in self._states.items():
            rows.append({
                "student_id":    sid,
                "literature_id": lid,
                "theta":         state.theta,
                "attempts":      state.attempts,
                "streak_correct": state.streak_correct,
                "streak_wrong":  state.streak_wrong,
                "last_difficulty": state.last_difficulty,
                "history":       state.history,
            })
        return rows

    def import_state(self, rows: List[Dict[str, Any]]) -> None:
        """Restore states from a previously exported list."""
        for row in rows:
            key = (row["student_id"], row["literature_id"])
            self._states[key] = StudentQuizState(
                theta           = row.get("theta", 0.0),
                attempts        = row.get("attempts", 0),
                streak_correct  = row.get("streak_correct", 0),
                streak_wrong    = row.get("streak_wrong", 0),
                last_difficulty = row.get("last_difficulty", "medium"),
                history         = row.get("history", []),
            )

    # ── Private helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _ability_label(theta: float) -> str:
        if theta >= 0.8:
            return "Advanced"
        if theta >= 0.2:
            return "Progressing well"
        if theta >= -0.4:
            return "On track"
        if theta >= -1.0:
            return "Needs support"
        return "Needs significant support"

    @staticmethod
    def _performance_message(score: float, state: StudentQuizState) -> str:
        if score >= 0.90:
            return "Excellent work! You really understand this chapter."
        if score >= 0.70:
            if state.streak_correct >= 3:
                return "Great consistency! You're mastering this material."
            return "Good job! Keep reading to strengthen your understanding."
        if score >= 0.50:
            return "Decent effort. Revisiting a few key parts will help."
        if state.streak_wrong >= 2:
            return "This section is tricky — let's try some easier questions first."
        return "Don't worry — this was a tough one. Let's try again!"

    @staticmethod
    def _recommendation(
        score: float,
        state: StudentQuizState,
        disability_type: str,
    ) -> str:
        if score < 0.50 and state.streak_wrong >= 2:
            return "Consider offering simplified text or TTS for this chapter."
        if score >= 0.85 and state.streak_correct >= 3:
            return "Student is ready for more complex material."
        if disability_type == "adhd" and score < 0.60:
            return "Try shorter reading chunks with more frequent micro-checks."
        return "Continue current difficulty level."


# ── Module singleton ──────────────────────────────────────────────────────────

_adapter: Optional[DifficultyAdapter] = None

def get_difficulty_adapter() -> DifficultyAdapter:
    global _adapter
    if _adapter is None:
        _adapter = DifficultyAdapter()
    return _adapter
