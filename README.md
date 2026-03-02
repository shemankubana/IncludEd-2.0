# IncludEd 2.0 - AI-Powered Adaptive Learning Platform

IncludEd 2.0 is a specialized educational ecosystem designed to support primary school students (P3-P6) in Rwanda who have learning differences such as **Dyslexia** and **ADHD**. 

The platform uses **Reinforcement Learning (RL)** to dynamically adapt educational content (text simplifications, syllable breaks, TTS, and focus prompts) based on real-time student interaction telemetry.

## 🏗️ System Architecture

The platform follows a distributed microservices pattern to separate concerns between business logic, AI processing, and testing interfaces.

```mermaid
graph TD
    A[React Frontend] -- Telemetry/API --> B(Node.js Backend)
    B -- Sessions/Profiles --> C{PostgreSQL}
    A -- Adaptive Requests --> D[Python AI Service]
    D -- RL Policy --> E(PPO Model)
    D -- Text Utils --> F(spaCy / Ollama)
    D -- Audio --> G(edge-TTS)
    B -- Analytics Sync --> D
```

### Core Services
1.  **Node.js Backend (Port 3000)**: Manages users, student profiles, and reading session history.
2.  **Python AI Service (Port 8082)**: The "Brain" of the project. Built with FastAPI, it hosts the PPO agent, Ollama-powered content structuring, and accessibility tools.
3.  **React Frontend (Port 8080/81)**: The student/teacher interface built with Vite, Tailwind CSS, and Shadcn UI.

---

## 🛠️ Setup & Development

Follow these steps to set up IncludEd 2.0 on a new machine.

### 1. Prerequisites
- **Node.js** (v18+)
- **Python** (3.11+)
- **FFmpeg**: Required for audio processing.
  - Mac: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg`
- **Ollama**: Required for smart content structuring and question generation.
  - [Download Ollama](https://ollama.com/)
  - Run `ollama pull llama3` after installation.

### 2. Environment Configuration

Clone the repository and set up the environment files:

#### Backend (`/backend/.env`)
Create a `.env` file in the `backend` directory:
```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/included_db
FRONTEND_URL=http://localhost:8080
AI_SERVICE_URL=http://localhost:8082
FIREBASE_PROJECT_ID=your-project-id
NODE_ENV=development
```

#### Frontend (`/frontend/.env`)
Create a `.env` file in the `frontend` directory:
```env
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Firebase Setup
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** (Google & Email/Password).
3. Generate a **Web App** and copy the config to the frontend `.env`.
4. Go to **Project Settings > Service Accounts**, generate a new private key, and save it as `backend/serviceAccountKey.json`.

### 4. Startup Sequence

#### Step A: Database
Ensure PostgreSQL is running.
```bash
# Example if using Docker
docker-compose up -d
```

#### Step B: Backend
```bash
cd backend
npm install
npm run dev
```

#### Step C: AI Service
```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python main.py
```

#### Step D: Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🚀 Key Features

- **🎭 Smart Content Structuring**: Automatically detects Plays and Novels from PDFs and formats them for readability.
- **🎧 Adaptive Reader**: Real-time syllable highlighting, text-to-speech, and personalized intervention from the RL agent.
- **📈 Teacher Analytics**: Track student progress, reading speed, and accessibility needs across the class.
- **♿ Dyslexia Friendly**: Integrated OpenDyslexic font support and high-contrast focus modes.

---

## 📜 Research Context
This project serves as the technical implementation for the **ALU BSc. Software Engineering Capstone (2026)**. It focuses on solving the achievement gap for neurodivergent learners in the Rwandan context.

**Lead Developer**: Ivan Shema