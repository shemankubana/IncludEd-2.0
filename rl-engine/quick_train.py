"""
Quick Train Script
==================
Trains a new PPO agent on IncludEdEnv WITHOUT requiring TensorBoard.
Saves the model to ai-service/services/ppo_included_agent.zip.

Usage (from the rl-engine directory):
    python quick_train.py

Takes ~2 minutes on CPU.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from included_env import IncludEdEnv
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import EvalCallback
from stable_baselines3.common.monitor import Monitor
import numpy as np


def train():
    TIMESTEPS  = 150_000
    N_ENVS     = 4
    SAVE_PATH  = os.path.join(os.path.dirname(__file__), "../ai-service/services/ppo_included_agent")

    print("=" * 60)
    print("  IncludEd – Quick PPO Training (no TensorBoard)")
    print("=" * 60)
    print(f"  Timesteps : {TIMESTEPS:,}")
    print(f"  Envs      : {N_ENVS}")
    print(f"  Save Path : {SAVE_PATH}.zip")
    print()

    # Vectorised training environment
    train_env = make_vec_env(IncludEdEnv, n_envs=N_ENVS)

    # Fresh PPO model — no tensorboard_log set, so no TensorBoard needed
    model = PPO(
        policy          = "MlpPolicy",
        env             = train_env,
        learning_rate   = 3e-4,
        n_steps         = 512,
        batch_size      = 64,
        n_epochs        = 10,
        gamma           = 0.99,
        gae_lambda      = 0.95,
        clip_range      = 0.2,
        ent_coef        = 0.01,
        verbose         = 1,
        # tensorboard_log deliberately omitted
    )

    print("🚀 Training started …")
    model.learn(total_timesteps=TIMESTEPS, progress_bar=False)

    # Save to ai-service/services for immediate use
    model.save(SAVE_PATH)
    print(f"\n✅ Model saved → {SAVE_PATH}.zip")

    # Quick evaluation
    print("\n🔍 Running quick evaluation (30 episodes) …")
    eval_env = Monitor(IncludEdEnv())

    disability_names = {0.0: "None", 0.5: "Dyslexia", 1.0: "ADHD"}
    for dis_val, dis_name in disability_names.items():
        rewards = []
        for _ in range(10):
            obs, _ = eval_env.reset()
            eval_env.env.disability_type = dis_val
            obs = eval_env.env._get_obs()
            done = False
            ep_reward = 0.0
            while not done:
                action, _ = model.predict(obs, deterministic=True)
                obs, r, terminated, truncated, _ = eval_env.step(action)
                ep_reward += r
                done = terminated or truncated
            rewards.append(ep_reward)
        print(f"  {dis_name:<9}: mean reward = {np.mean(rewards):+.3f}")

    print("\n🎉 Done! Restart your AI service to load the new model:")
    print("   cd ../ai-service && python main.py")


if __name__ == "__main__":
    train()
