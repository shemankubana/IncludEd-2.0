# IncludEd 2.0 — Adaptive Reading Platform for Neurodivergent Learners

IncludEd 2.0 is an **RL-powered adaptive reading platform** that transforms literature PDFs into Dyslexia and ADHD-friendly reading experiences. Teachers upload novels, plays, or poems; a 15-module ML pipeline classifies, segments, and enriches them; and a PPO reinforcement learning agent monitors student reading behavior in real-time to suggest personalized interventions.

---

## Table of Contents

- [Demo Video](#demo-video)
- [Live / Deployed Version](#live--deployed-version)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Installation & Setup](#installation--setup)
- [Project Structure](#project-structure)
- [Research Context](#research-context)

---

## Demo Video

> A walkthrough of IncludEd 2.0's core features — PDF analysis, adaptive reading, TTS, quizzes, teacher analytics, and the RL engine.

[![IncludEd 2.0 Demo](https://img.shields.io/badge/▶%20Watch%20Demo-Google%20Drive-blue?style=for-the-badge&logo=googledrive)](https://drive.google.com/file/d/12IU3FFzEQrm0FHPuDv1QC2dt-C-g2KKo/view?usp=sharing)

---

## Live / Deployed Version

| Platform | Link |
|----------|------|
| Web App  | [https://includ-ed-2-0.vercel.app/](https://includ-ed-2-0.vercel.app/) |

---

## System Architecture

```
┌──────────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────────┐
│  Frontend (React 18/TS)  │────▶│  Backend (Express.js)    │────▶│  AI Service (FastAPI)     │
│       Port 8080          │     │       Port 3000           │     │       Port 8082           │
├──────────────────────────┤     ├──────────────────────────┤     ├──────────────────────────┤
│ Adaptive Reader (PWA)    │     │ Firebase JWT Auth        │     │ 15-Module ML Pipeline    │
│ Signal Tracker (5s)      │     │ Literature CRUD + Upload │     │ PPO RL Agent (SB3)       │
│ RL Suggestion Banner     │     │ Quiz & Progress API      │     │ 3-Tier Simplification    │
│ PlayDialogueUI (Plays)   │     │ Analytics + Insights     │     │ Teacher Intelligence     │
│ Dyslexia Controls        │     │ School & Invitation Mgmt │     │ TTS (edge-tts)           │
│ TTS + Word Sync          │     │ Session Telemetry        │     │ STT Assessment           │
│ i18n (EN + FR)           │     │                          │     │ Kinyarwanda Bridge (107) │
└──────────────────────────┘     └───────────┬──────────────┘     └──────────────────────────┘
                                             │
                                  ┌──────────▼──────────────┐     ┌──────────────────────────┐
                                  │   Database Cluster      │     │   Cloud APIs             │
                                  │  PostgreSQL (Sequelize)  │     │  Google Gemini (Tier 1)  │
                                  │  MongoDB    (Telemetry)  │     │  HuggingFace  (Tier 2)   │
                                  │  Redis      (Cache)      │     │  Firebase Auth           │
                                  └─────────────────────────┘     └──────────────────────────┘
```

---

## Key Features

### Reinforcement Learning Engine
- **PPO agent** (Stable-Baselines3) with a 9-dimensional state space: reading speed, mouse dwell, scroll hesitation, backtrack frequency, attention score, disability type, text difficulty, session fatigue, content type
- **6 adaptive actions**: Keep Original, Light Simplification, Heavy Simplification, TTS + Highlights, Syllable Break, Attention Break
- **Student-controlled**: RL predictions appear as suggestion banners the student can accept or dismiss
- Disability-specific reward structures and rule-based fallback when no model is available
- Model hosted on HuggingFace Hub with automatic download

### Cloud-First NLP Pipeline
- **3-tier simplification** with intelligent fallback (Gemini → HuggingFace Qwen 72B → local rule-based engine)
- **15 ML pipeline modules**: document classifier, structural segmenter, emotion analyzer (DistilRoBERTa), NER extractor (BERT), language detector (EN/FR), front matter filter, quiz generator (adaptive IRT difficulty), vocabulary analyzer, Book Brain pre-analysis, and more
- **107-entry Kinyarwanda cultural bridging dictionary** mapping Western literary concepts to Rwandan parallels
- **Phonics engine** for phonetic breakdown of English and French words

### Student Reading Experience
- **Adaptive Reader** with OpenDyslexic font, bionic reading, syllable colors, reading ruler, adjustable spacing/sizing
- **PlayDialogueUI** — play scripts rendered as animated chat-bubble dialogue with character avatars
- **Highlight to Understand** — select any passage for instant simplification with author's intent, vocabulary help, and Rwanda cultural bridge
- **TTS with word-level highlighting** via edge-tts
- **STT Reading Assessment** for fluency and accuracy tracking
- **Comprehension quizzes** with adaptive difficulty, XP, and badge system (quiz_perfect, quiz_master, story_reader, streak badges)
- **ADHD Chunking Engine** with timed segments and micro-breaks
- **Character Map** and **Vocabulary Sidebar** powered by Book Brain pre-analysis
- **PWA** with service worker and IndexedDB for offline progress caching
- **Bilingual** interface (English + French via i18n)

### Teacher Intelligence
- **Dashboard** with 5 Recharts visualizations: student progress bars, reading accuracy distribution, progress vs accuracy comparison, status distribution pie, class-wide stats
- **AI-generated insights** via Gemini for class-wide engagement analysis
- **Risk classification engine**: students flagged as high/medium/low risk based on comprehension, pacing, frustration, and STT accuracy
- **5 class-level alert types**: common struggle (urgent), pacing issues (warning), vocabulary patterns (warning), low engagement (info), common highlights (warning)
- **Per-student recommendations** with actionable strategies (scheduling, TTS, simplified text, phonics support)
- **Content publishing** workflow with draft/published status

### Admin Tools
- **School management** — create and configure schools
- **User invitations** via magic links with role assignment (student, teacher, admin)

---

## Installation & Setup

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| [Node.js](https://nodejs.org/) | v18+ | Backend & Frontend |
| [Python](https://www.python.org/) | 3.11+ | AI Service |
| [Docker & Docker Compose](https://www.docker.com/) | Latest | Databases |
| Internet Connection | — | Cloud ML APIs (HuggingFace, Gemini) |

### Step 1 — Clone

```bash
git clone https://github.com/shemankubana/IncludEd-2.0.git
cd IncludEd-2.0
```

### Step 2 — Environment Variables

**Backend** — `backend/.env`:
```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5433/included_db
FRONTEND_URL=http://localhost:8080
AI_SERVICE_URL=http://localhost:8082
```

**Frontend** — `frontend/.env`:
```env
VITE_API_URL=http://localhost:3000
VITE_AI_URL=http://localhost:8082
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
```

**AI Service** — `ai-service/.env`:
```env
HF_API_TOKEN=your_huggingface_token
GEMINI_API_KEY=your_gemini_api_key
USE_HF_INFERENCE=1
```

### Step 3 — Start Databases

```bash
docker-compose up -d
```

Launches PostgreSQL (5433), MongoDB (27017), and Redis (6379).

### Step 4 — Start Services

| Terminal | Command | Service |
|----------|---------|---------|
| 1 | `docker-compose up -d` | Databases |
| 2 | `cd backend && npm install && npm run dev` | Backend API (`:3000`) |
| 3 | `cd ai-service && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python -m spacy download en_core_web_sm && python main.py` | AI Service (`:8082`) |
| 4 | `cd frontend && npm install && npm run dev` | Frontend (`:8080`) |

Open **http://localhost:8080** in your browser.

---

## Project Structure

### Frontend (`/frontend`)

| File / Directory | Description |
|------------------|-------------|
| `src/App.tsx` | Main router with role-based protected routes (student/teacher/admin) |
| `src/pages/student/Reader.tsx` | Adaptive reading interface with TTS, dyslexia controls, ADHD breaks |
| `src/pages/student/Dashboard.tsx` | Student home — assigned literature, progress overview |
| `src/pages/student/Quiz.tsx` | Comprehension quiz with adaptive difficulty |
| `src/pages/student/Achievements.tsx` | XP, badges, and gamification |
| `src/pages/student/Lessons.tsx` | Lesson browser |
| `src/pages/teacher/Dashboard.tsx` | Teacher analytics dashboard with risk alerts |
| `src/pages/teacher/CreateContent.tsx` | PDF upload and content creation |
| `src/pages/teacher/LiteratureAnalyzer.tsx` | ML-powered PDF analysis preview |
| `src/pages/teacher/MyContent.tsx` | Content management and publishing |
| `src/pages/teacher/LiteratureReview.tsx` | Content review workflow |
| `src/pages/teacher/Profile.tsx` | Teacher profile settings |
| `src/pages/teacher/PendingApproval.tsx` | Approval queue for new accounts |
| `src/pages/admin/Dashboard.tsx` | Admin overview |
| `src/pages/admin/Users.tsx` | User management |
| `src/pages/AdminSchoolSetup.tsx` | School administrator setup |
| `src/pages/Auth.tsx` | Login / registration |
| `src/pages/Onboarding.tsx` | New user onboarding flow |
| `src/pages/AcceptInvite.tsx` | Magic link invitation handler |
| `src/components/LiteratureViewer/` | Core reading components: ScriptDisplay, ScriptNavBar, DyslexiaRenderer, ADHDChunkingEngine, HighlightToUnderstand, CharacterMap, VocabularySidebar, ComprehensionGraph, DifficultyMap, VocabHelper, PoemDisplay |
| `src/components/play/PlayDialogueUI.tsx` | Animated chat-bubble dialogue for plays |
| `src/components/play/GamificationSystem.tsx` | XP and badge overlay |
| `src/components/reader/` | CharacterTooltip, PoemRenderer, ComprehensionMiniPanel, VocabSidebar, ChapterNavigation, PronunciationHelper, CharacterMapPanel |
| `src/components/teacher/AnalyticsCharts.tsx` | Recharts-based analytics visualizations |
| `src/hooks/useSignalTracker.ts` | Real-time behavioral signal collection (mouse, scroll, attention) |
| `src/hooks/useTranslation.ts` | i18n translation hook (EN + FR) |
| `src/contexts/AuthContext.tsx` | Firebase authentication state provider |
| `src/i18n/` | Localization files (en.json, fr.json) |
| `public/sw.js` | Service worker for PWA offline support |

### Backend (`/backend`)

| File / Directory | Description |
|------------------|-------------|
| `src/server.js` | Express entry point |
| `src/routes/auth.js` | Authentication (Firebase + JWT) |
| `src/routes/literature.js` | PDF upload, ML analysis proxy, CRUD |
| `src/routes/quiz.js` | Quiz management |
| `src/routes/progress.js` | Student progress tracking and completion |
| `src/routes/sessions.js` | Reading session management and telemetry |
| `src/routes/analytics.js` | Class analytics, validation metrics, RL reward trends |
| `src/routes/vocab.js` | Vocabulary tracking |
| `src/routes/schools.js` | School CRUD |
| `src/routes/invitations.js` | Magic link invitations |
| `src/routes/onboarding.js` | User onboarding workflow |
| `src/routes/admin.js` | Admin management |
| `src/routes/stats.js` | Statistics endpoints |
| `src/models/User.js` | User account model |
| `src/models/Literature.js` | Literature document model |
| `src/models/Quiz.js` | Quiz data model |
| `src/models/Session.js` | Reading session model |
| `src/models/StudentProfile.js` | Extended student profile |
| `src/models/StudentStats.js` | Student statistics model |
| `src/models/Vocabulary.js` | Vocabulary items model |
| `src/models/VocabularyMastery.js` | Vocabulary mastery tracking |
| `src/models/LessonProgress.js` | Lesson progress model |
| `src/models/Invitation.js` | Invitation model |
| `src/models/School.js` | School model |
| `src/models/RLTrainingData.js` | RL training data collection |
| `src/config/database.js` | Sequelize + PostgreSQL configuration |
| `src/config/firebase-admin.js` | Firebase Admin SDK setup |

### AI Service (`/ai-service`)

| File / Directory | Description |
|------------------|-------------|
| `main.py` | FastAPI application with 20+ endpoints |
| `requirements.txt` | Python dependencies |
| **ML Pipeline** (`ml_pipeline/`) | |
| `analyzer.py` | Main orchestrator — PDF extraction, classification, segmentation |
| `content_classifier.py` | Heuristic document type detection (play/novel/poem/generic) |
| `structural_segmenter.py` | Hierarchical Act/Scene/Chapter segmentation with emotion tagging |
| `emotion_analyzer.py` | 7-class emotion detection (DistilRoBERTa → NRC lexicon → heuristics) |
| `ner_extractor.py` | Named entity recognition (BERT → spaCy → regex) |
| `language_detector.py` | EN/FR language classification |
| `front_matter_detector.py` | Cover page and back matter removal |
| `front_matter_filter.py` | Content filtering helper |
| `quiz_generator.py` | Multi-tier quiz generation with IRT adaptive difficulty |
| `question_generator.py` | Legacy template-based question generation |
| `book_brain.py` | Pre-analysis: difficulty mapping, vocabulary, character graph, cultural context, struggle zones |
| `vocab_analyzer.py` | Batch vocabulary analysis with difficulty scoring |
| `difficulty_adapter.py` | IRT-based adaptive quiz difficulty with disability adjustments |
| `train_model.py` | RL model training with Cohen's d and versioning |
| **Services** (`services/`) | |
| `rl_agent_service.py` | PPO model loading, prediction, and rule-based fallback |
| `simplification_service.py` | 3-tier text simplification + 107-entry Kinyarwanda bridge |
| `gemini_service.py` | Google Gemini API integration |
| `hf_inference_service.py` | HuggingFace Inference API wrapper |
| `teacher_intelligence.py` | Risk classification and class-level alert generation |
| `teacher_recommendations.py` | Per-student actionable recommendation engine |
| `learner_embedding.py` | Student reading level tracking |
| `comprehension_tracker.py` | Comprehension progress tracking |
| `tts_service.py` | Text-to-Speech via edge-tts |
| `stt_service.py` | Speech-to-Text reading assessment |
| `pronunciation_service.py` | Phonics breakdown and pronunciation logic |
| `character_service.py` | Character extraction and description |
| `word_difficulty_service.py` | Word-level difficulty scoring |
| `accessibility_adapter.py` | Accessibility adaptation utilities |
| `content_analyzer.py` | Content analysis utilities |

### Root / Infrastructure

| File / Directory | Description |
|------------------|-------------|
| `docker-compose.yml` | Database infrastructure (PostgreSQL, MongoDB, Redis) |
| `.env.example` | Environment variable template |
| `scripts/seed_rwanda_corpus.js` | Database seeding with Rwandan literature |
| `docs/use_case_diagram.puml` | UML use case diagram |
| `docs/cloud_architecture.puml` | System architecture diagram |

---

## Research Context

This project is the technical implementation for the **ALU BSc. Software Engineering Capstone (2026)**. It addresses the challenge of making literature accessible to neurodivergent learners (Dyslexia, ADHD) in the Rwandan educational context through ML-driven adaptive reading experiences and reinforcement learning.

### Thesis Metrics Targets
| Metric | Target |
|--------|--------|
| Comprehension improvement | >= 25% |
| Attention increase | >= 30% |
| Cohen's d (effect size) | >= 0.5 |
| RL mean reward | > 0 |
| Policy loss | < 0.05 |
