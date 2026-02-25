import gymnasium as gym
from gymnasium import spaces
import numpy as np
import random
from typing import Optional, Dict, Union


class IncludEdEnv(gym.Env):
    """
    Adaptive Learning Environment for Dyslexia & ADHD students.
    Aligned with IncludEd research proposal (PPO/DQN target).
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

    DISABILITY_NONE     = 0.0
    DISABILITY_DYSLEXIA = 0.5
    DISABILITY_ADHD     = 1.0

    def __init__(self, render_mode: Optional[str] = None):
        super().__init__()
        self.render_mode = render_mode

        self.action_space = spaces.Discrete(6)

        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(8,), dtype=np.float32
        )

        self.max_steps = 120
        self._reset_state()

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _normalize_action(self, action: Union[int, np.ndarray]) -> int:
        """Ensure action is a Python int (SB3-safe)."""
        if isinstance(action, np.ndarray):
            return int(action[0])
        return int(action)

    # ── Internal state ───────────────────────────────────────────────────────

    def _reset_state(self):
        self.current_step = 0
        self.cumulative_reward = 0.0

        r = random.random()
        if r < 0.4:
            self.disability_type = self.DISABILITY_NONE
        elif r < 0.7:
            self.disability_type = self.DISABILITY_DYSLEXIA
        else:
            self.disability_type = self.DISABILITY_ADHD

        self.text_difficulty   = random.uniform(0.3, 0.9)
        self.reading_speed     = random.uniform(0.3, 0.8)
        self.mouse_dwell       = random.uniform(0.0, 0.4)
        self.scroll_hesitation = random.uniform(0.0, 0.3)
        self.backtrack_freq    = random.uniform(0.0, 0.3)
        self.attention_score   = random.uniform(0.5, 1.0)
        self.session_fatigue   = 0.0

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
        action = self._normalize_action(action)

        self.current_step += 1
        reward = self._compute_reward(action)
        self._update_state(action, reward)

        self.cumulative_reward += reward
        terminated = self.current_step >= self.max_steps
        truncated = False

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
        base_impact = 0.0
        fatigue_penalty = self.session_fatigue * 0.25

        if self.disability_type == self.DISABILITY_DYSLEXIA:
            impact_map = {
                0: -0.3, 1: 0.2, 2: 0.1, 3: 0.7, 4: 0.9, 5: -0.1
            }
        elif self.disability_type == self.DISABILITY_ADHD:
            impact_map = {
                0: -0.4, 1: 0.2, 2: 0.8, 3: 0.3, 4: -0.1, 5: 0.9
            }
        else:
            impact_map = {
                0: 0.6, 1: 0.1, 2: -0.3, 3: -0.1, 4: -0.2, 5: -0.1
            }

        # ✅ CRITICAL FIX
        base_impact = impact_map[action]

        if self.attention_score < 0.4:
            base_impact *= 1.4 if base_impact > 0 else 1.2

        if self.text_difficulty > 0.7 and action in {1, 2, 3, 4}:
            base_impact += 0.1

        if action == self.last_action:
            self.consecutive_same_action += 1
            if self.consecutive_same_action >= 3:
                base_impact -= 0.15
        else:
            self.consecutive_same_action = 0

        return float(np.clip(base_impact - fatigue_penalty, -1.0, 1.0))

    # ── State dynamics ───────────────────────────────────────────────────────

    def _update_state(self, action: int, reward: float):
        rng = np.random.default_rng()

        if reward > 0.3:
            self.attention_score   = np.clip(self.attention_score + rng.uniform(0.05, 0.15), 0, 1)
            self.reading_speed     = np.clip(self.reading_speed + rng.uniform(0.02, 0.08), 0, 1)
            self.mouse_dwell       = np.clip(self.mouse_dwell - rng.uniform(0.02, 0.07), 0, 1)
            self.scroll_hesitation = np.clip(self.scroll_hesitation - rng.uniform(0.02, 0.06), 0, 1)
            self.backtrack_freq    = np.clip(self.backtrack_freq - rng.uniform(0.02, 0.05), 0, 1)
            self.session_fatigue   = np.clip(self.session_fatigue - 0.05, 0, 1)
        else:
            self.attention_score   = np.clip(self.attention_score - rng.uniform(0.05, 0.12), 0, 1)
            self.reading_speed     = np.clip(self.reading_speed - rng.uniform(0.01, 0.05), 0, 1)
            self.mouse_dwell       = np.clip(self.mouse_dwell + rng.uniform(0.02, 0.08), 0, 1)
            self.scroll_hesitation = np.clip(self.scroll_hesitation + rng.uniform(0.02, 0.07), 0, 1)
            self.backtrack_freq    = np.clip(self.backtrack_freq + rng.uniform(0.01, 0.04), 0, 1)
            self.session_fatigue   = np.clip(self.session_fatigue + 0.08, 0, 1)

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