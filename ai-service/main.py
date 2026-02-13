from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

# FIXED IMPORTS - use the free versions
from services.question_generator import FreeQuestionGenerator
from services.accessibility_adapter import FreeAccessibilityAdapter

load_dotenv()

app = FastAPI(title="IncludEd AI Service (FREE)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize FREE services
question_gen = FreeQuestionGenerator()
accessibility_adapter = FreeAccessibilityAdapter()

class TextAdaptRequest(BaseModel):
    text: str
    target_level: Optional[str] = "accessible"
    disability_profile: Optional[dict] = None  # NEW

class QuestionGenRequest(BaseModel):
    content: str
    count: int = 10

@app.get("/")
async def root():
    return {
        "service": "IncludEd AI Service (FREE)",
        "status": "healthy",
        "ai_provider": "spaCy + NLTK (100% FREE)",
        "cost": "$0.00",
        "endpoints": ["/adapt-text", "/generate-questions"]
    }

@app.post("/adapt-text")
async def adapt_text(request: TextAdaptRequest):
    """
    Adapt literary text using FREE local models
    - Uses rule-based simplification + spaCy
    - No API costs
    - Runs offline
    """
    try:
        print(f"📝 Adapting {len(request.text)} characters...")
        
        # Limit text to prevent slowdown
        text_chunk = request.text[:5000]
        
        # Adapt with disability profile
        adapted = accessibility_adapter.adapt_text(
            text_chunk,
            request.target_level or "accessible",
            disability_profile=request.disability_profile
        )
        
        print(f"✅ Adaptation complete: {len(adapted)} characters")
        
        return {"adaptedText": adapted}
    
    except Exception as e:
        print(f"❌ Error: {e}")
        # Fallback: return original
        return {"adaptedText": request.text[:5000]}

@app.post("/generate-questions")
async def generate_questions(request: QuestionGenRequest):
    """
    Generate questions using FREE NLP methods
    - spaCy Named Entity Recognition
    - Rule-based templates
    - No AI API costs
    """
    try:
        print(f"❓ Generating {request.count} questions...")
        
        # Limit content to prevent slowdown
        content_chunk = request.content[:3000]
        
        # Generate questions
        questions = question_gen.generate(content_chunk, request.count)
        
        print(f"✅ Generated {len(questions)} questions")
        
        return {"questions": questions}
    
    except Exception as e:
        print(f"❌ Error: {e}")
        # Fallback
        return {
            "questions": question_gen.generate_fallback(request.content[:1000], request.count)
        }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting FREE AI Service on http://localhost:8080")
    print("💰 Cost: $0.00 (No API keys needed!)")
    uvicorn.run(app, host="0.0.0.0", port=8080)  # FIXED PORT