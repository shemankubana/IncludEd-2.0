"""
Reading Session Manager
========================
Manages the lifecycle of a student reading session in memory.
Accumulates telemetry, tracks RL actions taken, and computes
a final reward signal when the session ends.

A session object stores:
  - student metadata (id, disability type, grade)
  - accumulated telemetry events
  - running RL action history
  - quiz score (set at end of session)
  - derived metrics (fatigue, avg attention, completion rate)
"""

import uuid
import time
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import numpy as np

from services.attention_monitor import AttentionMonitor, AttentionState, TelemetryEvent


# ── Session data ──────────────────────────────────────────────────────────────

@dataclass
class RLAction:
    """Record of a single RL decision during a session."""
    step_number: int
    action_id: int
    action_label: str
    state_vector: List[float]
    timestamp: float = field(default_factory=time.time)


@dataclass
class ReadingSession:
    """Full state of an active reading session."""
    session_id: str
    student_id: str
    disability_type: float          # 0.0=none, 0.5=dyslexia, 1.0=ADHD
    text_difficulty: float
    literature_id: Optional[str]    = None
    started_at: float               = field(default_factory=time.time)
    ended_at: Optional[float]       = None

    # Accumulated data
    telemetry_events: List[Dict]    = field(default_factory=list)
    rl_actions: List[RLAction]      = field(default_factory=list)
    attention_history: List[float]  = field(default_factory=list)

    # Computed metrics
    session_fatigue: float          = 0.0
    avg_attention: float            = 1.0
    completion_rate: float          = 0.0
    quiz_score: Optional[float]     = None      # 0–1, set at session end
    final_reward: Optional[float]   = None

    # Status
    is_active: bool                 = True


# ── Session Manager ───────────────────────────────────────────────────────────

