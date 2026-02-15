import gymnasium as gym
from gymnasium import spaces
import numpy as np
import random

class LiteratureAdaptationEnv(gym.Env):
    def __init__(self):
        super(LiteratureAdaptationEnv, self).__init__()
        
        # Actions: 0=Original, 1=Simplification, 2=Summary, 3=TTS+Visuals
        self.action_space = spaces.Discrete(4)
        
        # State: [Difficulty, Focus, Disability, Fatigue, Last_Action_Was_Helpful]
        # We added 'Fatigue' and 'History' to make it a harder problem
        self.observation_space = spaces.Box(low=0, high=1, shape=(5,), dtype=np.float32)
        
        self.max_steps = 100

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.current_step = 0
        
        # Profile Generation (Simulating Real Demographics)
        # 40% No Disability, 30% Dyslexia (0.5), 30% ADHD (1.0)
        rand_val = random.random()
        if rand_val < 0.4: self.disability_type = 0.0
        elif rand_val < 0.7: self.disability_type = 0.5
        else: self.disability_type = 1.0
        
        self.text_difficulty = random.uniform(0.2, 0.9)
        self.student_focus = random.uniform(0.5, 1.0)
        self.fatigue = 0.0 # Starts fresh
        self.last_helpfulness = 0.5
        
        return self._get_obs(), {}

    def _get_obs(self):
        return np.array([
            self.text_difficulty, 
            self.student_focus, 
            self.disability_type,
            self.fatigue,
            self.last_helpfulness
        ], dtype=np.float32)

    def step(self, action):
        self.current_step += 1
        
        # --- SOPHISTICATED REWARD LOGIC (Based on Educ. Psychology) ---
        impact = 0.0
        
        # 1. Fatigue Mechanic: ADHD students tire faster without adaptation
        fatigue_penalty = self.fatigue * 0.2
        
        # 2. Logic Rules
        if self.disability_type == 0.5: # Dyslexia
            if action == 3: impact = 0.8  # TTS is best
            elif action == 1: impact = 0.3
            else: impact = -0.4
            
        elif self.disability_type == 1.0: # ADHD
            if action == 2: impact = 0.9 # Summaries help focus
            elif action == 3: impact = 0.4 # TTS helps a bit
            else: impact = -0.5
            
        else: # None
            if action == 0: impact = 0.5
            else: impact = -0.2 # Unnecessary help is annoying
            
        # 3. Apply Fatigue Dynamics
        if impact > 0.5: 
            self.fatigue = max(0, self.fatigue - 0.1) # Good help reduces fatigue
        else:
            self.fatigue = min(1, self.fatigue + 0.1) # Bad help increases fatigue
            
        # Final Reward
        reward = impact - fatigue_penalty
        
        # Update State
        self.last_helpfulness = 1.0 if reward > 0 else 0.0
        self.student_focus = np.clip(self.student_focus + random.uniform(-0.05, 0.05) - (self.fatigue * 0.1), 0, 1)
        
        terminated = self.current_step >= self.max_steps
        
        return self._get_obs(), reward, terminated, False, {}