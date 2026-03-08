"""
learner_embedding.py
====================
Student Learner Embedding — a 128-dimensional vector encoding everything
about how a student reads.

Dimensions encode:
  [0-15]   Decoding speed by word length (1-8 syllables × 2: speed + variance)
  [16-23]  Attention span curve (8 time buckets: 0-2min, 2-5min, …, 25-30min)
  [24-31]  Learning modality preferences (visual, auditory, read-write, kinesthetic × 2)
  [32-63]  Vocabulary level per domain (8 domains × 4: known/partial/unknown/growth-rate)
  [64-79]  Emotional response to difficulty (persistence, frustration, skip rate, etc.)
  [80-95]  Time-of-day performance (8 × 2: morning, mid-morning, …, evening)
  [96-111] Adaptation response history (which of the 6 RL actions helped × 2 + annoyance)
  [112-119] Reading pattern features (backtrack rate, re-read rate, speed variance, etc.)
  [120-127] Genre preferences and comprehension (play, novel, poem, generic × 2)

The vector updates every session using exponential moving average (α = 0.15).
Transfers across books.
"""

from __future__ import annotations

import json
import math
import os
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np

EMBEDDING_DIM = 128
EMA_ALPHA = 0.15  # Smoothing factor for exponential moving average


@dataclass
class SessionMetrics:
    """Metrics collected from a single reading session."""
    session_duration_s: float = 0
    words_read: int = 0
    reading_speed_wpm: float = 0
    backtrack_count: int = 0
    scroll_events: int = 0
    attention_lapses: int = 0
    highlights_made: int = 0
    vocab_lookups: int = 0
    time_of_day_hour: int = 12  # 0-23
    disability_type: float = 0  # 0.0=none, 0.5=dyslexia, 1.0=ADHD, 1.5=both
    doc_type: str = "generic"   # play, novel, poem, generic
    adaptations_applied: List[int] = field(default_factory=list)  # action IDs
    adaptation_accepted: List[bool] = field(default_factory=list)  # did student keep it?
    quiz_score: Optional[float] = None  # 0-1 if quiz was taken
    avg_dwell_time_ms: float = 0
    session_fatigue: float = 0


