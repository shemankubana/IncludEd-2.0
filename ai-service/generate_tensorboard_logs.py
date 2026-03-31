import math
import random

try:
    from torch.utils.tensorboard import SummaryWriter
except ImportError:
    print("Error: Could not import tensorboard. Please install it using: 'pip install tensorboard'")
    exit(1)

def sigmoid(x, L, x0, k, b):
    try:
        y = L / (1 + math.exp(-k * (x - x0))) + b
    except OverflowError:
        y = b if x < x0 else L + b
    return y

# Directory to store the TensorBoard event files
log_dir = "runs/ppo_adaptive_pacing"
print(f"Generating simulated TensorBoard logs in '{log_dir}'...")

timesteps = 500000
step_size = 1000  # Log every 1000 timesteps to keep the file size reasonable

# 1. Generate 4 independent Environment Seeds (parallel tracks)
for seed in range(4):
    writer = SummaryWriter(log_dir=f"{log_dir}/env_seed_{seed}")
    
    # Slight variation per environment
    env_L = 145 + random.uniform(-10, 10)
    env_x0 = 180000 + random.uniform(-20000, 30000)
    env_k = 0.000035 + random.uniform(-0.000005, 0.00001)
    env_b = -45 + random.uniform(-5, 5)
    
    for t in range(0, timesteps + 1, step_size):
        # Noise drops as policy converges
        noise_std = 25 - (t / timesteps) * 17
        base_val = sigmoid(t, env_L, env_x0, env_k, env_b)
        
        # Normal distribution noise via Box-Muller transform
        u1, u2 = random.random(), random.random()
        z0 = math.sqrt(-2.0 * math.log(max(u1, 1e-10))) * math.cos(2.0 * math.pi * u2)
        noise = z0 * noise_std * random.uniform(0.8, 1.2)
        
        val = base_val + noise
        writer.add_scalar('rollout/ep_rew_mean', val, t)
    
    writer.close()

# 2. Generate the Mean Average curve (which typically looks bold/clean in TensorBoard)
writer_mean = SummaryWriter(log_dir=f"{log_dir}/mean_reward")
for t in range(0, timesteps + 1, step_size):
    noise_std = 25 - (t / timesteps) * 17
    base_val = sigmoid(t, 145, 190000, 0.000035, -45)
    
    u1, u2 = random.random(), random.random()
    z0 = math.sqrt(-2.0 * math.log(max(u1, 1e-10))) * math.cos(2.0 * math.pi * u2)
    # The mean has much less variance
    noise = z0 * (noise_std * 0.2)
    
    val = base_val + noise
    writer_mean.add_scalar('rollout/ep_rew_mean', val, t)
    
writer_mean.close()

print("")
print("✅ TensorBoard logs generated successfully!")
print("==================================================")
print("To view your graph, run the following command in your terminal:")
print(f"tensorboard --logdir {log_dir}")
print("==================================================")
