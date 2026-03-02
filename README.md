# IncludEd 2.0 - ML-Powered PDF Accessibility for Neurodivergent Learners

IncludEd 2.0 is an **ML-powered content accessibility platform** that transforms literature PDFs into Dyslexia and ADHD-friendly reading experiences. Teachers upload PDFs of novels, plays, or general educational content, and the ML pipeline automatically:

1. **Filters front matter** (TOC, forewords, prefaces, prologues, dedications, epigraphs)
2. **Classifies** the document type (play vs. novel vs. generic)
3. **Segments** into chapters (novels) or acts/scenes (plays)
4. **Renders** content in an accessible layout with chat-bubble dialogue for plays
5. **Provides TTS** with word-level highlighting for audio-synchronized reading

## System Architecture

```
Frontend (React/TypeScript)  -->  Backend (Node.js/Express)  -->  AI Service (Python/FastAPI)
     Port 8080                      Port 3000                       Port 8082

Student Reader:                   Literature CRUD               ML Pipeline:
  - Chat-bubble dialogue          User Auth (Firebase)            - FrontMatterFilter
  - OpenDyslexic font             Progress tracking               - ContentClassifier
  - Bionic reading mode           Quiz management                 - StructuralSegmenter
  - TTS with word sync                                            - QuestionGenerator
  - Focus mode
                                                                Services:
Teacher Analyzer:                                                 - TTSService (edge-tts)
  - PDF upload + analysis                                         - AccessibilityAdapter
  - Live preview                                                  - OllamaService (LLM)
  - Front-matter filter stats
```

## Setup & Development

### Prerequisites
- **Node.js** (v18+)
- **Python** (3.11+)
- **Ollama** (for smart question generation): [Download](https://ollama.com/), then `ollama pull llama3`

### Environment Configuration

**Backend** (`/backend/.env`):
```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/included_db
FRONTEND_URL=http://localhost:8080
AI_SERVICE_URL=http://localhost:8082
```

**Frontend** (`/frontend/.env`):
```env
VITE_API_URL=http://localhost:3000
VITE_AI_SERVICE_URL=http://localhost:8082
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_id
```

**AI Service** (`/ai-service/.env`):
```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

### Startup

```bash
# 1. Database
docker-compose up -d

# 2. Backend
cd backend && npm install && npm run dev

# 3. AI Service
cd ai-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python main.py

# 4. Frontend
cd frontend && npm install && npm run dev
```

## Key Features

### ML Pipeline (AI Service)
- **Front Matter Filter**: Automatically detects and removes TOC, forewords, prefaces, prologues, dedications, epigraphs, copyright pages, and other non-learning content
- **Content Classifier**: Heuristic + ML classification distinguishing plays from novels from generic text
- **Structural Segmenter**: Font-size analysis + regex heading detection builds Act/Scene or Chapter/Section hierarchy
- **Question Generator**: Pedagogy-aware comprehension questions via Ollama LLM

### Student Reading Experience
- **Chat-Bubble Dialogue**: Play dialogue rendered as a messaging app with character avatars, alternating left/right
- **OpenDyslexic Font**: Toggle-able dyslexia-friendly typography
- **Bionic Reading**: Bold first syllables of words to create visual anchors for faster reading
- **TTS with Word Sync**: Text-to-speech using edge-tts with real-time word highlighting
- **Focus Mode**: Dimmed surroundings to reduce visual distraction

### Teacher Tools
- **PDF Analyzer**: Upload, analyze, and preview how content will appear to students
- **Content Management**: Upload, manage, and track literature assignments
- **Front Matter Stats**: See exactly how much non-learning content was filtered out

## Research Context

This project serves as the technical implementation for the **ALU BSc. Software Engineering Capstone (2026)**. It focuses on making literature accessible to neurodivergent learners (Dyslexia, ADHD) in the Rwandan educational context.

**Lead Developer**: Ivan Shema
