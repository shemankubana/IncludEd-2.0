"""
train_rl_agent.py
=================
Train the PPO reinforcement learning agent for adaptive reading difficulty.

The RL agent learns to select the best reading adaptation (action) for a
student based on their real-time behaviour signals (state vector).

Environment
-----------
IncludEdEnv (gymnasium.Env) — simulates a student reading session.

State vector (9-dim)
--------------------
  [reading_speed, mouse_dwell, scroll_hesitation, backtrack_freq,
   attention_score, disability_type, text_difficulty,
   session_fatigue, content_type]

  Each value normalised to [0, 1].

Actions (6 discrete)
---------------------
  0 — Keep Original       (no adaptation)
  1 — Light Simplify      (reduce vocab complexity slightly)
  2 — Heavy Simplify      (full T5 simplification)
  3 — TTS + Highlights    (read aloud with word sync)
  4 — Syllable Break      (split words into syllables)
  5 — Attention Break     (ADHD micro-check / breathing pause)

Reward function
---------------
  +1.0   Student completes chapter quiz with ≥ 70% score
  +0.5   Student completes the reading section
  +0.2   Student looked up fewer than 3 words (understood the passage)
  -0.5   Student quit early / session abandoned
  -0.3   Student re-read same paragraph 3+ times
  -0.1   Student spent > 5 minutes on single paragraph (stuck)
  -------
  Shaped reward pushes towards: comprehension ≥ 70%, minimal re-reads,
  session completion, vocabulary growth.

Training approach
-----------------
  Phase 1 — Offline pre-training (this script):
    Simulated students with randomly sampled disability profiles and
    behaviour patterns. Runs 500k timesteps (~15 min on CPU, ~3 min on GPU).
    Produces a warm-start model.

  Phase 2 — Online fine-tuning (production):
    Real student sessions generate (state, action, reward) triplets.
    These are stored in RLTrainingData table. A scheduled job (cron or
    background task) fine-tunes the PPO model on real data.

Output
------
  rl-engine/models/ppo_included_v2.zip      (Stable-Baselines3 PPO)
  rl-engine/model_versions.json             (version metadata)

Requirements
------------
  pip install stable-baselines3[extra] gymnasium torch

Usage
-----
  python train_rl_agent.py [--timesteps 500000] [--output-dir rl-engine/models]
"""

import argparse
import json
import os
import sys
import random
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

try:
    import gymnasium as gym
    from gymnasium import spaces
    _GYM_OK = True
except ImportError:
    print("ERROR: gymnasium not installed. Run: pip install gymnasium")
    _GYM_OK = False

try:
    from stable_baselines3 import PPO
    from stable_baselines3.common.vec_env import DummyVecEnv
    from stable_baselines3.common.callbacks import EvalCallback
    _SB3_OK = True
except ImportError:
    print("ERROR: stable-baselines3 not installed. Run: pip install stable-baselines3[extra]")
    _SB3_OK = False


# ── IncludEd Gymnasium Environment ────────────────────────────────────────────

