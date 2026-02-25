"""
IncludEd PPO Training Script
============================
Trains a Proximal Policy Optimization agent on the IncludEdEnv
and saves the model as `ppo_included_agent.zip`.

Usage:
    cd rl-engine
    python train_model.py [--timesteps 200000] [--log-dir ./logs]
"""

import argparse
import os
import sys

# Ensure the rl-engine directory is on the path
sys.path.insert(0, os.path.dirname(__file__))

from included_env import IncludEdEnv
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback
from stable_baselines3.common.monitor import Monitor
import numpy as np


def parse_args():
    parser = argparse.ArgumentParser(description="Train IncludEd PPO agent")
    parser.add_argument("--timesteps", type=int, default=200_000,
                        help="Total training timesteps (default: 200000)")
    parser.add_argument("--log-dir", type=str, default="./logs",
                        help="TensorBoard log directory")
    parser.add_argument("--save-path", type=str, default="./ppo_included_agent",
                        help="Path to save model (without .zip extension)")
    parser.add_argument("--n-envs", type=int, default=4,
                        help="Number of parallel environments")
    parser.add_argument("--eval-freq", type=int, default=10_000,
                        help="Evaluation frequency in timesteps")
    return parser.parse_args()


def make_env():
    env = IncludEdEnv()
    return Monitor(env)


def train(args):
    print("=" * 60)
    print("  IncludEd – PPO Training")
    print("=" * 60)
    print(f"  Timesteps : {args.timesteps:,}")
    print(f"  Log Dir   : {args.log_dir}")
    print(f"  Save Path : {args.save_path}.zip")
    print(f"  Envs      : {args.n_envs}")
    print()

    os.makedirs(args.log_dir, exist_ok=True)
    os.makedirs(os.path.dirname(args.save_path) or ".", exist_ok=True)

    # Vectorised training environments
    train_env = make_vec_env(make_env, n_envs=args.n_envs)

    # Single eval environment
    eval_env = Monitor(IncludEdEnv())

    # Callbacks
    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=os.path.dirname(args.save_path) or ".",
        log_path=args.log_dir,
        eval_freq=max(args.eval_freq // args.n_envs, 1),
        n_eval_episodes=20,
        deterministic=True,
        verbose=1,
    )

    checkpoint_callback = CheckpointCallback(
        save_freq=max(50_000 // args.n_envs, 1),
        save_path=args.log_dir,
        name_prefix="ppo_included",
    )

    # PPO model — tuned for a small discrete env
    model = PPO(
        policy="MlpPolicy",
        env=train_env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.98,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,        # Encourage exploration across 6 actions
        vf_coef=0.5,
        max_grad_norm=0.5,
        tensorboard_log=args.log_dir,
        verbose=1,
    )

    print("🚀 Training started …")
    model.learn(
        total_timesteps=args.timesteps,
        callback=[eval_callback, checkpoint_callback],
        progress_bar=True,
    )

    model.save(args.save_path)
    print(f"\n✅ Model saved → {args.save_path}.zip")

    # Quick sanity check
    print("\n🔍 Running quick evaluation (50 episodes)…")
    rewards_by_disability = {0.0: [], 0.5: [], 1.0: []}

    for _ in range(50):
        obs, _ = eval_env.reset()
        done = False
        ep_reward = 0.0
        disability = eval_env.env.disability_type   # access unwrapped env
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, _ = eval_env.step(action)
            ep_reward += reward
            done = terminated or truncated
        rewards_by_disability[disability].append(ep_reward)

    print("\n📊 Mean episodic reward per disability type:")
    labels = {0.0: "None   ", 0.5: "Dyslexia", 1.0: "ADHD   "}
    for dtype, rewards in rewards_by_disability.items():
        if rewards:
            print(f"  {labels[dtype]}: {np.mean(rewards):.3f} (n={len(rewards)})")

    train_env.close()
    eval_env.close()
    print("\n✅ Training complete!")


if __name__ == "__main__":
    args = parse_args()
    train(args)
