"""
RL Agent Service v2
====================
Wraps the trained PPO model with flexible state support:
  - v2 model: 9-dim state (adds content_type at index 8)
  - v1 model: 8-dim state (backward compatible)

Falls back to rule-based heuristic when no trained model is available.
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

# State vector indices for easier reference
IDX_SPEED      = 0
IDX_DWELL      = 1
IDX_HESITATION = 2
IDX_BACKTRACK  = 3
IDX_ATTENTION  = 4
IDX_DISABILITY = 5
IDX_DIFFICULTY = 6
IDX_FATIGUE    = 7

# Disability encoding
DISABILITY_NONE     = 0.0
DISABILITY_DYSLEXIA = 0.5
DISABILITY_ADHD     = 1.0
DISABILITY_BOTH     = 1.5


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

    # Additional search dirs relative to ai-service root
    EXTRA_MODEL_DIRS = [
        "rl-engine/models",
    ]

    EXTRA_MODEL_NAMES = [
        "ppo_included_v2.zip",
        "best_model.zip",
    ]

    def __init__(self):
        self.model       = None
        self.model_path  = None
        self.model_ready = False
        self._obs_dim    = 8   # default; updated after model load
        self._load_model()

    # ── Model lifecycle ───────────────────────────────────────────────────────

    HF_REPO_ID  = "nkubana0/included-rl-model"
    HF_FILENAME = "ppo_included_v2.zip"

    def _load_model(self):
        services_dir = os.path.dirname(__file__)
        app_dir = os.path.dirname(services_dir)  # ai-service root

        search_paths = [
            os.path.join(services_dir, name) for name in self.MODEL_CANDIDATES
        ] + [
            os.path.join(app_dir, extra_dir, name)
            for extra_dir in self.EXTRA_MODEL_DIRS
            for name in self.EXTRA_MODEL_NAMES
        ]

        # Try local paths first
        for path in search_paths:
            if os.path.exists(path):
                if self._try_load(path):
                    return

        # Fallback: download from HuggingFace Hub
        hf_path = self._download_from_hub(app_dir)
        if hf_path and self._try_load(hf_path):
            return

        print("⚠️  RL Agent: no compatible model found — using rule-based fallback.")
        self._obs_dim = 8

    def _try_load(self, path: str) -> bool:
        """Attempt to load a PPO model. Returns True on success."""
        try:
            from stable_baselines3 import PPO
            model = PPO.load(path)
            obs_dim = model.observation_space.shape[0]
            if obs_dim not in (8, 9):
                print(
                    f"⚠️  RL Agent: skipping {path} — observation space is "
                    f"{obs_dim}-dim (expected 8 or 9)."
                )
                return False
            self.model       = model
            self.model_path  = path
            self.model_ready = True
            self._obs_dim    = obs_dim
            print(f"✅ RL Agent: loaded {obs_dim}-dim model from {path}")
            return True
        except Exception as e:
            print(f"⚠️  RL Agent: failed to load {path}: {e}")
            return False

    def _download_from_hub(self, app_dir: str) -> Optional[str]:
        """Download model from HuggingFace Hub if not found locally."""
        try:
            from huggingface_hub import hf_hub_download
            print(f"⬇️  RL Agent: downloading model from HuggingFace Hub ({self.HF_REPO_ID})...")
            model_dir = os.path.join(app_dir, "rl-engine", "models")
            os.makedirs(model_dir, exist_ok=True)
            path = hf_hub_download(
                repo_id=self.HF_REPO_ID,
                filename=self.HF_FILENAME,
                local_dir=model_dir,
            )
            print(f"✅ RL Agent: model downloaded to {path}")
            return path
        except Exception as e:
            print(f"⚠️  RL Agent: HuggingFace Hub download failed: {e}")
            return None

    def reload_model(self):
        """Hot-reload the model (e.g., after a new training run)."""
        self.model       = None
        self.model_path  = None
        self.model_ready = False
        self._load_model()

    # ── Prediction ────────────────────────────────────────────────────────────

    def predict_from_state_vector(
        self,
        state_vector:  List[float],
        content_type:  float = 0.5,  # 0.0=generic, 0.5=novel, 1.0=play (v2 only)
    ) -> Tuple[int, str, str]:
        """
        Predict the best pedagogical action from a state vector.

        Args:
            state_vector: 8-dim [reading_speed, mouse_dwell, scroll_hesitation,
                           backtrack_freq, attention_score, disability_type,
                           text_difficulty, session_fatigue]
                          OR 9-dim (include content_type as last element)
            content_type: content type encoding for v2 models (appended if needed)

        Returns:
            (action_id, action_label, reasoning)
        """
        if len(state_vector) not in (8, 9):
            raise ValueError(
                f"Expected 8 or 9-dim state, got {len(state_vector)}"
            )

        if self.model_ready:
            vec = list(state_vector)
            # Pad 8-dim → 9-dim if v2 model loaded
            if self._obs_dim == 9 and len(vec) == 8:
                vec.append(content_type)
            # Trim 9-dim → 8-dim if v1 model loaded
            elif self._obs_dim == 8 and len(vec) == 9:
                vec = vec[:8]

            obs = np.array(vec, dtype=np.float32)
            action, _ = self.model.predict(obs, deterministic=True)
            action_id = int(action)
        else:
            action_id = self._rule_based_fallback(state_vector[:8])

        label = ACTION_LABELS.get(action_id, "Unknown")
        reason = self._get_pedagogical_reasoning(state_vector[:8], action_id)

        return action_id, label, reason

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
    ) -> Tuple[int, str, str]:
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

        # Both (Dyslexia + ADHD) - High support needs
        if disability_type >= 1.4:
            if attention_score < 0.5 or session_fatigue > 0.5:
                return 5  # Attention Break
            if mouse_dwell > 0.4 or backtrack_freq > 0.4:
                return 4  # Syllable Break
            return 2      # Heavy Simplification

        # ADHD profile
        if 0.9 <= disability_type <= 1.1:
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

    def _get_pedagogical_reasoning(self, state: List[float], action_id: int) -> str:
        """
        Derives a human-readable explanation for the chosen RL action.
        """
        if action_id == 0:
            return "Student is in a flow state with optimal comprehension."
        
        # High-level triggers based on the state vector
        speed       = state[IDX_SPEED]
        dwell       = state[IDX_DWELL]
        backtrack   = state[IDX_BACKTRACK]
        attention   = state[IDX_ATTENTION]
        difficulty  = state[IDX_DIFFICULTY]
        fatigue     = state[IDX_FATIGUE]

        reasons = []
        if action_id == 1: # Light Simplification
            if attention < 0.5: reasons.append("Subtle drop in focus detected.")
            if difficulty > 0.6: reasons.append("Text complexity is slightly elevated for current pace.")
            return " ".join(reasons) or "Lightening the cognitive load for easier flow."

        if action_id == 2: # Heavy Simplification
            if difficulty > 0.8: reasons.append("Extremely high text difficulty detected.")
            if backtrack > 0.4: reasons.append("Frequent re-reading suggest comprehension breakdown.")
            return " ".join(reasons) or "Switching to simplified version to bridge major comprehension gaps."

        if action_id == 3: # TTS + Highlights
            if backtrack > 0.3: reasons.append("Visual decoding strain identified through backtracking.")
            if difficulty > 0.5: reasons.append("Multi-modal support requested to aid word recognition.")
            return " ".join(reasons) or "Enabling audio-visual support to assist with decoding."

        if action_id == 4: # Syllable Break
            if dwell > 0.5: reasons.append("High dwell time indicates struggle with multi-syllabic words.")
            if backtrack > 0.3: reasons.append("Phonemic decoding error suspected.")
            return " ".join(reasons) or "Breaking down words into sounds to support decoding."

        if action_id == 5: # Attention Break
            if attention < 0.3: reasons.append("Critical dip in attention score.")
            if fatigue > 0.7: reasons.append("High session fatigue detected.")
            return " ".join(reasons) or "Suggesting a focus refresh to recover from cognitive fatigue."

        return "Pedagogical intervention triggered by reading telemetry patterns."

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _encode_disability(self, disability_profile: Optional[Dict]) -> float:
        if not disability_profile:
            return DISABILITY_NONE
        disabilities = disability_profile.get("disabilities", [])
        if "adhd" in disabilities and "dyslexia" in disabilities:
            return DISABILITY_BOTH
        if "adhd" in disabilities:
            return DISABILITY_ADHD
        if "dyslexia" in disabilities:
            return DISABILITY_DYSLEXIA
        return DISABILITY_NONE

    def status(self) -> Dict:
        labels_8 = [
            "reading_speed", "mouse_dwell", "scroll_hesitation",
            "backtrack_freq", "attention_score", "disability_type",
            "text_difficulty", "session_fatigue",
        ]
        labels_9 = labels_8 + ["content_type"]
        return {
            "model_loaded":  self.model_ready,
            "model_path":    self.model_path,
            "action_space":  ACTION_LABELS,
            "state_dims":    self._obs_dim,
            "model_version": "v2" if self._obs_dim == 9 else "v1",
            "state_labels":  labels_9 if self._obs_dim == 9 else labels_8,
        }