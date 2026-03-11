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
│ • Student Reader        │     │ • Auth (Firebase + JWT) │     │ ML Pipeline:            │
│ • Teacher Dashboard     │     │ • Literature CRUD       │     │  • FrontMatterFilter    │
│ • Admin Panel           │     │ • Quiz Management       │     │  • ContentClassifier    │
│ • Chat-bubble Dialogue  │     │ • Progress Tracking     │     │  • StructuralSegmenter  │
│ • TTS Controls          │     │ • Session Management    │     │  • QuestionGenerator    │
│ • Bionic Reading        │     │ • Analytics             │     │  • EmotionAnalyzer      │
│ • Focus Mode            │     │                         │     │ Services:               │
│                         │     │                         │     │  • TTS (edge-tts)       │
│                         │     │                         │     │  • RL Agent             │
│                         │     │                         │     │  • FLAN-T5-large        │
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

### ML Pipeline (AI Service)
- **Front Matter Filter** — Automatically detects and removes TOC, forewords, prefaces, prologues, dedications, epigraphs, and copyright pages
- **Content Classifier** — Heuristic + ML classification distinguishing plays from novels from generic text
- **Structural Segmenter** — Font-size analysis + regex heading detection to build Act/Scene or Chapter/Section hierarchy
- **Question Generator** — Pedagogy-aware comprehension questions via FLAN-T5-large (offline)
- **Emotion Analyzer** — Dialogue emotion detection for enriched play rendering

### Student Reading Experience
- **Chat-Bubble Dialogue** — Play scripts rendered as a messaging interface with character avatars
- **Accessible Fonts** — OpenDyslexic and Lexend font toggles for dyslexia-friendly typography
- **Bionic Reading** — Bold first syllables of words to create visual anchors for faster reading
- **TTS with Word Sync** — Text-to-speech (edge-tts) with real-time word-level highlighting
- **Focus Mode** — Dimmed surroundings to reduce visual distraction for ADHD learners
- **Vocabulary Mastery** — Track and practice difficult words across reading sessions
- **Speech-to-Text Assessment** — Evaluate reading fluency through voice input
- **Quizzes & Achievements** — Comprehension quizzes with gamification elements

### Teacher Tools
- **PDF Analyzer** — Upload, analyze, and preview how content appears to students
- **Content Management** — Manage literature assignments across classes
- **Student Progress Dashboards** — Monitor reading speed, comprehension, and engagement
- **AI Recommendations** — Adaptive suggestions for supporting individual learners

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
| ~8 GB free RAM | — | Required for local HuggingFace models (FLAN-T5-large, BERT NER, DeBERTa) |

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
# No API keys required — all models run locally via HuggingFace
DISABLE_NOUGAT=1      # Set to 0 to enable Nougat PDF extraction (~1.6 GB download)
DISABLE_MISTRAL=1     # Set to 0 to enable Mistral-7B heading detection (~14 GB, GPU only)
```

> All AI features run fully offline using HuggingFace models downloaded on first use (~3–5 GB total for FLAN-T5-large, BERT NER, DeBERTa).

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
| `ml_pipeline/analyzer.py` | LiteratureAnalyzer orchestrator |
| `ml_pipeline/book_brain.py` | BookBrain semantic analysis |
| `ml_pipeline/content_classifier.py` | Play vs. novel classification |
| `ml_pipeline/front_matter_detector.py` | TOC/foreword detection |
| `ml_pipeline/front_matter_filter.py` | Non-learning content filtering |
| `ml_pipeline/structural_segmenter.py` | Chapter/Act/Scene segmentation |
| `ml_pipeline/quiz_generator.py` | Pedagogical question generation |
| `ml_pipeline/emotion_analyzer.py` | Dialogue emotion analysis |
| `ml_pipeline/language_detector.py` | English/French detection |
| `services/tts_service.py` | Text-to-Speech (edge-tts) |
| `services/rl_agent_service.py` | Reinforcement Learning agent |
| `services/accessibility_adapter.py` | Content accessibility transforms |
| `services/gemini_service.py` | Disabled stub (Gemini replaced by local models) |
| `ml_pipeline/nougat_extractor.py` | Nougat PDF→markdown extractor (facebook/nougat-base) |
| `services/character_service.py` | BERT NER character extraction + DeBERTa Q&A descriptions |
| `services/simplification_service.py` | Text simplification |
| `services/comprehension_tracker.py` | Comprehension monitoring |
| `services/teacher_intelligence.py` | Teacher insights engine |
| `services/teacher_recommendations.py` | Adaptive recommendation engine |
| `services/stt_service.py` | Speech-to-Text assessment |
| `services/word_difficulty_service.py` | Word difficulty scoring |
| `ml_pipeline/tests/` | ML pipeline unit tests |

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
