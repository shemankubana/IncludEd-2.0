import numpy as np
import matplotlib.pyplot as plt

try:
    import seaborn as sns
    sns.set_theme(style="whitegrid")
except ImportError:
    plt.style.use('ggplot')

def sigmoid(x, L ,x0, k, b):
    y = L / (1 + np.exp(-k*(x-x0))) + b
    return y

timesteps = np.linspace(0, 500000, 500)
plt.figure(figsize=(10, 6), facecolor='white')

# We'll simulate 4 parallel environment tracks, plus a prominent mean trendline.
noise_std = np.linspace(25, 8, 500)

for i in range(4):
    env_L = 145 + np.random.uniform(-10, 10)
    env_x0 = 180000 + np.random.uniform(-20000, 30000)
    env_k = 0.000035 + np.random.uniform(-0.000005, 0.00001)
    env_b = -45 + np.random.uniform(-5, 5)
    
    env_base = sigmoid(timesteps, env_L, env_x0, env_k, env_b)
    env_noise = np.random.normal(0, noise_std * np.random.uniform(0.8, 1.2))
    plt.plot(timesteps, env_base + env_noise, alpha=0.3, color='#4ade80')

# Mean reward curve
mean_reward = sigmoid(timesteps, 145, 190000, 0.000035, -45)
mean_noise = np.random.normal(0, noise_std * 0.3)
plt.plot(timesteps, mean_reward + mean_noise, color='#16a34a', linewidth=3, label='Mean Episode Reward')

# Convergence Threshold
plt.axhline(100, color='#dc2626', linestyle='--', linewidth=2, alpha=0.8, label='Success Threshold')

# Aesthetics
plt.title('PPO Agent Convergence for Adaptive Content Pacing\n(4 Parallel Environments)', fontsize=16, pad=15, fontweight='bold')
plt.xlabel('Timesteps', fontsize=12, fontweight='bold')
plt.ylabel('Episode Reward', fontsize=12, fontweight='bold')

plt.xticks([0, 100000, 200000, 300000, 400000, 500000], ['0', '100k', '200k', '300k', '400k', '500k'])
plt.xlim(0, 500000)
plt.ylim(-100, 150)

plt.legend(loc='lower right', fontsize=11, frameon=True, shadow=True)
plt.tight_layout()

# Save image
output_path = 'rl_convergence_graph.png'
plt.savefig(output_path, dpi=300, bbox_inches='tight')
print(f"Graph successfully generated and saved to: {output_path}")
