# IncludEd 2.0 - Adaptive Learning Platform

## Overview
An AI-powered platform for teaching literature and adapting educational materials for primary school students with learning differences in Rwanda (P3-P6). It uses Reinforcement Learning (PPO) to automatically adapt text (simplification, syllable breaks, TTS) for students with Dyslexia and ADHD based on their attention and reading behaviour.

## Architecture
The platform is composed of three main services:
- **Node.js Backend (Port 3000)**: Express API with PostgreSQL for managing user accounts, student profiles, reading sessions, and persisting RL training data.
- **Python AI Service (Port 8080)**: FastAPI service hosting the PPO Agent, Attention Monitor, and Text Adaptation engine based on spaCy and rule-based heuristics.
- **Python Streamlit UI (Port 8501)**: A multi-page testing UI for simulating student sessions, monitoring attention, viewing teacher analytics, and inspecting the RL agent policy.

---

## Quick Start (Local Demo)

Follow these steps to set up and run the different components.

### 1. Prerequisites
Ensure you have the following installed:
- Node.js (v18+)
- Python 3.11+
- PostgreSQL (or Docker to run it via `docker-compose`)

### 2. Database Setup
Start the PostgreSQL database. If using Docker:
```bash
docker-compose up -d
```
> **Note**: This will start a Postgres instance on port 5432. Ensure the `DATABASE_URL` in `backend/.env` points to this instance.

### 3. Start the Node.js Backend API
The backend stores users, profiles, and reading sessions.

```bash
cd backend
npm install

# Make sure you have the .env file configured properly
# cp .env.example .env (if applicable)

# Run database migrations (using Sequelize)
# Note: IncludEd auto-syncs models on startup locally, 
# but migrations should be run in prod.

# Start the development server
npm run dev
```
*The backend should now be running on `http://localhost:3000`.*

### 4. Start the Python AI Service
The AI service needs to be running for text adaptation and RL predictions.

```bash
cd ai-service

# Create and activate a virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Start the FastAPI server
python main.py
```
*The AI Service should now be running on `http://localhost:8080`.*

### 5. Start the Streamlit Testing UI
The Streamlit app is the main way to interact with the simulated backend and AI features right now.

```bash
cd streamlit_app

# Activate the virtual environment
# (You can reuse the one from ai-service or create a new one)
python3.11 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Run the app
streamlit run app.py
```
*The UI will open automatically in your browser at `http://localhost:8501`.*

---

## Exploring the Streamlit Demo

Once the Streamlit app is open, you can explore four different pages from the sidebar:

1. **🎓 Student Session**: Simulate a full reading session. Select a student profile (e.g., Dyslexia, ADHD), start the session, and adjust the telemetry sliders (e.g., Reading Speed, Mouse Dwell) to see the Reinforcement Learning agent dynamically change its pedagogical action (like switching from "Keep Original" to "Syllable Break" or "Attention Break").
2. **🧠 Attention Monitor**: Play around with raw telemetry values to see how they are converted into a composite "Focus Score" between 0 and 1, understanding the reward logic.
3. **📊 Teacher Dashboard**: View dummy class analytics, average attention scores by disability type, and a scatter plot of Quiz Scores vs. Attention Spans based on the simulated sessions you've run.
4. **🤖 RL Inspector**: Probe the RL Policy directly. Force specific 8-dim state vectors (e.g., High Fatigue, ADHD, Low Attention) to see exactly what the model predicts.

## Retraining the RL Model
If you want to modify the environment or retrain the PPO model from scratch:
```bash
cd rl-engine
source ../ai-service/venv/bin/activate
pip install gymnasium stable-baselines3 torch

# Train the model (takes a few minutes)
python train_model.py

# Evaluate the model
python evaluate_model.py
```
This will overwrite `ppo_included_agent.zip` in the `ai-service/services` folder. Restart the AI Service to load the new model.

## License
Educational use - ALU Capstone Project 2026.