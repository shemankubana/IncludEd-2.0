"""
IncludEd PPO Training Pipeline v2
===================================
Trains a PPO agent on IncludEdEnv v2 (9-dim state, 6 actions).
v2 adds content-type stratified metrics and literature-specific evaluation.

Usage:
    cd rl-engine
    python train_model.py [--timesteps 200000] [--n-envs 4] [--eval-only]
    python train_model.py --timesteps 300000 --n-envs 8  # Full thesis run

Thesis Research Alignment:
    RQ1 — RL policy convergence (policy loss < 0.05)
    RQ2 — Attention duration increase ≥ 30%
    RQ3 — Comprehension improvement ≥ 25%
    RQ4 — Effect size (Cohen's d ≥ 0.5)

New in v2:
    - 9-dim state (content_type added)
    - Content-stratified evaluation (play / novel / generic)
    - Literature engagement score metric
    - Action distribution by disability type
"""

import argparse
import json
import os
import shutil
import sys
import time
from collections import defaultdict
from datetime import datetime

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from included_env import IncludEdEnv

from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import (
    EvalCallback,
    CheckpointCallback,
    BaseCallback,
)
from stable_baselines3.common.monitor import Monitor

# ── Paths ──────────────────────────────────────────────────────────────────────

SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_OUTPUT  = os.path.join(SCRIPT_DIR, "ppo_included_agent")
LOGS_DIR      = os.path.join(SCRIPT_DIR, "logs")
VERSIONS_FILE = os.path.join(SCRIPT_DIR, "model_versions.json")
AI_SVC_DIR    = os.path.join(SCRIPT_DIR, "..", "ai-service", "services")


# ── Thesis Metrics Callback ────────────────────────────────────────────────────

class ThesisMetricsCallback(BaseCallback):
    """
    Logs attention scores, fatigue, and action distributions per timestep.
    Written to logs/training_metrics.jsonl (one JSON object per line).
    """

    def __init__(self, log_path: str, verbose: int = 0):
        super().__init__(verbose)
        self.log_path = log_path
        self._attention_buf: list = []
        self._fatigue_buf:   list = []
        self._action_counts: dict = defaultdict(int)
        os.makedirs(os.path.dirname(log_path), exist_ok=True)

    def _on_step(self) -> bool:
        for info in self.locals.get("infos", []):
            if "attention_score" in info:
                self._attention_buf.append(info["attention_score"])
            if "session_fatigue" in info:
                self._fatigue_buf.append(info["session_fatigue"])

        # Count actions
        actions = self.locals.get("actions")
        if actions is not None:
            for a in np.atleast_1d(actions):
                self._action_counts[int(a)] += 1

        if self.num_timesteps % 5_000 == 0 and len(self._attention_buf) >= 10:
            record = {
                "step":           self.num_timesteps,
                "mean_attention": float(np.mean(self._attention_buf[-200:])),
                "mean_fatigue":   float(np.mean(self._fatigue_buf[-200:])),
                "action_dist":    dict(self._action_counts),
                "ts":             datetime.utcnow().isoformat(),
            }
            with open(self.log_path, "a") as f:
                f.write(json.dumps(record) + "\n")

            if self.verbose >= 1:
                print(
                    f"[Metrics] Step {self.num_timesteps:,} | "
                    f"Attention: {record['mean_attention']:.3f} | "
                    f"Fatigue: {record['mean_fatigue']:.3f}"
                )

        return True


# ── Cohen's d ─────────────────────────────────────────────────────────────────

def cohens_d(group1: np.ndarray, group2: np.ndarray) -> float:
    n1, n2 = len(group1), len(group2)
    if n1 < 2 or n2 < 2:
        return 0.0
    mean_diff  = np.mean(group2) - np.mean(group1)
    pooled_std = np.sqrt(
        ((n1 - 1) * np.var(group1, ddof=1) + (n2 - 1) * np.var(group2, ddof=1))
        / (n1 + n2 - 2)
    )
    return float(mean_diff / pooled_std) if pooled_std > 0 else 0.0


# ── Evaluation ────────────────────────────────────────────────────────────────