if _GYM_OK:
    class IncludEdEnv(gym.Env):
        """
        Simulated student reading session environment.

        Each episode = one student reading one chapter.
        Episode ends when student completes or quits (max 50 steps).
        """

        metadata = {"render_modes": []}

        # Disability → behaviour tendency mappings (for simulation)
        _DISABILITY_BEHAVIOUR = {
            "none":     {"attention": 0.8, "reread_prob": 0.1, "quit_prob": 0.05},
            "dyslexia": {"attention": 0.5, "reread_prob": 0.4, "quit_prob": 0.20},
            "adhd":     {"attention": 0.4, "reread_prob": 0.2, "quit_prob": 0.25},
            "both":     {"attention": 0.3, "reread_prob": 0.5, "quit_prob": 0.35},
        }

        # Action → text difficulty reduction effect
        _ACTION_DIFFICULTY_EFFECT = {
            0: 0.0,   # Keep original — no change
            1: 0.1,   # Light simplify — slight reduction
            2: 0.25,  # Heavy simplify — significant reduction
            3: 0.15,  # TTS — reduces effective difficulty via audio
            4: 0.12,  # Syllable break — helps with decoding
            5: 0.0,   # Attention break — resets fatigue, no difficulty change
        }

        # Action → fatigue effect
        _ACTION_FATIGUE_EFFECT = {
            0: 0.05,  # No adaptation → fatigue accumulates
            1: 0.03,
            2: 0.02,
            3: 0.01,  # TTS is least fatiguing
            4: 0.03,
            5: -0.15, # Attention break reduces fatigue
        }

        def __init__(self):
            super().__init__()
            self.observation_space = spaces.Box(
                low=0.0, high=1.0, shape=(9,), dtype=np.float32
            )
            self.action_space = spaces.Discrete(6)
            self._reset_state()

        def _reset_state(self):
            # Sample a random student profile
            self._disability = random.choice(["none", "dyslexia", "adhd", "both"])
            behaviour = self._DISABILITY_BEHAVIOUR[self._disability]
            self._base_attention  = behaviour["attention"] + random.uniform(-0.1, 0.1)
            self._reread_prob     = behaviour["reread_prob"]
            self._quit_prob       = behaviour["quit_prob"]

            # Initial state
            disability_enc = {"none": 0.0, "dyslexia": 0.5, "adhd": 1.0, "both": 0.75}
            content_type   = random.choice([0.0, 0.5, 1.0])  # generic / novel / play
            self._state = np.array([
                random.uniform(0.2, 0.9),   # reading_speed
                random.uniform(0.0, 0.5),   # mouse_dwell
                random.uniform(0.0, 0.6),   # scroll_hesitation
                random.uniform(0.0, 0.4),   # backtrack_freq
                self._base_attention,        # attention_score
                disability_enc[self._disability],
                random.uniform(0.3, 0.9),   # text_difficulty
                0.0,                         # session_fatigue (starts at 0)
                content_type,
            ], dtype=np.float32)

            self._step_count = 0
            self._comprehension = 0.0
            self._completed = False
            self._quiz_score = 0.0

        def reset(self, seed=None, options=None):
            super().reset(seed=seed)
            self._reset_state()
            return self._state.copy(), {}

        def step(self, action: int):
            self._step_count += 1

            # Apply action effects
            diff_reduction   = self._ACTION_DIFFICULTY_EFFECT.get(action, 0.0)
            fatigue_delta    = self._ACTION_FATIGUE_EFFECT.get(action, 0.05)
            effective_diff   = max(0.0, self._state[6] - diff_reduction)

            # Simulate attention decay + recovery
            attention_decay  = 0.02 * self._step_count / 50
            if action == 5:  # Attention break
                new_attention = min(1.0, self._state[4] + 0.20)
            else:
                new_attention = max(0.1, self._state[4] - attention_decay + random.uniform(-0.02, 0.02))

            # Simulate fatigue
            new_fatigue = max(0.0, min(1.0, self._state[7] + fatigue_delta))

            # Update reading speed (easier text → faster reading)
            speed_boost    = diff_reduction * 0.3
            new_speed      = min(1.0, self._state[0] + speed_boost + random.uniform(-0.05, 0.05))

            # Update backtrack frequency (better adaptation → fewer backtracks)
            new_backtrack  = max(0.0, self._state[3] - diff_reduction * 0.5 + random.uniform(-0.05, 0.1))

            # Update state
            self._state = np.array([
                np.clip(new_speed, 0, 1),
                np.clip(self._state[1] + random.uniform(-0.05, 0.05), 0, 1),
                np.clip(self._state[2] - diff_reduction * 0.3 + random.uniform(-0.05, 0.05), 0, 1),
                np.clip(new_backtrack, 0, 1),
                np.clip(new_attention, 0, 1),
                self._state[5],   # disability encoding doesn't change
                np.clip(effective_diff, 0, 1),
                np.clip(new_fatigue, 0, 1),
                self._state[8],   # content type doesn't change
            ], dtype=np.float32)

            # Simulate comprehension gain
            comprehension_gain = (
                (1.0 - effective_diff) * 0.15   # easier text → better comprehension
                + new_attention * 0.1
                - new_fatigue * 0.05
                + random.uniform(-0.03, 0.03)
            )
            self._comprehension = min(1.0, self._comprehension + comprehension_gain)

            # Calculate reward
            reward = self._compute_reward(action, effective_diff, new_attention, new_fatigue)

            # Check termination conditions
            quit_chance = self._quit_prob * new_fatigue * (1.0 + (1.0 - new_attention))
            if random.random() < quit_chance and self._step_count > 5:
                # Student quit early
                reward -= 0.5
                terminated = True
                self._completed = False
            elif self._step_count >= 50 or self._comprehension >= 0.85:
                # Chapter completed
                self._quiz_score = np.clip(self._comprehension + random.uniform(-0.1, 0.1), 0, 1)
                if self._quiz_score >= 0.70:
                    reward += 1.0
                self._completed = True
                terminated = True
            else:
                terminated = False

            return self._state.copy(), float(reward), terminated, False, {}

        def _compute_reward(
            self,
            action: int,
            effective_diff: float,
            attention: float,
            fatigue: float,
        ) -> float:
            """Shaped step reward."""
            r = 0.0

            # Reward for maintaining attention
            r += attention * 0.05

            # Penalty for too much simplification on easy text
            if effective_diff < 0.2 and action in (2, 4):  # over-simplifying easy text
                r -= 0.1

            # Reward for appropriate TTS use when difficulty is high
            if effective_diff > 0.6 and action == 3:
                r += 0.1

            # Penalty for ignoring high fatigue
            if fatigue > 0.7 and action != 5:
                r -= 0.1

            # Penalty for high backtrack frequency without adaptation
            if self._state[3] > 0.6 and action == 0:
                r -= 0.05

            return r


