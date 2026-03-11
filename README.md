# IncludEd 2.0 - ML-Powered PDF Accessibility for Neurodivergent Learners

IncludEd 2.0 is an **ML-powered content accessibility platform** that transforms literature PDFs into Dyslexia and ADHD-friendly reading experiences. Teachers upload PDFs of novels, plays, or general educational content, and the ML pipeline automatically analyzes, classifies, segments, and renders them in an accessible format with adaptive learning features.

---

## Table of Contents

- [Demo Video](#demo-video)
- [Live / Deployed Version](#live--deployed-version)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Installation & Setup](#installation--setup)
- [Related Project Files](#related-project-files)
- [Research Context](#research-context)

---

## Demo Video

> A 5-minute walkthrough of IncludEd 2.0's core features — PDF analysis, accessible reading modes, TTS, quiz generation, teacher tools, and the adaptive RL engine.

[![IncludEd 2.0 Demo](https://img.shields.io/badge/▶%20Watch%20Demo-YouTube-red?style=for-the-badge&logo=youtube)](https://youtu.be/DEMO_VIDEO_LINK)

<!-- TODO: Replace the link above with the actual 5-minute demo video URL.
     The demo should showcase:
       - Teacher: uploading & analyzing a PDF, previewing accessible content
       - Student: reading with chat-bubble dialogue, OpenDyslexic font, bionic reading
       - Student: TTS with word-level highlighting, focus mode
       - Student: taking a quiz, vocabulary mastery, achievements
       - Teacher: viewing student progress dashboards and recommendations
       - RL Agent: adaptive content adjustments in action
-->

---

## Live / Deployed Version

| Platform | Link |
|----------|------|
| Web App  | [https://included-app.example.com](https://included-app.example.com) |

<!-- TODO: Replace the link above with the actual deployed URL, or provide a downloadable package (.exe / .apk / .deb) link below:
     | Desktop Installer | [Download .exe](https://link-to-installer) |
     | Android APK       | [Download .apk](https://link-to-apk)       |
-->

---

## System Architecture

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│   Frontend (React/TS)   │────▶│  Backend (Express.js)   │────▶│  AI Service (FastAPI)   │
│       Port 8080         │     │       Port 3000          │     │       Port 8082          │
├─────────────────────────┤     ├─────────────────────────┤     ├─────────────────────────┤
│ • Sliding Chapter Nav   │     │ • Auth (Firebase + JWT) │     │ Cloud ML Infrastructure:│
│ • Character Map Panel   │     │ • Literature CRUD       │     │  • HF Inference API     │
│ • Phonics Breakdown     │     │ • Quiz Management       │     │  • Google Gemini API    │
│ • Focus Mode            │     │ • Progress Tracking     │     │  • Mistral/Qwen/BERT    │
│ • TTS + Word Sync       │     │ • Analytics             │     │  • RL Agent Integration │
└─────────────────────────┘     └──────────┬──────────────┘     └─────────────────────────┘
                                           │
                                ┌──────────▼──────────────┐
                                │   Database Cluster      │
                                │  • PostgreSQL  (5433)   │
                                │  • MongoDB     (27017)  │
                                │  • Redis       (6379)   │
                                │  • SQLite (dev fallback)│
                                └─────────────────────────┘
```

---

## Key Features

### Cloud-First ML Pipeline (AI Service)
- **Structural Analysis** — Mistral-7B via HF Inference for precise Act/Chapter detection.
- **Pedagogical Quiz Gen** — Multi-tier generation via Gemini and Qwen 2.5 (Hugging Face).
- **Intelligence Services** — BERT NER for characters and DeBERTa for contextual Q&A.
- **Contextual Simplification** — Real-time text simplification + Author's Intent via Gemini.
- **Phonics Engine** — Phonetic breakdown for any English/French word to aid pronunciation.

### Student Reading Experience
- **Sliding Chapter Navigation** — A modern, touch-friendly navigation bar at the top of the reader.
- **Character Map** — Dynamic relationship tracker that updates as the student reads.
- **Highlight to Understand** — Instant simplification of difficult passages with cultural analogies (Rwanda context).
- **Pronunciation Helper** — Phonics breakdown and audio playback for struggling readers.
- **Chat-Bubble Dialogue** — Play scripts rendered as an interactive messaging interface.
- **Adaptive RL Engine** — Adjusts text complexity and provides "Breathing Breaks" based on engagement.

### Teacher Tools
- **PDF Analyzer** — Upload, analyze, and preview how content appears to students.
- **Progress Insights** — Monitor reading speed, comprehension, and vocabulary mastery.

### Reinforcement Learning Engine
- **9-dimensional state space** (reading speed, attention, disability type, text difficulty, etc.)
- **6 adaptive actions** (original text, simplification levels, TTS, syllable breaks, attention breaks)
- **Disability-specific reward structures** for personalized learning paths

---

## Installation & Setup

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| [Node.js](https://nodejs.org/) | v18+ | Backend & Frontend runtime |
| [Python](https://www.python.org/) | 3.11+ | AI Service runtime |
| [Docker & Docker Compose](https://www.docker.com/) | Latest | Database infrastructure |
| [Git](https://git-scm.com/) | Latest | Version control |
| Internet Connection | — | Required for cloud-based ML models (Hugging Face / Gemini) |

### Step 1 — Clone the Repository

```bash
git clone https://github.com/shemankubana/IncludEd-2.0.git
cd IncludEd-2.0
```

### Step 2 — Configure Environment Variables

Create `.env` files in each service directory using the templates below.

**Backend** — create `backend/.env`:
```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5433/included_db
FRONTEND_URL=http://localhost:8080
AI_SERVICE_URL=http://localhost:8082
```

**Frontend** — create `frontend/.env`:
```env
VITE_API_URL=http://localhost:3000
VITE_AI_SERVICE_URL=http://localhost:8082
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
```

**AI Service** — create `ai-service/.env`:
```env
HF_API_TOKEN=your_huggingface_token
GEMINI_API_KEY=your_gemini_api_key
USE_HF_INFERENCE=1
```

> **Note**: This version of IncludEd 2.0 uses a **Cloud-First AI architecture**. All heavy processing is offloaded to Hugging Face Serverless endpoints and Google Gemini, ensuring smooth performance even on low-RAM laptops.

> **Tip**: Copy from `.env.example` at the project root if available, and fill in your own values.

### Step 3 — Start the Databases

```bash
docker-compose up -d
```

This launches PostgreSQL (port 5433), MongoDB (port 27017), and Redis (port 6379).

Verify they are running:
```bash
docker-compose ps
```

### Step 4 — Install & Start the Backend

```bash
cd backend
npm install
npm run dev
```

The Express API server will start on **http://localhost:3000**.

### Step 5 — Install & Start the AI Service

```bash
cd ai-service
python -m venv venv
source venv/bin/activate        # On Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl
python main.py
```

The FastAPI server will start on **http://localhost:8082**.

### Step 6 — Install & Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The React app will start on **http://localhost:8080**.

### Step 7 — Open the App

Navigate to **http://localhost:8080** in your browser. You should see the IncludEd landing page.

### Quick Start Summary

| Terminal | Command | Service |
|----------|---------|---------|
| 1 | `docker-compose up -d` | Databases |
| 2 | `cd backend && npm install && npm run dev` | Backend API (`:3000`) |
| 3 | `cd ai-service && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python -m spacy download en_core_web_sm && python main.py` | AI Service (`:8082`) |
| 4 | `cd frontend && npm install && npm run dev` | Frontend (`:8080`) |

---

## Related Project Files

### Frontend (`/frontend`)

| File / Directory | Description |
|------------------|-------------|
| `src/App.tsx` | Main application router with protected routes |
| `src/main.tsx` | Application entry point |
| `src/pages/student/Dashboard.tsx` | Student dashboard page |
| `src/pages/student/Reader.tsx` | Accessible literature reader |
| `src/pages/student/Quiz.tsx` | Quiz interface |
| `src/pages/student/Achievements.tsx` | Gamification & achievements |
| `src/pages/teacher/Dashboard.tsx` | Teacher dashboard |
| `src/pages/teacher/CreateContent.tsx` | Content creation tools |
| `src/pages/teacher/LiteratureAnalyzer.tsx` | PDF analyzer page |
| `src/pages/teacher/MyContent.tsx` | Content management |
| `src/pages/admin/Dashboard.tsx` | Admin dashboard |
| `src/components/reader/` | Student reader UI components |
| `src/components/LiteratureViewer/` | Adaptive content rendering |
| `src/components/play/` | Chat-bubble play dialogue |
| `src/components/literature/` | Literature management UI |
| `src/components/teacher/` | Teacher tool components |
| `src/contexts/AuthContext.tsx` | Authentication state provider |
| `src/services/` | API integration layer |
| `vite.config.ts` | Vite build configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `package.json` | Frontend dependencies |

### Backend (`/backend`)

| File / Directory | Description |
|------------------|-------------|
| `src/server.js` | Express application entry point |
| `src/routes/auth.js` | Authentication routes (Firebase + JWT) |
| `src/routes/literature.js` | PDF upload, analysis, CRUD operations |
| `src/routes/quiz.js` | Quiz management endpoints |
| `src/routes/progress.js` | Student progress tracking |
| `src/routes/sessions.js` | Reading session management |
| `src/routes/vocab.js` | Vocabulary tracking |
| `src/routes/analytics.js` | Analytics & statistics |
| `src/routes/onboarding.js` | User onboarding workflow |
| `src/routes/admin.js` | Admin management functions |
| `src/models/User.js` | User account model |
| `src/models/Literature.js` | Literature document model |
| `src/models/Quiz.js` | Quiz data model |
| `src/models/Session.js` | Reading session model |
| `src/models/StudentProfile.js` | Extended student profile |
| `src/models/Vocabulary.js` | Vocabulary items model |
| `src/config/database.js` | Sequelize + PostgreSQL/SQLite setup |
| `src/config/firebase-admin.js` | Firebase Admin SDK config |
| `src/middleware/` | Express middleware (auth, etc.) |
| `package.json` | Backend dependencies |

### AI Service (`/ai-service`)

| File / Directory | Description |
|------------------|-------------|
| `main.py` | FastAPI application (20+ endpoints) |
| `requirements.txt` | Python dependencies |
| `ml_pipeline/structural_segmenter.py` | Cloud-powered Chapter/Act/Scene segmentation |
| `ml_pipeline/quiz_generator.py` | Multi-tier Pedagogical question generation |
| `services/hf_inference_service.py` | Hugging Face InferenceClient wrapper for all cloud models |
| `services/gemini_service.py` | Primary service for Simplification and Author's Intent |
| `services/character_service.py` | Cloud-based character extraction and Q&A descriptions |
| `services/pronunciation_service.py` | Phonics breakdown and pronunciation logic |
| `services/tts_service.py` | Text-to-Speech (edge-tts) |
| `services/rl_agent_service.py` | Reinforcement Learning agent |
| `services/stt_service.py` | Speech-to-Text assessment |

### RL Engine (`/rl-engine`)

| File / Directory | Description |
|------------------|-------------|
| `included_env.py` | Gymnasium environment for adaptive learning |
| `train_model.py` | RL model training script |
| `model_versions.json` | Model version tracking |

### Root / Infrastructure

| File / Directory | Description |
|------------------|-------------|
| `docker-compose.yml` | Database infrastructure (PostgreSQL, MongoDB, Redis) |
| `.env.example` | Environment variable template |
| `scripts/seed_rwanda_corpus.js` | Database seeding with Rwandan literature |
| `Prompt reference.pdf` | AI prompt design documentation |

---

## Research Context

This project serves as the technical implementation for the **ALU BSc. Software Engineering Capstone (2026)**. It focuses on making literature accessible to neurodivergent learners (Dyslexia, ADHD) in the Rwandan educational context through ML-driven adaptive reading experiences.
