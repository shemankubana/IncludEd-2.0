"""
included_env.py
===============
IncludEdEnv — Gymnasium environment for adaptive literary content delivery.

State space (9-dim, v2):
  [0] reading_speed       — normalised WPM [0,1]
  [1] mouse_dwell         — avg dwell time normalised [0,1]
  [2] scroll_hesitation   — proportion of slow/backward scrolls [0,1]
  [3] backtrack_freq      — backward scrolls / total scrolls [0,1]
  [4] attention_score     — composite attention signal [0,1]
  [5] disability_type     — 0.0=none, 0.5=dyslexia, 1.0=ADHD, 1.5=both
  [6] text_difficulty     — Flesch-Kincaid normalised [0,1]
  [7] session_fatigue     — elapsed time / max time [0,1]
  [8] content_type        — 0.0=generic, 0.5=novel, 1.0=play

Action space (6 discrete):
  0 = Keep Original
  1 = Light Simplification  (vocabulary only)
  2 = Heavy Simplification  (full rewrite)
  3 = TTS + Highlights
  4 = Syllable Break
  5 = Attention Break       (micro-sections)

Reward structure:
  - Disability-specific action values (empirically tuned)
  - Content-type modifier: plays benefit more from TTS/animation
  - Fatigue penalty to discourage late-session heavy actions
  - Repetition penalty for consecutive same actions

BACKWARD COMPATIBILITY:
  The rl_agent_service.py uses an 8-dim state. This env now uses 9-dim.
  Trained models from v1 (8-dim) will NOT load into this environment.
  Run train_model.py to train a fresh v2 model.
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
import random
from typing import Optional, Dict, Union


class IncludEdEnv(gym.Env):
    """
    Adaptive Learning Environment for Dyslexia & ADHD students.
    v2: content-type aware rewards, 9-dimensional state space.
    """

    metadata = {"render_modes": ["human"]}

    ACTION_LABELS = {
        0: "Keep Original",
        1: "Light Simplification",
        2: "Heavy Simplification",
        3: "TTS + Highlights",
        4: "Syllable Break",
        5: "Attention Break",
    }

    STATE_LABELS = [
        "reading_speed",
        "mouse_dwell",
        "scroll_hesitation",
        "backtrack_freq",
        "attention_score",
        "disability_type",
        "text_difficulty",
        "session_fatigue",
        "content_type",
    ]

    # Disability encodings
    DISABILITY_NONE     = 0.0
    DISABILITY_DYSLEXIA = 0.5
    DISABILITY_ADHD     = 1.0
    DISABILITY_BOTH     = 1.5

    # Content type encodings
    CONTENT_GENERIC = 0.0
    CONTENT_NOVEL   = 0.5
    CONTENT_PLAY    = 1.0

    def __init__(self, render_mode: Optional[str] = None):
        super().__init__()
        self.render_mode = render_mode

        self.action_space = spaces.Discrete(6)

        # 9-dimensional observation space
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(9,), dtype=np.float32
        )

        self.max_steps = 120
        self._reset_state()

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _normalize_action(self, action: Union[int, np.ndarray]) -> int:
        if isinstance(action, np.ndarray):
            return int(np.asarray(action).item())
        return int(action)

    # ── Internal state ────────────────────────────────────────────────────────

    def _reset_state(self):
        self.current_step      = 0
        self.cumulative_reward = 0.0

        # Disability distribution: 30% none, 25% dyslexia, 25% ADHD, 20% both
        r = random.random()
        if r < 0.30:
            self.disability_type = self.DISABILITY_NONE
        elif r < 0.55:
            self.disability_type = self.DISABILITY_DYSLEXIA
        elif r < 0.80:
            self.disability_type = self.DISABILITY_ADHD
        else:
            self.disability_type = self.DISABILITY_BOTH

        # Content type distribution: 30% generic, 40% novel, 30% play
        c = random.random()
        if c < 0.3:
            self.content_type = self.CONTENT_GENERIC
        elif c < 0.7:
            self.content_type = self.CONTENT_NOVEL
        else:
            self.content_type = self.CONTENT_PLAY

        self.text_difficulty   = random.uniform(0.3, 0.9)
        self.reading_speed     = random.uniform(0.3, 0.8)
        self.mouse_dwell       = random.uniform(0.0, 0.4)
        self.scroll_hesitation = random.uniform(0.0, 0.3)
        self.backtrack_freq    = random.uniform(0.0, 0.3)
        self.attention_score   = random.uniform(0.5, 1.0)
        self.session_fatigue   = 0.0

        self.last_action              = -1
        self.consecutive_same_action  = 0

    def _get_obs(self) -> np.ndarray:
        return np.array([
            self.reading_speed,
            self.mouse_dwell,
            self.scroll_hesitation,
            self.backtrack_freq,
            self.attention_score,
            self.disability_type,
            self.text_difficulty,
            self.session_fatigue,
            self.content_type,
        ], dtype=np.float32)

    # ── Gym API ───────────────────────────────────────────────────────────────

    def reset(self, seed: Optional[int] = None, options: Optional[Dict] = None):
        super().reset(seed=seed)
        self._reset_state()
        return self._get_obs(), {}

    def step(self, action):
        action = self._normalize_action(action)

        self.current_step += 1
        reward = self._compute_reward(action)
        self._update_state(action, reward)

        self.cumulative_reward += reward
        terminated = self.current_step >= self.max_steps
        truncated  = False

        info = {
            "action_label":    self.ACTION_LABELS[action],
            "disability_type": self.disability_type,
            "content_type":    self.content_type,
            "attention_score": self.attention_score,
            "session_fatigue": self.session_fatigue,
            "step":            self.current_step,
        }

        return self._get_obs(), reward, terminated, truncated, info

    # ── Reward function ───────────────────────────────────────────────────────

    def _compute_reward(self, action: int) -> float:
        """
        Disability-specific base reward × content-type modifier × attention bonus.

        Reward shaping:
          - Dyslexia: TTS+Highlights (0.7) and Syllable (0.9) are most effective
          - ADHD:     Heavy Simplify (0.8) and Attention Break (0.9) are most effective
          - None:     Keep Original (0.6) preferred; Heavy Simplify penalised
          - Play:     TTS+Highlights gets +0.15 bonus (richer engagement)
          - Novel:    Syllable Break gets +0.1 bonus (decoding aid)
          - Fatigue:  Late-session heavy actions penalised
        """
        # ── Base disability impact ─────────────────────────────────────────────
        if self.disability_type == self.DISABILITY_DYSLEXIA:
            impact_map = {0: -0.3, 1: 0.2, 2: 0.1, 3: 0.7, 4: 0.9, 5: -0.1}
        elif self.disability_type == self.DISABILITY_ADHD:
            impact_map = {0: -0.4, 1: 0.2, 2: 0.8, 3: 0.3, 4: -0.1, 5: 0.9}
        elif self.disability_type >= self.DISABILITY_BOTH - 0.1: # both
            impact_map = {0: -0.5, 1: 0.1, 2: 0.7, 3: 0.5, 4: 0.8, 5: 0.9}
        else:
            impact_map = {0: 0.6, 1: 0.1, 2: -0.3, 3: -0.1, 4: -0.2, 5: -0.1}

        base_impact = impact_map[action]

        # ── Content-type modifier ──────────────────────────────────────────────
        # Plays benefit from TTS+Highlights (dialogue, voices, animation)
        if self.content_type == self.CONTENT_PLAY and action == 3:
            base_impact += 0.15
        # Novels benefit from Syllable Break (dense prose decoding)
        elif self.content_type == self.CONTENT_NOVEL and action == 4:
            base_impact += 0.10
        # Plays benefit from Attention Break (shorter dialogue chunks easier to follow)
        elif self.content_type == self.CONTENT_PLAY and action == 5:
            base_impact += 0.05

        # ── Attention modifier ────────────────────────────────────────────────
        if self.attention_score < 0.4:
            base_impact *= (1.4 if base_impact > 0 else 1.2)

        # ── Difficulty modifier ────────────────────────────────────────────────
        if self.text_difficulty > 0.7 and action in {1, 2, 3, 4}:
            base_impact += 0.1

        # ── Repetition penalty ────────────────────────────────────────────────
        if action == self.last_action:
            self.consecutive_same_action += 1
            if self.consecutive_same_action >= 3:
                base_impact -= 0.15
        else:
            self.consecutive_same_action = 0

        # ── Fatigue penalty ───────────────────────────────────────────────────
        fatigue_penalty = self.session_fatigue * 0.25

        return float(np.clip(base_impact - fatigue_penalty, -1.0, 1.0))

    # ── State dynamics ────────────────────────────────────────────────────────

    def _update_state(self, action: int, reward: float):
        rng = np.random.default_rng()

        if reward > 0.3:
            # Good action: student improves
            self.attention_score   = np.clip(self.attention_score   + rng.uniform(0.05, 0.15), 0, 1)
            self.reading_speed     = np.clip(self.reading_speed     + rng.uniform(0.02, 0.08), 0, 1)
            self.mouse_dwell       = np.clip(self.mouse_dwell       - rng.uniform(0.02, 0.07), 0, 1)
            self.scroll_hesitation = np.clip(self.scroll_hesitation - rng.uniform(0.02, 0.06), 0, 1)
            self.backtrack_freq    = np.clip(self.backtrack_freq    - rng.uniform(0.02, 0.05), 0, 1)
            self.session_fatigue   = np.clip(self.session_fatigue   - 0.05,                    0, 1)
        else:
            # Poor action: student disengages
            self.attention_score   = np.clip(self.attention_score   - rng.uniform(0.05, 0.12), 0, 1)
            self.reading_speed     = np.clip(self.reading_speed     - rng.uniform(0.01, 0.05), 0, 1)
            self.mouse_dwell       = np.clip(self.mouse_dwell       + rng.uniform(0.02, 0.08), 0, 1)
            self.scroll_hesitation = np.clip(self.scroll_hesitation + rng.uniform(0.02, 0.07), 0, 1)
            self.backtrack_freq    = np.clip(self.backtrack_freq    + rng.uniform(0.01, 0.04), 0, 1)
            self.session_fatigue   = np.clip(self.session_fatigue   + 0.08,                    0, 1)

        # Fatigue increases every step regardless
        self.session_fatigue = np.clip(self.session_fatigue + 0.005, 0, 1)
        self.last_action     = action

    # ── Render ────────────────────────────────────────────────────────────────

    def render(self):
        if self.render_mode == "human":
            content_name = {
                0.0: "generic", 0.5: "novel", 1.0: "play"
            }.get(self.content_type, "?")
            disability_name = {
                0.0: "none", 0.5: "dyslexia", 1.0: "adhd", 1.5: "both"
            }.get(self.disability_type, "?")
            print(
                f"Step {self.current_step:3d} | "
                f"Disability: {disability_name} | "
                f"Content: {content_name} | "
                f"Attention: {self.attention_score:.2f} | "
                f"Fatigue: {self.session_fatigue:.2f} | "
                f"Cumulative: {self.cumulative_reward:.3f}"
            )
