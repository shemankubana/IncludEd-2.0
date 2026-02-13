# IncludEd - Literature-Focused Adaptive Learning Platform

## Overview
An AI-powered platform for teaching English and French literature to students with learning differences. Teachers upload PDFs of novels, plays, and poetry, which are automatically adapted for students with dyslexia, ADHD, color blindness, and other learning needs.

## Key Features
- 📚 **PDF Upload & Analysis**: Teachers upload literature (Shakespeare, novels, plays)
- 🎨 **Automatic Content Adaptation**: AI reconstructs text for accessibility
- 🔊 **Multi-Accent TTS**: British English, American English, French pronunciation
- ❓ **Auto Question Generation**: AI creates comprehension questions
- ♿ **Universal Design**: Dyslexia fonts, color blindness modes, ADHD-friendly pacing
- 📊 **Teacher Analytics**: Track student progress and comprehension

## Quick Start

### Prerequisites
```bash
node --version   # v18+
python --version # 3.9+
docker --version
```

### Installation
```bash
# 1. Clone repository
git clone https://github.com/yourusername/included-literature.git
cd included-literature

# 2. Start databases
docker-compose up -d

# 3. Setup backend
cd backend
npm install
cp .env.example .env
npm run migrate
npm run dev

# 4. Setup AI service
cd ../ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py

# 5. Setup frontend
cd ../frontend
npm install
npm run dev
```

### Access
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- AI Service: http://localhost:8080

## Technology Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + PostgreSQL
- **AI Service**: Python + FastAPI + OpenAI/Claude API
- **TTS**: Google Cloud Text-to-Speech / Azure Speech
- **PDF Processing**: pdf-parse + PyMuPDF

## Demo Credentials
- Teacher: teacher@included.rw / Teacher123!
- Student: student@included.rw / Student123!

## Documentation
See `/docs` folder for detailed API specs and architecture diagrams.

## Video Demo
(https://drive.google.com/drive/folders/1skoF77F_0xYspc3UJa4LZCbRtg94HGDn)