class SessionManager:
    """
    In-memory manager for active reading sessions.
    The backend Node.js service is responsible for persisting sessions
    to PostgreSQL once they end.
    """

    def __init__(self):
        self._sessions: Dict[str, ReadingSession] = {}
        self._monitors: Dict[str, AttentionMonitor] = {}

    # ── Session lifecycle ─────────────────────────────────────────────────────

    def start_session(
        self,
        student_id: str,
        disability_type: float,
        text_difficulty: float,
        literature_id: Optional[str] = None,
    ) -> ReadingSession:
        """Create and register a new reading session."""
        session_id = str(uuid.uuid4())
        session = ReadingSession(
            session_id      = session_id,
            student_id      = student_id,
            disability_type = disability_type,
            text_difficulty = text_difficulty,
            literature_id   = literature_id,
        )
        self._sessions[session_id] = session
        self._monitors[session_id] = AttentionMonitor(window_size=10)
        return session

    def end_session(
        self,
        session_id: str,
        quiz_score: Optional[float] = None,
        completion_rate: float = 1.0,
    ) -> Optional[ReadingSession]:
        """
        Finalise a session.  Computes final reward from quiz score and
        attention metrics, marks session inactive.
        """
        session = self._sessions.get(session_id)
        if not session:
            return None

        session.ended_at        = time.time()
        session.is_active       = False
        session.completion_rate = completion_rate
        session.quiz_score      = quiz_score

        if session.attention_history:
            session.avg_attention = float(np.mean(session.attention_history))

        # Compute final RL reward signal
        session.final_reward = self._compute_final_reward(session)

        return session

    def get_session(self, session_id: str) -> Optional[ReadingSession]:
        return self._sessions.get(session_id)

    def list_active_sessions(self) -> List[str]:
        return [sid for sid, s in self._sessions.items() if s.is_active]

    # ── Telemetry processing ──────────────────────────────────────────────────

    def add_telemetry(
        self, session_id: str, telemetry: dict
    ) -> Optional[AttentionState]:
        """
        Push a telemetry event into a session.
        Returns the computed AttentionState (for the RL agent).
        """
        session = self._sessions.get(session_id)
        monitor = self._monitors.get(session_id)
        if not session or not monitor or not session.is_active:
            return None

        # Store raw telemetry
        session.telemetry_events.append(telemetry)

        # Compute attention state
        attention_state = monitor.compute_from_dict(telemetry)

        # Update running fatigue model
        session.attention_history.append(attention_state.focus_score)
        if len(session.attention_history) >= 3:
            # Fatigue rises when attention continuously drops
            recent = session.attention_history[-3:]
            if recent[-1] < recent[0] - 0.15:
                session.session_fatigue = min(1.0, session.session_fatigue + 0.06)
            elif recent[-1] > recent[0] + 0.1:
                session.session_fatigue = max(0.0, session.session_fatigue - 0.03)

        # Natural fatigue accumulation
        elapsed_minutes = (time.time() - session.started_at) / 60.0
        session.session_fatigue = min(1.0, session.session_fatigue + elapsed_minutes * 0.005)

        return attention_state

    def get_rl_state(self, session_id: str, telemetry: dict) -> Optional[List[float]]:
        """
        Process telemetry and return the 8-dim RL state vector for this session.
        """
        session = self._sessions.get(session_id)
        monitor = self._monitors.get(session_id)
        if not session or not monitor:
            return None

        attention_state = monitor.compute_from_dict(telemetry)

        return monitor.get_rl_state_vector(
            attention_state = attention_state,
            disability_type = session.disability_type,
            text_difficulty = session.text_difficulty,
            session_fatigue = session.session_fatigue,
        )

    # ── RL tracking ───────────────────────────────────────────────────────────

    def record_rl_action(
        self,
        session_id: str,
        action_id: int,
        action_label: str,
        state_vector: List[float],
    ):
        session = self._sessions.get(session_id)
        if session and session.is_active:
            step = len(session.rl_actions) + 1
            session.rl_actions.append(RLAction(
                step_number  = step,
                action_id    = action_id,
                action_label = action_label,
                state_vector = state_vector,
            ))

    # ── Reward computation ────────────────────────────────────────────────────

    def _compute_final_reward(self, session: ReadingSession) -> float:
        """
        Holistic end-of-session reward for offline RL batch training.

        Components:
          quiz_score       (0–1) → primary signal (40%)
          avg_attention    (0–1) → sustained attention (30%)
          completion_rate  (0–1) → engagement (20%)
          fatigue_penalty         → penalises exhaustion (10%)
        """
        quiz_part        = (session.quiz_score or 0.0) * 0.40
        attention_part   = session.avg_attention         * 0.30
        completion_part  = session.completion_rate       * 0.20
        fatigue_penalty  = session.session_fatigue       * 0.10

        reward = quiz_part + attention_part + completion_part - fatigue_penalty
        return float(np.clip(reward, 0.0, 1.0))

    # ── Session serialisation ─────────────────────────────────────────────────

    def session_to_dict(self, session: ReadingSession) -> Dict[str, Any]:
        """Convert session to a JSON-serialisable dict for the API response."""
        duration = (
            (session.ended_at or time.time()) - session.started_at
        )
        return {
            "session_id":       session.session_id,
            "student_id":       session.student_id,
            "disability_type":  session.disability_type,
            "text_difficulty":  session.text_difficulty,
            "literature_id":    session.literature_id,
            "duration_seconds": round(duration, 1),
            "is_active":        session.is_active,
            "avg_attention":    round(session.avg_attention, 3),
            "session_fatigue":  round(session.session_fatigue, 3),
            "completion_rate":  round(session.completion_rate, 3),
            "quiz_score":       session.quiz_score,
            "final_reward":     session.final_reward,
            "total_rl_actions": len(session.rl_actions),
            "total_telemetry_events": len(session.telemetry_events),
            "rl_actions": [
                {
                    "step":         a.step_number,
                    "action_id":    a.action_id,
                    "action_label": a.action_label,
                }
                for a in session.rl_actions
            ],
        }
