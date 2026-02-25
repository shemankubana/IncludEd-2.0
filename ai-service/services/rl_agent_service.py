"""
RL Agent Service (Updated)
===========================
Wraps the trained PPO model (ppo_included_agent.zip) with an 8-dim state
and 6-action space aligned with the IncludEd research proposal.

Falls back to an evidence-based rule-based heuristic when the model file
is not present (e.g., before first training run).
"""

import numpy as np
import os
from typing import Optional, Dict, List, Tuple


# Action labels mirror IncludEdEnv.ACTION_LABELS
ACTION_LABELS = {
    0: "Keep Original",
    1: "Light Simplification",
    2: "Heavy Simplification",
    3: "TTS + Highlights",
    4: "Syllable Break",
    5: "Attention Break",
}

# Disability encoding
DISABILITY_NONE     = 0.0
DISABILITY_DYSLEXIA = 0.5
DISABILITY_ADHD     = 1.0


class RLAgentService:
    """
    Loads and serves the PPO model for real-time RL predictions.
    Accepts 8-dimensional state vectors matching the IncludEdEnv.
    """

    # Try loading the new model first; fall back to the old one for continuity
    MODEL_CANDIDATES = [
        "ppo_included_agent.zip",
        "ppo_literature_agent.zip",
    ]

    def __init__(self):
        self.model       = None
        self.model_path  = None
        self.model_ready = False
        self._load_model()

    # ── Model lifecycle ───────────────────────────────────────────────────────

    def _load_model(self):
        base_dir = os.path.dirname(__file__)
        for candidate in self.MODEL_CANDIDATES:
            path = os.path.join(base_dir, candidate)
            if os.path.exists(path):
                try:
                    from stable_baselines3 import PPO
                    self.model      = PPO.load(path)
                    self.model_path = path
                    self.model_ready = True
                    print(f"✅ RL Agent: loaded model from {path}")
                    return
                except Exception as e:
                    print(f"⚠️  RL Agent: failed to load {path}: {e}")

        print("⚠️  RL Agent: no trained model found — using rule-based fallback.")

    def reload_model(self):
        """Hot-reload the model (e.g., after a new training run)."""
        self.model       = None
        self.model_path  = None
        self.model_ready = False
        self._load_model()

    # ── Prediction ────────────────────────────────────────────────────────────

    def predict_from_state_vector(
        self, state_vector: List[float]
    ) -> Tuple[int, str]:
        """
        Predict the best pedagogical action from a raw 8-dim state vector.

        Args:
            state_vector: [reading_speed, mouse_dwell, scroll_hesitation,
                           backtrack_freq, attention_score, disability_type,
                           text_difficulty, session_fatigue]

        Returns:
            (action_id, action_label)
        """
        if len(state_vector) != 8:
            raise ValueError(f"Expected 8-dim state, got {len(state_vector)}")

        if self.model_ready:
            obs = np.array(state_vector, dtype=np.float32)
            action, _ = self.model.predict(obs, deterministic=True)
            action_id = int(action)
        else:
            action_id = self._rule_based_fallback(state_vector)

        return action_id, ACTION_LABELS.get(action_id, "Unknown")

    def predict_action(
        self,
        text_difficulty: float,
        student_focus: float,
        disability_profile: Optional[Dict] = None,
        # Extended fields (optional, default to neutral)
        reading_speed: float     = 0.5,
        mouse_dwell: float       = 0.0,
        scroll_hesitation: float = 0.0,
        backtrack_freq: float    = 0.0,
        session_fatigue: float   = 0.0,
    ) -> Tuple[int, str]:
        """
        Backwards-compatible prediction method (also used by /adapt-text).
        Constructs the full 8-dim state from available parameters.
        """
        disability_val = self._encode_disability(disability_profile)

        state_vector = [
            reading_speed,
            mouse_dwell,
            scroll_hesitation,
            backtrack_freq,
            student_focus,
            disability_val,
            text_difficulty,
            session_fatigue,
        ]
        return self.predict_from_state_vector(state_vector)

    # ── Rule-based fallback ───────────────────────────────────────────────────

    def _rule_based_fallback(self, state_vector: List[float]) -> int:
        """
        Evidence-based heuristic (matches IncludEdEnv reward logic).
        Used when no trained model is available.
        """
        (reading_speed, mouse_dwell, scroll_hesitation,
         backtrack_freq, attention_score, disability_type,
         text_difficulty, session_fatigue) = state_vector

        # ADHD profile
        if disability_type >= 0.9:
            if attention_score < 0.4 or session_fatigue > 0.6:
                return 5  # Attention Break
            return 2       # Heavy Simplification

        # Dyslexia profile
        if 0.4 <= disability_type <= 0.6:
            if mouse_dwell > 0.5 or backtrack_freq > 0.5:
                return 4   # Syllable Break
            return 3       # TTS + Highlights

        # No disability
        if attention_score < 0.3:
            return 1       # Light Simplification
        return 0           # Keep Original

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _encode_disability(disability_profile: Optional[Dict]) -> float:
        if not disability_profile:
            return DISABILITY_NONE
        disabilities = disability_profile.get("disabilities", [])
        if "adhd" in disabilities and "dyslexia" in disabilities:
            return DISABILITY_ADHD   # ADHD takes priority in dual profile
        if "adhd" in disabilities:
            return DISABILITY_ADHD
        if "dyslexia" in disabilities:
            return DISABILITY_DYSLEXIA
        return DISABILITY_NONE

    def status(self) -> Dict:
        return {
            "model_loaded": self.model_ready,
            "model_path":   self.model_path,
            "action_space": ACTION_LABELS,
            "state_dims":   8,
            "state_labels": [
                "reading_speed", "mouse_dwell", "scroll_hesitation",
                "backtrack_freq", "attention_score", "disability_type",
                "text_difficulty", "session_fatigue",
            ],
        }