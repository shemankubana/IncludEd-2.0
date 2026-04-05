# IncludEd 2.0 — Adaptive Reading Platform for Neurodivergent Learners

IncludEd 2.0 is an **RL-powered adaptive reading platform** that transforms literature PDFs into Dyslexia and ADHD-friendly reading experiences. Teachers upload materials (novels, plays, poems); a 15-module ML pipeline classifies, segments, and enriches them; and a PPO reinforcement learning agent monitors student reading behavior in real-time to suggest personalized interventions.

This documentation serves as a **Comprehensive Setup & Evaluation Guide** tailored for project moderators and the defense panel.

---

## 📌 Table of Contents

1. [Demo & Deployed Application](#demo--deployed-application)
2. [Key Features](#key-features)
3. [System Architecture](#system-architecture)
4. [Prerequisites](#prerequisites)
5. [Local Setup & Installation (Step-by-Step)](#local-setup--installation-step-by-step)
   - [Clone Repository](#1-clone-the-repository)
   - [Environment Configuration](#2-environment-configuration)
   - [Initialize Databases (Docker)](#3-initialize-databases)
   - [Service 1: AI Engine (Python)](#4-install--run-ai-service)
   - [Service 2: Backend API (Node.js)](#5-install--run-backend-api)
   - [Service 3: Frontend Web App (React)](#6-install--run-frontend-web-app)
6. [Evaluation Guide for Moderators](#evaluation-guide-for-moderators)
7. [Research Context & Metrics Targets](#research-context--metrics-targets)

---

## 🎥 Demo & Deployed Application

- **Live Application**: [https://includ-ed-2-0.vercel.app/](https://includ-ed-2-0.vercel.app/) (Note: May experience cold-start delays on free hosting tiers)
- **Video Walkthrough**: [![Watch Demo](https://img.shields.io/badge/▶%20Watch%20Demo-Google%20Drive-blue?style=for-the-badge&logo=googledrive)](https://drive.google.com/file/d/12IU3FFzEQrm0FHPuDv1QC2dt-C-g2KKo/view?usp=sharing)

---

## ✨ Key Features

### Reinforcement Learning Engine (PPO)
- Tracks 9 dimensions: reading speed, mouse dwell, scroll hesitation, backtrack frequency, attention score, disability type, text difficulty, session fatigue, and content type.
- Adapts UI dynamically (e.g., Light/Heavy Simplification, Syllable Parsing, TTS Highlighting).

### 15-Module Cloud-First ML Pipeline
- **3-Tier Simplification Fallback**: Google Gemini → HuggingFace Qwen → Local Rule-based.
- **Rwandan Cultural Bridge**: 107-entry Kinyarwanda dictionary mapping Western idioms to local Rwandan contexts.
- **NLP Tasks**: NER extraction (BERT + spaCy), Emotion tracking (DistilRoBERTa), Language detection (langdetect), and automated IRT quiz generation.

### Gamified Student Interface
- **Accessibility Tools**: Bionic Reading, OpenDyslexic font, syllable coloration, adjustable TTS (edge-tts) with word synchronization.
- **PlayDialogueUI**: Transforms static scripts into an engaging, chat-like animated UI.
- Gamification via XP, Streaks, and Badges (Stored and synced locally via PWA/IndexedDB).

### Actionable Teacher Intelligence
- Automatically aggregates classroom telemetry (wpm, attention levels, quiz scores).
- Synthesizes Natural Language alerts outlining struggling students and actionable intervention recommendations.

---

## 🏗 System Architecture

```text
┌──────────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────────┐
│  Frontend (React 18/TS)  │────▶│  Backend (Express.js)    │────▶│  AI Service (FastAPI)     │
│       Vite (:5173)       │     │       Node (:3000)        │     │       Python (:8082)      │
├──────────────────────────┤     ├──────────────────────────┤     ├──────────────────────────┤
│ Adaptive Reader (PWA)    │     │ Firebase JWT Auth        │     │ 15-Module ML Pipeline    │
│ Signal Tracker (5s)      │     │ Literature CRUD + Upload │     │ PPO RL Agent (SB3)       │
│ Dyslexia Controls        │     │ Quiz & Progress API      │     │ 3-Tier Simplification    │
│ TTS + Word Sync          │     │ Teacher Intelligence     │     │ TTS (edge-tts)           │
└──────────────────────────┘     └───────────┬──────────────┘     └──────────────────────────┘
                                             │
                                  ┌──────────▼──────────────┐     ┌──────────────────────────┐
                                  │   Database Cluster      │     │   3rd-Party APIs         │
                                  │  SQLite (Dev fallback)  │     │  Google Gemini           │
                                  │  PostgreSQL (Prod)      │     │  HuggingFace Inference   │
                                  │  Redis      (Cache)     │     │  Firebase Auth           │
                                  └─────────────────────────┘     └──────────────────────────┘
```

---

## 📋 Prerequisites

To run this project locally, ensure you have the following installed:

1. **Node.js** (v18.x or higher) — Required for Frontend and Backend.
2. **Python** (v3.11 or higher) — Required for AI Service and ML Models.
3. **Docker & Docker Compose** (Latest) — Required to spin up backing services (PostgreSQL, Redis, Mongo).
4. **Git** — For cloning the repository.
5. **Firebase Account** — For authentication keys.
6. **Google Gemini / HuggingFace Keys** — For AI text augmentation.

---

## 🛠 Local Setup & Installation (Step-by-Step)

### 1. Clone the repository

```bash
git clone https://github.com/shemankubana/IncludEd-2.0.git
cd IncludEd-2.0
```

### 2. Environment Configuration

Because the platform relies on external authentication and AI capabilities, you must populate the environment files. 

**Backend (`backend/.env`)**
Create a `.env` file in the `backend/` directory based on `.env.example`:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/included_literature
FRONTEND_URL=http://localhost:5173
AI_SERVICE_URL=http://localhost:8082
JWT_SECRET=your_super_secret_jwt_key_here
```
*(Note: If `DATABASE_URL` is omitted, the backend will default to a local SQLite file (`included.sqlite`) at the project root.)*

**Frontend (`frontend/.env`)**
Create a `.env` file in the `frontend/` directory:
```env
VITE_API_URL=http://localhost:3000
VITE_AI_URL=http://localhost:8082
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```
*(These keys are retrieved from your Firebase Console under Project Settings > General > Web Apps).*

**AI Service (`ai-service/.env`)**
Create a `.env` file in the `ai-service/` directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key
HF_API_TOKEN=your_huggingface_access_token
USE_HF_INFERENCE=1
```

### 3. Initialize Databases

Ensure Docker is running on your machine. From the root of the project, execute:
```bash
docker-compose up -d
```
This spins up:
- PostgreSQL (Port 5432)
- MongoDB (Port 27017)
- Redis (Port 6379)

### 4. Install & Run AI Service

The AI service handles NLP, RL predictions, and simplification tasks. **Run this in its own terminal.**

```bash
cd ai-service

# Create and activate a Virtual Environment
python3 -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Download required SpaCy language models
python -m spacy download en_core_web_sm

# Start the FastAPI server
python main.py
```
*The AI Service will run on `http://localhost:8082`.*

### 5. Install & Run Backend API

The backend handles database transactions, routing, and user states. **Run this in its own terminal.**

```bash
cd backend

# Install dependencies
npm install

# Start the development server
npm run dev
```
*The Backend API will run on `http://localhost:3000`.*

### 6. Install & Run Frontend Web App

 The frontend houses the interactive React application. **Run this in its own terminal.**

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```
*The Frontend will run on `http://localhost:5173`.*

---

## 👩‍🏫 Evaluation Guide for Moderators

Once all three terminal windows are running (Frontend, Backend, AI Service), navigate to **[http://localhost:5173](http://localhost:5173)** in your browser.

To evaluate the full flow, we recommend the following testing path:

1. **Teacher Setup**:
   - Register a new account and specify your role as `Teacher`.
   - Navigate to the **Teacher Dashboard**.
   - Go to **Create Content** and select a PDF or enter text manually (e.g., a chapter of a book). Choose a target Language and Difficulty.
   - Wait for the **AI Service** to complete the 15-module analysis (Classification, Emotion Detection, Vocabulary extraction, etc.).
   
2. **Student Simulation**:
   - Open a secondary browser (or Incognito mode) and register a `Student` account.
   - Go back to the Teacher view, click on **Dashboard**, and invite the student using their email string (this sets up a classroom tie).
   - In the Student view, navigate to the **Lesson Library** and start the newly generated reading assignment.

3. **Assessing Adaptive Capabilities** (The Defense Core):
   - **Dyslexia Toggles**: Toggle the "Dyslexia Friendly" configuration in the bottom left menu to see standard fonts map to OpenDyslexic paired with altered letter spacing.
   - **TTS & Highlighting**: Highlight a phrase on screen and click **Read Aloud**. The text should synchronize with Edge-TTS audio.
   - **Simplifications**: Highlight a complex word or metaphor, and observe the AI simplify it in real-time, bridging any Rwandan cultural analogies if identified.
   - **Teacher Intelligence**: After simulating a reading session on the student end, revisit the Teacher Dashboard. It will calculate class-wide alerts and specific student intervention recommendations.

---

## 📊 Research Context & Metrics Targets

This platform represents the technical milestone for the **ALU BSc. Software Engineering Capstone (2026)**. It addresses the challenge of making literature accessible to neurodivergent learners (specifically Dyslexia & ADHD profiles) in the Rwandan educational context.

| Metric Targeted | Success Threshold | Description |
|--------|--------|--------|
| **Comprehension Delta** | `>= 25%` | Improvement compared to static PDF reading baselines. |
| **Attention Retention** | `>= 30%` | Increase in seated focus via ADHD chunking. |
| **Cohen's $d$** | `>= 0.5` | Standardized measure of effect size of the RL intervention. |
| **Policy Loss** | `< 0.05` | PPO agent stability over iterations. |

**IncludEd 2.0 © 2026** — *Empowering every reader.*
