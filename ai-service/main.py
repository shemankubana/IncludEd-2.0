from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
from services.text_processor import TextProcessor
from services.question_generator import FreeQuestionGenerator
from services.accessibility_adapter import FreeAccessibilityAdapter
from services.ollama_client import OllamaClient

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
text_processor = TextProcessor()
question_gen = FreeQuestionGenerator()
accessibility_adapter = FreeAccessibilityAdapter()
ollama_client = OllamaClient()  # Optional: for better quality if Ollama installed

class TextAdaptRequest(BaseModel):
    text: str
    target_level: Optional[str] = "accessible"

class QuestionGenRequest(BaseModel):
    content: str
    count: int = 10

@app.get("/")
async def root():
    return {
        "service": "IncludEd AI Service (FREE)",
        "status": "healthy",
        "ai_provider": "Local transformers + spaCy + NLTK",
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
        # Try Ollama first (if installed), fallback to rule-based
        if ollama_client.is_available():
            adapted = await ollama_client.adapt_text(request.text)
        else:
            adapted = accessibility_adapter.adapt_text(request.text, request.target_level or "accessible")
        
        return {"adaptedText": adapted}
    except Exception as e:
        print(f"Error: {e}")
        # Always fallback to rule-based
        adapted = accessibility_adapter.adapt_text(request.text, request.target_level or "accessible")
        return {"adaptedText": adapted}

@app.post("/generate-questions")
async def generate_questions(request: QuestionGenRequest):
    """
    Generate questions using FREE methods:
    1. Ollama (if available)
    2. Hugging Face T5 model
    3. Rule-based extraction
    """
    try:
        # Try Ollama first
        if ollama_client.is_available():
            questions = await ollama_client.generate_questions(request.content, request.count)
        else:
            # Use FREE question generation
            questions = question_gen.generate(request.content, request.count)
        
        return {"questions": questions}
    except Exception as e:
        print(f"Error: {e}")
        # Fallback to rule-based
        questions = question_gen.generate_fallback(request.content, request.count)
        return {"questions": questions}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)