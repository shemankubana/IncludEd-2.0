from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
from dotenv import load_dotenv

# Existing Imports
from services.question_generator import FreeQuestionGenerator
from services.accessibility_adapter import FreeAccessibilityAdapter
# NEW IMPORT
from services.rl_agent_service import RLAgentService

load_dotenv()

app = FastAPI(title="IncludEd AI Service (RL-Powered)")

# Middleware setup (Keep existing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
question_gen = FreeQuestionGenerator()
accessibility_adapter = FreeAccessibilityAdapter()
rl_agent = RLAgentService()  # NEW

class TextAdaptRequest(BaseModel):
    text: str
    target_level: Optional[str] = "accessible"
    disability_profile: Optional[Dict] = None

class QuestionGenRequest(BaseModel):
    content: str
    count: int = 10

@app.get("/")
async def root():
    return {
        "service": "IncludEd AI Service",
        "status": "healthy",
        "model_status": "RL Agent Loaded" if rl_agent.model else "Running rule-based fallback"
    }

@app.post("/adapt-text")
async def adapt_text(request: TextAdaptRequest):
    """
    Adapt text using Reinforcement Learning to decide the strategy
    """
    try:
        print(f"📝 Adapting {len(request.text)} characters...")
        
        # 1. Use RL Agent to decide STRATEGY
        # In a real app, we would get difficulty/focus from request. Using mocks for demo.
        action_id, action_desc = rl_agent.predict_action(
            text_difficulty=0.7, 
            student_focus=0.6,
            disability_profile=request.disability_profile
        )
        
        print(f"🤖 RL Decision: {action_desc} (Action {action_id})")
        
        # 2. Execute Strategy using existing Adapter
        text_chunk = request.text[:5000]
        
        # Map RL actions to Adapter parameters
        adapter_level = "accessible"
        if action_id == 2:
            adapter_level = "very_accessible" # Heavier simplification
        elif action_id == 0:
            return {
                "adaptedText": text_chunk, 
                "strategy": action_desc,
                "note": "AI decided original text was best."
            }

        # Perform Rule-Based Adaptation based on RL decision
        adapted = accessibility_adapter.adapt_text(
            text_chunk,
            adapter_level,
            disability_profile=request.disability_profile
        )
        
        # If RL suggested TTS/Visuals (Action 3), append a marker
        if action_id == 3:
            adapted = "[AI SUGGESTION: ENABLE TTS]\n" + adapted
        
        return {
            "adaptedText": adapted,
            "strategy": action_desc
        }
    
    except Exception as e:
        print(f"❌ Error: {e}")
        return {"adaptedText": request.text[:5000], "error": str(e)}

# ... (Keep the rest of generate-questions endpoint as is) ...
@app.post("/generate-questions")
async def generate_questions(request: QuestionGenRequest):
    # Keep existing implementation
    try:
        # Limit content to prevent slowdown
        content_chunk = request.content[:3000]
        questions = question_gen.generate(content_chunk, request.count)
        return {"questions": questions}
    except Exception as e:
        return {"questions": question_gen.generate_fallback(request.content[:1000], request.count)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)