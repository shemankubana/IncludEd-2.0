"""
Attention Monitor Service
==========================
Converts raw browser telemetry signals into a structured attention state
that the RL agent uses to decide the optimal pedagogical intervention.

Telemetry signals (from frontend/Streamlit):
  - mouse_speed       : pixels/sec (high = distracted rapid movement)
  - mouse_dwell       : seconds hovering on a single word (high = confusion)
  - scroll_back_count : number of backward scroll events in last 30 sec
  - key_latency       : avg ms between keystrokes in quiz (high = struggle)
  - idle_duration     : seconds since last mouse/key event (high = distracted)
  - reading_speed_wpm : words per minute (baseline: 120–180 wpm for P3-P6)
  - backtrack_count   : number of text re-reads detected
"""

from dataclasses import dataclass, field
from typing import List, Optional
import numpy as np
import time


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class TelemetryEvent:
    """Single telemetry snapshot from the frontend."""
    timestamp: float            = field(default_factory=time.time)
    mouse_speed: float          = 0.0   # px/sec
    mouse_dwell: float          = 0.0   # seconds hovering on one word
    scroll_back_count: int      = 0     # backward scrolls in last 30s window
    key_latency: float          = 0.0   # ms between keystrokes
    idle_duration: float        = 0.0   # seconds idle
    reading_speed_wpm: float    = 150.0 # current estimated wpm
    backtrack_count: int        = 0     # re-reads detected


@dataclass
class AttentionState:
    """Derived attention metrics for the RL agent state vector."""
    focus_score: float          = 1.0   # [0=distracted, 1=fully focused]
    reading_speed_norm: float   = 0.5   # normalised to [0, 1]
    mouse_dwell_norm: float     = 0.0   # normalised to [0, 1]
    scroll_hesitation_norm: float = 0.0
    backtrack_freq_norm: float  = 0.0
    is_attention_lapse: bool    = False # significant distraction detected
    lapse_duration: float       = 0.0  # seconds in lapse state


# ── Monitor ───────────────────────────────────────────────────────────────────