def evaluate_model(model, n_episodes: int = 100) -> dict:
    """
    Deterministic evaluation with thesis validation metrics.
    v2: stratified by content type + action distribution analysis.
    """
    env = IncludEdEnv()
    rewards             = []
    attention_scores    = []
    initial_attentions  = []
    final_attentions    = []
    fatigue_scores      = []
    action_counts       = defaultdict(int)

    # Content-type stratified metrics
    content_rewards: dict = {0.0: [], 0.5: [], 1.0: []}
    disability_action_map: dict = defaultdict(lambda: defaultdict(int))

    for _ in range(n_episodes):
        obs, _ = env.reset()
        done       = False
        ep_reward  = 0.0
        ep_attentions = []
        last_info  = {}
        ep_content_type = env.content_type
        ep_disability   = env.disability_type

        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(action)
            ep_reward += reward
            ep_attentions.append(info.get("attention_score", 0.5))
            action_counts[int(action)] += 1
            disability_action_map[ep_disability][int(action)] += 1
            last_info = info
            done = terminated or truncated

        rewards.append(ep_reward)
        fatigue_scores.append(last_info.get("session_fatigue", 0.5))
        content_rewards[ep_content_type].append(ep_reward)

        if ep_attentions:
            attention_scores.append(float(np.mean(ep_attentions)))
            initial_attentions.extend(ep_attentions[:10])
            final_attentions.extend(ep_attentions[-10:])

    env.close()

    pre  = np.array(initial_attentions)
    post = np.array(final_attentions)
    d    = cohens_d(pre, post)
    attn_gain = (
        (float(np.mean(post)) - float(np.mean(pre))) / max(float(np.mean(pre)), 1e-6)
    ) * 100 if len(pre) > 0 else 0.0

    # Content-type mean rewards
    content_means = {}
    for ct, rs in content_rewards.items():
        label = {0.0: "generic", 0.5: "novel", 1.0: "play"}[ct]
        content_means[f"mean_reward_{label}"] = float(np.mean(rs)) if rs else 0.0

    # Action distribution %
    total_actions = sum(action_counts.values()) or 1
    action_dist   = {
        IncludEdEnv.ACTION_LABELS[a]: round(c / total_actions * 100, 1)
        for a, c in sorted(action_counts.items())
    }

    results = {
        "mean_reward":         float(np.mean(rewards)),
        "std_reward":          float(np.std(rewards)),
        "mean_attention":      float(np.mean(attention_scores)) if attention_scores else 0.0,
        "mean_fatigue":        float(np.mean(fatigue_scores))   if fatigue_scores   else 0.0,
        "attention_gain_pct":  round(attn_gain, 2),
        "cohens_d":            round(d, 4),
        "n_episodes":          n_episodes,
        "action_distribution": action_dist,
        **content_means,
    }

    print("\n📊 Thesis Validation Metrics (v2):")
    print(f"  Attention gain  (target ≥30%): {attn_gain:.1f}%  {'✅' if attn_gain >= 30 else '⚠️'}")
    print(f"  Cohen's d       (target ≥0.5): {d:.3f}           {'✅' if d >= 0.5   else '⚠️'}")
    print(f"  Mean reward     (target >0  ): {results['mean_reward']:.4f}  {'✅' if results['mean_reward'] > 0 else '⚠️'}")
    print("\n  Content-type rewards:")
    for k, v in content_means.items():
        print(f"    {k}: {v:.4f}")
    print("\n  Action distribution:")
    for a, pct in action_dist.items():
        print(f"    {a}: {pct}%")

    return results


# ── Version registry ──────────────────────────────────────────────────────────

def load_versions() -> list:
    if os.path.exists(VERSIONS_FILE):
        with open(VERSIONS_FILE) as f:
            return json.load(f)
    return []


def save_versions(versions: list) -> None:
    with open(VERSIONS_FILE, "w") as f:
        json.dump(versions, f, indent=2)


# ── Training ──────────────────────────────────────────────────────────────────

def make_env():
    return Monitor(IncludEdEnv())