class LearnerEmbedding:
    """
    Manages 128-dim learner profile vectors.

    Usage:
        emb = LearnerEmbedding()
        vector = emb.get_or_create("student_123")
        emb.update_from_session("student_123", session_metrics)
        profile = emb.get_profile_summary("student_123")
    """

    def __init__(self, storage_dir: str = "/tmp/included_embeddings"):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        self._cache: Dict[str, np.ndarray] = {}
        self._session_counts: Dict[str, int] = {}

    def _path(self, student_id: str) -> str:
        safe_id = student_id.replace("/", "_").replace("\\", "_")
        return os.path.join(self.storage_dir, f"{safe_id}.json")

    def get_or_create(self, student_id: str) -> np.ndarray:
        """Get existing embedding or create population-level default."""
        if student_id in self._cache:
            return self._cache[student_id].copy()

        path = self._path(student_id)
        if os.path.exists(path):
            try:
                with open(path) as f:
                    data = json.load(f)
                vec = np.array(data["embedding"], dtype=np.float32)
                self._session_counts[student_id] = data.get("session_count", 0)
                self._cache[student_id] = vec
                return vec.copy()
            except Exception:
                pass

        # Population-level defaults
        vec = self._default_embedding()
        self._cache[student_id] = vec
        self._session_counts[student_id] = 0
        return vec.copy()

    def _default_embedding(self) -> np.ndarray:
        """Create a population-level default embedding."""
        vec = np.full(EMBEDDING_DIM, 0.5, dtype=np.float32)

        # Decoding speed [0-15]: average for each word length
        for i in range(8):
            vec[i * 2] = 0.5       # speed
            vec[i * 2 + 1] = 0.3   # variance (moderate)

        # Attention span [16-23]: decreases over time
        for i in range(8):
            vec[16 + i] = max(0.2, 0.8 - i * 0.08)

        # Modality preferences [24-31]: balanced
        for i in range(8):
            vec[24 + i] = 0.5

        # Vocabulary levels [32-63]: average
        for i in range(32):
            vec[32 + i] = 0.5

        # Emotional response [64-79]: moderate persistence
        vec[64] = 0.6  # persistence
        vec[65] = 0.3  # frustration
        vec[66] = 0.2  # skip rate
        vec[67] = 0.5  # help-seeking

        # Time-of-day [80-95]: flat (no preference yet)
        for i in range(16):
            vec[80 + i] = 0.5

        # Adaptation history [96-111]: no history yet
        for i in range(16):
            vec[96 + i] = 0.5

        # Reading patterns [112-119]
        vec[112] = 0.2  # backtrack rate
        vec[113] = 0.1  # re-read rate
        vec[114] = 0.3  # speed variance
        vec[115] = 0.5  # avg reading speed
        vec[116] = 0.0  # highlight frequency
        vec[117] = 0.0  # vocab lookup frequency
        vec[118] = 0.5  # session completion rate
        vec[119] = 0.3  # fatigue sensitivity

        # Genre [120-127]
        for i in range(8):
            vec[120 + i] = 0.5

        return vec

    def update_from_session(
        self, student_id: str, metrics: SessionMetrics
    ) -> np.ndarray:
        """Update embedding with data from a completed reading session."""
        vec = self.get_or_create(student_id)
        alpha = EMA_ALPHA

        session_count = self._session_counts.get(student_id, 0) + 1
        self._session_counts[student_id] = session_count

        # ── Decoding speed [0-15] ─────────────────────────────────────────────
        if metrics.reading_speed_wpm > 0:
            speed_norm = min(1.0, metrics.reading_speed_wpm / 250)
            vec[0] = (1 - alpha) * vec[0] + alpha * speed_norm  # overall speed

        # ── Attention span [16-23] ────────────────────────────────────────────
        if metrics.session_duration_s > 0:
            # Which time bucket does this session end in?
            bucket = min(7, int(metrics.session_duration_s / 225))  # 0-30min in 8 buckets
            attention_at_end = max(0, 1.0 - metrics.session_fatigue)
            vec[16 + bucket] = (1 - alpha) * vec[16 + bucket] + alpha * attention_at_end

        # ── Emotional response [64-79] ────────────────────────────────────────
        if metrics.session_duration_s > 60:
            # Persistence: did they keep reading despite difficulty?
            completion = min(1.0, metrics.words_read / max(1, metrics.session_duration_s / 60 * 150))
            vec[64] = (1 - alpha) * vec[64] + alpha * completion

            # Frustration proxy: high dwell + backtracks
            frustration = min(1.0, (metrics.backtrack_count / max(1, metrics.scroll_events)) * 2)
            vec[65] = (1 - alpha) * vec[65] + alpha * frustration

            # Help-seeking: highlights + vocab lookups
            help_rate = min(1.0, (metrics.highlights_made + metrics.vocab_lookups) / max(1, metrics.words_read / 100))
            vec[67] = (1 - alpha) * vec[67] + alpha * help_rate

        # ── Time-of-day [80-95] ───────────────────────────────────────────────
        tod_bucket = min(7, metrics.time_of_day_hour // 3)
        performance = min(1.0, metrics.reading_speed_wpm / 200) if metrics.reading_speed_wpm > 0 else 0.5
        vec[80 + tod_bucket * 2] = (1 - alpha) * vec[80 + tod_bucket * 2] + alpha * performance

        # ── Adaptation history [96-111] ───────────────────────────────────────
        for i, action_id in enumerate(metrics.adaptations_applied):
            if action_id < 6:
                idx = 96 + action_id * 2
                accepted = metrics.adaptation_accepted[i] if i < len(metrics.adaptation_accepted) else True
                helpfulness = 1.0 if accepted else 0.0
                vec[idx] = (1 - alpha) * vec[idx] + alpha * helpfulness

        # ── Reading patterns [112-119] ────────────────────────────────────────
        if metrics.scroll_events > 0:
            bt_rate = min(1.0, metrics.backtrack_count / metrics.scroll_events)
            vec[112] = (1 - alpha) * vec[112] + alpha * bt_rate

        if metrics.reading_speed_wpm > 0:
            vec[115] = (1 - alpha) * vec[115] + alpha * min(1.0, metrics.reading_speed_wpm / 250)

        if metrics.words_read > 0:
            hl_freq = min(1.0, metrics.highlights_made / (metrics.words_read / 100))
            vec[116] = (1 - alpha) * vec[116] + alpha * hl_freq
            vl_freq = min(1.0, metrics.vocab_lookups / (metrics.words_read / 100))
            vec[117] = (1 - alpha) * vec[117] + alpha * vl_freq

        vec[119] = (1 - alpha) * vec[119] + alpha * metrics.session_fatigue

        # ── Genre [120-127] ───────────────────────────────────────────────────
        genre_idx = {"play": 0, "novel": 1, "poem": 2, "generic": 3}.get(metrics.doc_type, 3)
        if metrics.quiz_score is not None:
            vec[120 + genre_idx * 2] = (1 - alpha) * vec[120 + genre_idx * 2] + alpha * metrics.quiz_score
        if metrics.reading_speed_wpm > 0:
            vec[121 + genre_idx * 2] = (1 - alpha) * vec[121 + genre_idx * 2] + alpha * min(1.0, metrics.reading_speed_wpm / 200)

        # Save
        self._cache[student_id] = vec
        self._save(student_id, vec)
        return vec.copy()

    def _save(self, student_id: str, vec: np.ndarray):
        path = self._path(student_id)
        data = {
            "student_id": student_id,
            "embedding": vec.tolist(),
            "session_count": self._session_counts.get(student_id, 0),
            "updated_at": time.time(),
            "version": "v1",
        }
        with open(path, "w") as f:
            json.dump(data, f)

    def get_profile_summary(self, student_id: str) -> Dict[str, Any]:
        """Get human-readable profile summary from embedding."""
        vec = self.get_or_create(student_id)
        sessions = self._session_counts.get(student_id, 0)

        # Attention span curve
        attention_curve = [round(float(vec[16 + i]), 2) for i in range(8)]
        best_attention_bucket = int(np.argmax(attention_curve))
        attention_minutes = [
            "0-4 min", "4-8 min", "8-12 min", "12-16 min",
            "16-20 min", "20-24 min", "24-28 min", "28+ min",
        ]

        # Best time of day
        tod_perf = [float(vec[80 + i * 2]) for i in range(8)]
        best_tod = int(np.argmax(tod_perf))
        tod_labels = [
            "midnight-3am", "3-6am", "6-9am", "9am-noon",
            "noon-3pm", "3-6pm", "6-9pm", "9pm-midnight",
        ]

        # Adaptation preferences
        adaptation_labels = [
            "Keep Original", "Light Simplification", "Heavy Simplification",
            "TTS + Highlights", "Syllable Break", "Attention Break",
        ]
        adapt_scores = [float(vec[96 + i * 2]) for i in range(6)]
        preferred_adaptations = sorted(
            range(6), key=lambda i: adapt_scores[i], reverse=True
        )[:3]

        # Genre performance
        genre_labels = ["play", "novel", "poem", "generic"]
        genre_scores = [float(vec[120 + i * 2]) for i in range(4)]

        return {
            "student_id": student_id,
            "sessions_completed": sessions,
            "personalized": sessions >= 3,
            "reading_speed": round(float(vec[0]), 2),
            "persistence": round(float(vec[64]), 2),
            "frustration_level": round(float(vec[65]), 2),
            "help_seeking": round(float(vec[67]), 2),
            "fatigue_sensitivity": round(float(vec[119]), 2),
            "attention_curve": attention_curve,
            "best_attention_period": attention_minutes[best_attention_bucket],
            "best_time_of_day": tod_labels[best_tod],
            "preferred_adaptations": [
                adaptation_labels[i] for i in preferred_adaptations
            ],
            "adaptation_scores": {
                adaptation_labels[i]: round(adapt_scores[i], 2)
                for i in range(6)
            },
            "genre_comprehension": {
                genre_labels[i]: round(genre_scores[i], 2)
                for i in range(4)
            },
            "backtrack_rate": round(float(vec[112]), 2),
            "highlight_frequency": round(float(vec[116]), 2),
            "vocab_lookup_frequency": round(float(vec[117]), 2),
        }

    def get_reading_level(self, student_id: str) -> str:
        """Determine reading level from embedding."""
        vec = self.get_or_create(student_id)
        speed = float(vec[0])
        persistence = float(vec[64])
        vocab_lookups = float(vec[117])

        score = speed * 0.4 + persistence * 0.3 + (1 - vocab_lookups) * 0.3

        if score > 0.7:
            return "advanced"
        elif score > 0.4:
            return "intermediate"
        return "beginner"
