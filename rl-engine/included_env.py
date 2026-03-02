import gymnasium as gym
from gymnasium import spaces
import numpy as np
import random

class IncludEdEnv(gym.Env):
    """
    RL Environment tailored for students with learning disabilities.
    The agent learns to select the best pedagogical action to keep the student engaged.
    """
    def __init__(self):
        super().__init__()
        
        # Actions the platform can take:
        # 0: Show Standard Text, 1: Simplify Text, 2: Trigger Text-to-Speech, 3: Generate Quiz
        self.action_space = spaces.Discrete(4)
        
        # State (Observation): [attention_level (0-1), recent_quiz_score (0-1), frustration_index (0-1)]
        self.observation_space = spaces.Box(
            low=np.array([0.0, 0.0, 0.0]), 
            high=np.array([1.0, 1.0, 1.0]), 
            dtype=np.float32
        )
        
        # We define these here so train_model.py's evaluation loop doesn't crash
        self.disability_type = 0.0

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        # Randomly assign a disability type for the session evaluation stats
        # 0.0: None, 0.5: Dyslexia, 1.0: ADHD
        self.disability_type = random.choice([0.0, 0.5, 1.0])
        
        # Start state: full attention, neutral score, zero frustration
        self.state = np.array([1.0, 0.5, 0.0], dtype=np.float32)
        return self.state, {}

    def step(self, action):
        attention, score, frustration = self.state
        reward = 0
        terminated = False

        # Simulate student response to platform actions
        if action == 0: # Standard Text
            attention -= 0.1 # Attention drops reading standard text
            frustration += 0.05
        elif action == 1: # Simplify Text
            attention += 0.1 # Boosts attention
            frustration -= 0.1
            reward += 1.0
        elif action == 2: # Text-to-Speech
            attention += 0.2 # Highly engaging for reading disabilities
            frustration -= 0.15
            reward += 2.0
        elif action == 3: # Generate Quiz
            if attention > 0.5 and frustration < 0.5:
                score += 0.2 # Good state -> successful quiz
                reward += 5.0
            else:
                score -= 0.1 # Bad state -> failed quiz
                frustration += 0.3
                reward -= 5.0 # Penalty for quizzing a frustrated student

        # Clip values between 0 and 1
        self.state = np.clip([attention, score, frustration], 0.0, 1.0)
        
        # End session if frustration is maxed out
        if frustration >= 1.0 or score >= 1.0:
            terminated = True

        return self.state, float(reward), terminated, False, {}