class AttentionMonitor:
    """
    Analyses telemetry streams and produces per-step attention states
    for the IncludEd RL agent.

    Tuned for primary school students aged 8–12 (P3–P6).
    """

    # Baselines for P3-P6 Rwandan students (from proposal & literature)
    BASELINE_WPM                = 120.0   # slow reader; fast is ~180 wpm
    MAX_WPM                     = 200.0
    LAPSE_IDLE_THRESHOLD        = 8.0     # seconds idle = attention lapse
    HIGH_DWELL_THRESHOLD        = 3.0     # seconds on one word = confusion
    HIGH_SCROLL_BACK_THRESHOLD  = 5       # scroll-backs in 30s window
    HIGH_BACKTRACK_THRESHOLD    = 4       # re-reads in session

    def __init__(self, window_size: int = 10):
        """
        Args:
            window_size: Number of recent telemetry events to use for
                         rolling averages (10 → ~1 minute at 6-sec intervals)
        """
        self.window_size = window_size
        self.history: List[TelemetryEvent] = []
        self.lapse_start: Optional[float] = None

    def add_event(self, event: TelemetryEvent) -> AttentionState:
        """
        Ingest a telemetry event and return updated attention state.
        Call this whenever the frontend sends new telemetry.
        """
        self.history.append(event)
        if len(self.history) > self.window_size:
            self.history.pop(0)

        return self._compute_state(event)

    def compute_from_dict(self, telemetry: dict) -> AttentionState:
        """Convenience wrapper: build TelemetryEvent from a plain dict."""
        event = TelemetryEvent(
            timestamp          = telemetry.get("timestamp", time.time()),
            mouse_speed        = float(telemetry.get("mouse_speed", 0)),
            mouse_dwell        = float(telemetry.get("mouse_dwell", 0)),
            scroll_back_count  = int(telemetry.get("scroll_back_count", 0)),
            key_latency        = float(telemetry.get("key_latency", 0)),
            idle_duration      = float(telemetry.get("idle_duration", 0)),
            reading_speed_wpm  = float(telemetry.get("reading_speed_wpm", self.BASELINE_WPM)),
            backtrack_count    = int(telemetry.get("backtrack_count", 0)),
        )
        return self.add_event(event)

    # ── Private helpers ───────────────────────────────────────────────────────

    def _compute_state(self, latest: TelemetryEvent) -> AttentionState:
        """Derive normalised attention state from raw telemetry."""

        # ── 1. Reading speed (normalised) ─────────────────────────────────────
        # Clip to realistic WPM range for this age group
        wpm_clamped = np.clip(latest.reading_speed_wpm, 10, self.MAX_WPM)
        reading_speed_norm = float((wpm_clamped - 10) / (self.MAX_WPM - 10))

        # ── 2. Mouse dwell (confusion proxy) ─────────────────────────────────
        dwell_norm = float(np.clip(latest.mouse_dwell / self.HIGH_DWELL_THRESHOLD, 0, 1))

        # ── 3. Scroll hesitation ──────────────────────────────────────────────
        scroll_norm = float(
            np.clip(latest.scroll_back_count / self.HIGH_SCROLL_BACK_THRESHOLD, 0, 1)
        )

        # ── 4. Backtrack frequency ────────────────────────────────────────────
        backtrack_norm = float(
            np.clip(latest.backtrack_count / self.HIGH_BACKTRACK_THRESHOLD, 0, 1)
        )

        # ── 5. Idle detection (attention lapse) ───────────────────────────────
        is_lapse = latest.idle_duration >= self.LAPSE_IDLE_THRESHOLD
        if is_lapse and self.lapse_start is None:
            self.lapse_start = latest.timestamp - latest.idle_duration
        elif not is_lapse:
            self.lapse_start = None

        lapse_duration = (
            latest.timestamp - self.lapse_start if is_lapse and self.lapse_start else 0.0
        )

        # ── 6. Composite focus score ──────────────────────────────────────────
        # Weighted formula:  high speed + low dwell + low scroll + low backtrack = focused
        negative_signals = (
            0.30 * dwell_norm +
            0.25 * scroll_norm +
            0.25 * backtrack_norm +
            0.20 * float(is_lapse)
        )
        # Also consider rolling trend: if recent events show improving speed → bonus
        if len(self.history) >= 3:
            recent_speeds = [e.reading_speed_wpm for e in self.history[-3:]]
            trend = (recent_speeds[-1] - recent_speeds[0]) / max(recent_speeds[0], 1)
            trend_bonus = np.clip(trend * 0.05, -0.1, 0.1)
        else:
            trend_bonus = 0.0

        focus_score = float(np.clip(
            (1.0 - negative_signals) * 0.7 + reading_speed_norm * 0.3 + trend_bonus,
            0.0, 1.0
        ))

        return AttentionState(
            focus_score             = focus_score,
            reading_speed_norm      = reading_speed_norm,
            mouse_dwell_norm        = dwell_norm,
            scroll_hesitation_norm  = scroll_norm,
            backtrack_freq_norm     = backtrack_norm,
            is_attention_lapse      = is_lapse,
            lapse_duration          = lapse_duration,
        )

    def reset(self):
        """Clear history (call at the start of a new reading session)."""
        self.history.clear()
        self.lapse_start = None

    def get_rl_state_vector(
        self,
        attention_state: AttentionState,
        disability_type: float,
        text_difficulty: float,
        session_fatigue: float,
    ) -> list:
        """
        Build the 8-dim state vector expected by IncludEdEnv / PPO model.

        Returns:
            [reading_speed, mouse_dwell, scroll_hesitation, backtrack_freq,
             attention_score, disability_type, text_difficulty, session_fatigue]
        """
        return [
            attention_state.reading_speed_norm,
            attention_state.mouse_dwell_norm,
            attention_state.scroll_hesitation_norm,
            attention_state.backtrack_freq_norm,
            attention_state.focus_score,
            float(disability_type),
            float(text_difficulty),
            float(session_fatigue),
        ]