# ── Training entrypoint ────────────────────────────────────────────────────────

def train(timesteps: int = 500_000, output_dir: str = None):
    if not (_GYM_OK and _SB3_OK):
        print("Missing dependencies — cannot train. See instructions above.")
        return

    if output_dir is None:
        # Default: rl-engine/models/ relative to project root
        project_root = Path(__file__).parent.parent.parent.parent
        output_dir   = str(project_root / "rl-engine" / "models")

    os.makedirs(output_dir, exist_ok=True)
    print(f"Output directory: {output_dir}")

    # Create vectorised env for PPO
    def make_env():
        return IncludEdEnv()

    env      = DummyVecEnv([make_env for _ in range(4)])
    eval_env = DummyVecEnv([make_env])

    # PPO with MLP policy
    model = PPO(
        "MlpPolicy",
        env,
        verbose=1,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,          # encourage exploration
        tensorboard_log=os.path.join(output_dir, "tensorboard"),
    )

    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=output_dir,
        log_path=output_dir,
        eval_freq=10_000,
        n_eval_episodes=20,
        deterministic=True,
        verbose=1,
    )

    print(f"\n🚀 Training PPO for {timesteps:,} timesteps…")
    print("State dim: 9  |  Actions: 6  |  Policy: MlpPolicy (64×64)")
    print()

    model.learn(
        total_timesteps=timesteps,
        callback=eval_callback,
        progress_bar=True,
    )

    # Save final model
    model_path = os.path.join(output_dir, "ppo_included_v2")
    model.save(model_path)
    print(f"\n✅ Model saved → {model_path}.zip")

    # Write version metadata
    versions_file = os.path.join(output_dir, "..", "model_versions.json")
    try:
        with open(versions_file) as f:
            versions = json.load(f)
    except Exception:
        versions = {"versions": []}

    versions["versions"].append({
        "version":    f"v2.{len(versions['versions'])+1}",
        "trained_at": datetime.utcnow().isoformat(),
        "timesteps":  timesteps,
        "state_dim":  9,
        "actions":    6,
        "algorithm":  "PPO",
        "path":       model_path + ".zip",
        "notes":      "Simulated pre-training",
    })
    versions["latest"] = versions["versions"][-1]["version"]

    with open(versions_file, "w") as f:
        json.dump(versions, f, indent=2)
    print(f"✅ Version metadata → {versions_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train IncludEd RL agent")
    parser.add_argument("--timesteps",  type=int, default=500_000)
    parser.add_argument("--output-dir", type=str, default=None)
    args = parser.parse_args()
    train(timesteps=args.timesteps, output_dir=args.output_dir)
