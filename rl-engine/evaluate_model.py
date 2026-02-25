"""
IncludEd Model Evaluation Script
=================================
Loads a trained PPO model and runs structured evaluation across
all three disability profiles (none, dyslexia, ADHD).

Usage:
    cd rl-engine
    python evaluate_model.py [--model-path ./ppo_included_agent.zip] [--episodes 100]
"""

import argparse
import os
import sys
import numpy as np
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))

from included_env import IncludEdEnv


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate IncludEd PPO agent")
    parser.add_argument("--model-path", type=str, default="./ppo_included_agent.zip",
                        help="Path to the trained model zip file")
    parser.add_argument("--episodes", type=int, default=100,
                        help="Total evaluation episodes per disability type")
    parser.add_argument("--verbose", action="store_true",
                        help="Print per-episode details")
    return parser.parse_args()


def evaluate(args):
    # Lazy import only if model file exists
    try:
        from stable_baselines3 import PPO
        use_model = os.path.exists(args.model_path)
    except ImportError:
        use_model = False
        print("⚠️  stable-baselines3 not installed. Running random baseline.")

    if use_model:
        model = PPO.load(args.model_path)
        print(f"✅ Loaded model: {args.model_path}")
    else:
        model = None
        if not os.path.exists(args.model_path):
            print(f"⚠️  Model not found at {args.model_path}. Using random actions.")

    disability_types = {
        "None":     IncludEdEnv.DISABILITY_NONE,
        "Dyslexia": IncludEdEnv.DISABILITY_DYSLEXIA,
        "ADHD":     IncludEdEnv.DISABILITY_ADHD,
    }

    results = {}

    for disability_name, disability_val in disability_types.items():
        print(f"\n📊 Evaluating disability: {disability_name} ({args.episodes} episodes)…")
        env = IncludEdEnv()

        episode_rewards = []
        action_counts = defaultdict(int)
        attention_scores = []
        final_fatigues = []

        for ep in range(args.episodes):
            obs, _ = env.reset()
            # Force disability type for controlled evaluation
            env.disability_type = disability_val
            obs = env._get_obs()

            ep_reward = 0.0
            done = False

            while not done:
                if model:
                    action, _ = model.predict(obs, deterministic=True)
                else:
                    action = env.action_space.sample()

                obs, reward, terminated, truncated, info = env.step(int(action))
                ep_reward += reward
                action_counts[int(action)] += 1
                done = terminated or truncated

            episode_rewards.append(ep_reward)
            attention_scores.append(env.attention_score)
            final_fatigues.append(env.session_fatigue)

            if args.verbose:
                print(f"  Ep {ep+1:3d}: reward={ep_reward:.3f}, "
                      f"attention={env.attention_score:.2f}, "
                      f"fatigue={env.session_fatigue:.2f}")

        results[disability_name] = {
            "mean_reward":      np.mean(episode_rewards),
            "std_reward":       np.std(episode_rewards),
            "min_reward":       np.min(episode_rewards),
            "max_reward":       np.max(episode_rewards),
            "mean_attention":   np.mean(attention_scores),
            "mean_fatigue":     np.mean(final_fatigues),
            "action_counts":    dict(action_counts),
        }

        env.close()

    # ── Print report ─────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  IncludEd PPO Evaluation Report")
    print("=" * 70)

    for disability_name, r in results.items():
        print(f"\n  🏷️  {disability_name}")
        print(f"    Mean Reward  : {r['mean_reward']:+.3f}  ±{r['std_reward']:.3f}")
        print(f"    Range        : [{r['min_reward']:+.3f},  {r['max_reward']:+.3f}]")
        print(f"    Avg Attention: {r['mean_attention']:.3f}")
        print(f"    Avg Fatigue  : {r['mean_fatigue']:.3f}")

        total_actions = sum(r["action_counts"].values())
        print(f"    Action Distribution:")
        for action_id, label in IncludEdEnv.ACTION_LABELS.items():
            count = r["action_counts"].get(action_id, 0)
            pct = 100.0 * count / total_actions if total_actions else 0
            bar = "█" * int(pct / 5)
            print(f"      {action_id}: {label:<25} {pct:5.1f}%  {bar}")

    print("\n" + "=" * 70)
    print("  Evaluation complete.")

    # ── Check for expected behaviour ─────────────────────────────────────────
    if model:
        print("\n✅ Policy Sanity Checks:")
        checks = [
            ("Dyslexia favours TTS/Syllable (action 3 or 4)",
             max(results["Dyslexia"]["action_counts"].get(3, 0),
                 results["Dyslexia"]["action_counts"].get(4, 0)) >
             results["Dyslexia"]["action_counts"].get(0, 0)),

            ("ADHD favours Attention Break / Heavy Simplif. (5 or 2)",
             max(results["ADHD"]["action_counts"].get(5, 0),
                 results["ADHD"]["action_counts"].get(2, 0)) >
             results["ADHD"]["action_counts"].get(0, 0)),

            ("None disability mostly uses Keep Original (0)",
             results["None"]["action_counts"].get(0, 0) >
             results["None"]["action_counts"].get(5, 0)),
        ]
        for desc, passed in checks:
            status = "✅" if passed else "❌"
            print(f"  {status} {desc}")

    return results


if __name__ == "__main__":
    args = parse_args()
    evaluate(args)
