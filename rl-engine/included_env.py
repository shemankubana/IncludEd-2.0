"""
IncludEd Reinforcement Learning Environment
============================================
Proposal-aligned Gymnasium environment for adaptive learning.

State Space (8 dimensions):
  [reading_speed, mouse_dwell, scroll_hesitation, backtrack_freq,
   attention_score, disability_type, text_difficulty, session_fatigue]

Action Space (6 discrete actions):
  0 = Keep_Original
  1 = Light_Simplification   (shorter sentences, simpler vocab)
  2 = Heavy_Simplification   (summary/chunked paragraphs)
  3 = TTS_Highlights         (text-to-speech + word highlighting)
  4 = Syllable_Break         (dyslexia-optimised: syllable splitting + spacing)
  5 = Attention_Break        (ADHD-optimised: short break prompt + micro-task)

Reward:
  Primarily driven by quiz_score delta and sustained attention duration.
  Penalises unnecessary interventions for students without disabilities.
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
import random
from typing import Optional, Dict


class IncludEdEnv(gym.Env):
    """
    Adaptive Learning Environment for Dyslexia & ADHD students.
    Aligned with IncludEd research proposal (PPO/DQN target).
    """

    metadata = {"render_modes": ["human"]}

    # ── Action labels (for logging / Streamlit UI) ──────────────────────────
    ACTION_LABELS = {
        0: "Keep Original",
        1: "Light Simplification",
        2: "Heavy Simplification",
        3: "TTS + Highlights",
        4: "Syllable Break",
        5: "Attention Break",
    }

    # ── Disability type encoding ─────────────────────────────────────────────
    DISABILITY_NONE    = 0.0
    DISABILITY_DYSLEXIA = 0.5
    DISABILITY_ADHD    = 1.0

    def __init__(self, render_mode: Optional[str] = None):
        super().__init__()
        self.render_mode = render_mode

        # 6 pedagogical actions
        self.action_space = spaces.Discrete(6)

        # 8-dimensional observation — all values normalised to [0, 1]
        # Indices:
        #   0  reading_speed        (0=very slow, 1=fast)
        #   1  mouse_dwell          (0=no hovering, 1=long hover = confusion signal)
        #   2  scroll_hesitation    (0=smooth, 1=lots of back-scrolling)
        #   3  backtrack_freq       (0=no re-reads, 1=frequent re-reads)
        #   4  attention_score      (0=distracted, 1=fully focused)
        #   5  disability_type      (0.0=none, 0.5=dyslexia, 1.0=ADHD)
        #   6  text_difficulty      (0=easy, 1=hard)
        #   7  session_fatigue      (0=fresh, 1=exhausted)
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(8,), dtype=np.float32
        )

        self.max_steps = 120  # ~20-min session at 10s per step
        self._reset_state()

    # ── Internal state ───────────────────────────────────────────────────────

    def _reset_state(self):
        self.current_step = 0
        self.cumulative_reward = 0.0

        # Randomise disability profile (40% none, 30% dyslexia, 30% ADHD)
        r = random.random()
        if r < 0.4:
            self.disability_type = self.DISABILITY_NONE
        elif r < 0.7:
            self.disability_type = self.DISABILITY_DYSLEXIA
        else:
            self.disability_type = self.DISABILITY_ADHD

        # Randomise initial session conditions
        self.text_difficulty   = random.uniform(0.3, 0.9)
        self.reading_speed     = random.uniform(0.3, 0.8)
        self.mouse_dwell       = random.uniform(0.0, 0.4)
        self.scroll_hesitation = random.uniform(0.0, 0.3)
        self.backtrack_freq    = random.uniform(0.0, 0.3)
        self.attention_score   = random.uniform(0.5, 1.0)
        self.session_fatigue   = 0.0

        # Track last action for history-dependent rewards
        self.last_action = -1
        self.consecutive_same_action = 0

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
        ], dtype=np.float32)

    # ── Gym API ──────────────────────────────────────────────────────────────

    def reset(self, seed: Optional[int] = None, options: Optional[Dict] = None):
        super().reset(seed=seed)
        self._reset_state()
        return self._get_obs(), {}

    def step(self, action):
        action = int(np.asarray(action).item())   # handles scalar, 0-d array, or list
        self.current_step += 1
        reward = self._compute_reward(action)
        self._update_state(action, reward)

        self.cumulative_reward += reward
        terminated = self.current_step >= self.max_steps
        truncated  = False

        info = {
            "action_label":    self.ACTION_LABELS[action],
            "disability_type": self.disability_type,
            "attention_score": self.attention_score,
            "session_fatigue": self.session_fatigue,
            "step":            self.current_step,
        }

        return self._get_obs(), reward, terminated, truncated, info

    # ── Reward function ──────────────────────────────────────────────────────

    def _compute_reward(self, action: int) -> float:
        """
        Reward reflects educational psychology of learning disabilities.

        Key principles:
          - Dyslexia   → benefits from TTS/Highlights (action 3) and Syllable Break (action 4)
          - ADHD        → benefits from Attention Break (action 5) and Heavy Simplification (action 2)
          - No disability → minimal intervention is optimal (action 0/1)
          - Fatigue penalises bad actions more aggressively
          - Repeating the same action too often diminishes reward (exploration)
        """
        base_impact = 0.0
        fatigue_penalty = self.session_fatigue * 0.25

        # ── Disability-specific impact ───────────────────────────────────────
        if self.disability_type == self.DISABILITY_DYSLEXIA:
            impact_map = {
                0: -0.3,   # Keep original: unhelpful
                1:  0.2,   # Light simplification: mildly helpful
                2:  0.1,   # Heavy simplification: not targeted
                3:  0.7,   # TTS + Highlights: very beneficial
                4:  0.9,   # Syllable Break: best for dyslexia
                5: -0.1,   # Attention break: not primary need
            }
        elif self.disability_type == self.DISABILITY_ADHD:
            impact_map = {
                0: -0.4,   # Keep original: unhelpful for ADHD
                1:  0.2,   # Light simplification: slightly helpful
                2:  0.8,   # Heavy simplification: great for focus
                3:  0.3,   # TTS: moderately helpful
                4: -0.1,   # Syllable break: not targeted
                5:  0.9,   # Attention break: best for ADHD
            }
        else:  # No disability
            impact_map = {
                0:  0.6,   # Keep original: ideal
                1:  0.1,   # Light: unnecessary
                2: -0.3,   # Heavy: patronising
                3: -0.1,   # TTS: not needed
                4: -0.2,   # Syllable: not needed
                5: -0.1,   # Attention break: not needed
            }

        base_impact = impact_map[action]

        # ── Attention modifier ───────────────────────────────────────────────
        # Low attention amplifies the benefit of correct interventions
        if self.attention_score < 0.4:
            if base_impact > 0:
                base_impact *= 1.4   # Correct action when distracted = extra reward
            else:
                base_impact *= 1.2   # Wrong action when distracted = extra penalty

        # ── Difficulty modifier ──────────────────────────────────────────────
        if self.text_difficulty > 0.7 and action in [1, 2, 3, 4]:
            base_impact += 0.1   # Simplification bonus on hard text

        # ── Repetition penalty (encourage exploration) ───────────────────────
        if action == self.last_action:
            self.consecutive_same_action += 1
            if self.consecutive_same_action >= 3:
                base_impact -= 0.15  # Penalise over-reliance on one strategy
        else:
            self.consecutive_same_action = 0

        reward = float(np.clip(base_impact - fatigue_penalty, -1.0, 1.0))
        return reward

    # ── State dynamics ───────────────────────────────────────────────────────

    def _update_state(self, action: int, reward: float):
        """Simulate how student state evolves after an intervention."""
        rng = np.random.default_rng()

        if reward > 0.3:
            # Positive intervention → student improves
            self.attention_score    = np.clip(self.attention_score    + rng.uniform(0.05, 0.15), 0, 1)
            self.reading_speed      = np.clip(self.reading_speed      + rng.uniform(0.02, 0.08), 0, 1)
            self.mouse_dwell        = np.clip(self.mouse_dwell        - rng.uniform(0.02, 0.07), 0, 1)
            self.scroll_hesitation  = np.clip(self.scroll_hesitation  - rng.uniform(0.02, 0.06), 0, 1)
            self.backtrack_freq     = np.clip(self.backtrack_freq     - rng.uniform(0.02, 0.05), 0, 1)
            self.session_fatigue    = np.clip(self.session_fatigue    - 0.05, 0, 1)
        else:
            # Poor intervention → state deteriorates
            self.attention_score    = np.clip(self.attention_score    - rng.uniform(0.05, 0.12), 0, 1)
            self.reading_speed      = np.clip(self.reading_speed      - rng.uniform(0.01, 0.05), 0, 1)
            self.mouse_dwell        = np.clip(self.mouse_dwell        + rng.uniform(0.02, 0.08), 0, 1)
            self.scroll_hesitation  = np.clip(self.scroll_hesitation  + rng.uniform(0.02, 0.07), 0, 1)
            self.backtrack_freq     = np.clip(self.backtrack_freq     + rng.uniform(0.01, 0.04), 0, 1)
            self.session_fatigue    = np.clip(self.session_fatigue    + 0.08, 0, 1)

        # Natural fatigue accumulation over time
        self.session_fatigue = np.clip(self.session_fatigue + 0.005, 0, 1)
        self.last_action = action

    def render(self):
        if self.render_mode == "human":
            print(
                f"Step {self.current_step:3d} | "
                f"Disability: {self.disability_type:.1f} | "
                f"Attention: {self.attention_score:.2f} | "
                f"Fatigue: {self.session_fatigue:.2f} | "
                f"Cumulative Reward: {self.cumulative_reward:.3f}"
            )