def train(
    total_timesteps: int = 200_000,
    eval_freq:       int = 10_000,
    n_envs:          int = 4,
    seed:            int = 42,
    verbose:         int = 1,
    log_dir:         str = LOGS_DIR,
    save_path:       str = MODEL_OUTPUT,
):
    os.makedirs(log_dir, exist_ok=True)
    start_time = time.time()

    print("=" * 60)
    print("  IncludEd – PPO Training Pipeline v2")
    print(f"  Timesteps : {total_timesteps:,}")
    print(f"  Envs      : {n_envs}  |  Seed : {seed}")
    print(f"  State dim : 9  |  Actions : 6")
    print("=" * 60)

    train_env = make_vec_env(make_env, n_envs=n_envs, seed=seed)
    eval_env  = Monitor(IncludEdEnv())

    model = PPO(
        policy          = "MlpPolicy",
        env             = train_env,
        learning_rate   = 3e-4,
        n_steps         = 2048,
        batch_size      = 64,
        n_epochs        = 10,
        gamma           = 0.98,
        gae_lambda      = 0.95,
        clip_range      = 0.2,
        ent_coef        = 0.01,
        vf_coef         = 0.5,
        max_grad_norm   = 0.5,
        tensorboard_log = log_dir,
        verbose         = verbose,
        seed            = seed,
        policy_kwargs   = {"net_arch": [dict(pi=[128, 64], vf=[128, 64])]},
    )

    eval_cb = EvalCallback(
        eval_env,
        best_model_save_path = os.path.dirname(save_path),
        log_path             = log_dir,
        eval_freq            = max(eval_freq // n_envs, 1),
        n_eval_episodes      = 20,
        deterministic        = True,
        verbose              = 1,
    )

    checkpoint_cb = CheckpointCallback(
        save_freq   = max(50_000 // n_envs, 1),
        save_path   = log_dir,
        name_prefix = "ppo_included_v2",
    )

    metrics_cb = ThesisMetricsCallback(
        log_path = os.path.join(log_dir, "training_metrics.jsonl"),
        verbose  = verbose,
    )

    print("\n🚀 Training started…\n")
    model.learn(
        total_timesteps     = total_timesteps,
        callback            = [eval_cb, checkpoint_cb, metrics_cb],
        progress_bar        = True,
        reset_num_timesteps = True,
        tb_log_name         = "PPO_v2",
    )

    model.save(save_path)
    print(f"\n✅ Model saved → {save_path}.zip")

    # Deploy to AI service for immediate inference
    dest = os.path.join(AI_SVC_DIR, "ppo_included_agent.zip")
    if os.path.exists(AI_SVC_DIR):
        shutil.copy2(save_path + ".zip", dest)
        print(f"✅ Deployed → {dest}")
    else:
        print(f"⚠️  AI service dir not found: {AI_SVC_DIR}")

    print("\n🔍 Final evaluation (100 episodes)…")
    eval_results = evaluate_model(model, n_episodes=100)

    duration_s = time.time() - start_time

    versions = load_versions()
    entry = {
        "version":              f"v{len(versions) + 1}.0",
        "model_version":        "v2",
        "trained_at":           datetime.utcnow().isoformat(),
        "total_timesteps":      total_timesteps,
        "n_envs":               n_envs,
        "seed":                 seed,
        "duration_s":           round(duration_s, 1),
        "eval_mean_reward":     eval_results["mean_reward"],
        "eval_std_reward":      eval_results["std_reward"],
        "eval_mean_attention":  eval_results["mean_attention"],
        "attention_gain_pct":   eval_results["attention_gain_pct"],
        "cohens_d":             eval_results["cohens_d"],
        "observation_dims":     9,
        "action_dims":          6,
        "model_file":           save_path + ".zip",
        "action_distribution":  eval_results.get("action_distribution", {}),
        "content_rewards":      {
            k: v for k, v in eval_results.items() if k.startswith("mean_reward_")
        },
    }
    versions.append(entry)
    save_versions(versions)
    print(f"📦 Version registry → {VERSIONS_FILE}")

    print("\n" + "=" * 60)
    print(f"  TRAINING COMPLETE — {entry['version']}")
    print(f"  Duration:       {duration_s:.0f}s")
    print(f"  Mean Reward:    {eval_results['mean_reward']:.4f}")
    print(f"  Attention Gain: {eval_results['attention_gain_pct']:.1f}%")
    print(f"  Cohen's d:      {eval_results['cohens_d']:.3f}")
    print("=" * 60)

    train_env.close()
    eval_env.close()
    return entry


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Train IncludEd PPO agent v2")
    p.add_argument("--timesteps", type=int, default=200_000)
    p.add_argument("--eval-freq", type=int, default=10_000)
    p.add_argument("--n-envs",    type=int, default=4)
    p.add_argument("--seed",      type=int, default=42)
    p.add_argument("--eval-only", action="store_true")
    p.add_argument("--log-dir",   type=str, default=LOGS_DIR)
    p.add_argument("--save-path", type=str, default=MODEL_OUTPUT)
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()

    if args.eval_only:
        path = args.save_path + ".zip"
        if not os.path.exists(path):
            print(f"❌ Model not found: {path}")
            sys.exit(1)
        m = PPO.load(path)
        r = evaluate_model(m, n_episodes=100)
        print(json.dumps(r, indent=2))
    else:
        train(
            total_timesteps = args.timesteps,
            eval_freq       = args.eval_freq,
            n_envs          = args.n_envs,
            seed            = args.seed,
            log_dir         = args.log_dir,
            save_path       = args.save_path,
        )
