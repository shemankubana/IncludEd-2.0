from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
from services.text_processor import TextProcessor
from services.question_generator import QuestionGenerator
from services.accessibility_adapter import AccessibilityAdapter

load_dotenv()

app = FastAPI(title="IncludEd AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

text_processor = TextProcessor()
question_gen = QuestionGenerator()
accessibility_adapter = AccessibilityAdapter()

class TextAdaptRequest(BaseModel):
    text: str
    target_level: Optional[str] = "accessible"

class QuestionGenRequest(BaseModel):
    content: str
    count: int = 10

class Question(BaseModel):
    question: str
    options: List[str]
    correctAnswer: int
    explanation: str
    difficulty: str

@app.get("/")
async def root():
    return {
        "service": "IncludEd AI Service",
        "status": "healthy",
        "endpoints": ["/adapt-text", "/generate-questions"]
    }

@app.post("/adapt-text")
async def adapt_text(request: TextAdaptRequest):
    """
    Adapt literary text for students with learning differences
    - Simplifies complex sentence structures
    - Breaks long paragraphs
    - Maintains literary meaning
    - Adds dyslexia-friendly formatting hints
    """
    try:
        adapted = await accessibility_adapter.adapt_text(
            request.text,
            request.target_level
        )
        return {"adaptedText": adapted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-questions")
async def generate_questions(request: QuestionGenRequest):
    """
    Generate comprehension questions from literature content
    - Multiple choice questions
    - Various difficulty levels
    - Explanations for answers
    """
    try:
        questions = await question_gen.generate(
            request.content,
            request.count
        )
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)