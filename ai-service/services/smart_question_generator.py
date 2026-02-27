from typing import List, Dict, Any
from .ollama_service import OllamaService

class SmartQuestionGenerator:
    """
    Advanced question generator that uses local LLMs via Ollama.
    Enforces Ollama usage as per user requirement.
    """
    
    def __init__(self):
        self.ollama = OllamaService()
        
    def generate(self, content: str, count: int = 5) -> List[Dict[str, Any]]:
        """
        Generates content-aware multiple choice questions using Ollama.
        """
        if not self.ollama.is_available():
            raise Exception("❌ Ollama not available. Question generation aborted (fallback disabled).")
            
        system_prompt = (
            "You are an expert educator. Create precise, accurate multiple-choice questions "
            "based ONLY on the provided text. Return a JSON object with a 'questions' key "
            "containing a list of questions."
        )
        
        prompt = f"""
        Create {count} multiple-choice questions about the following text.
        Each question must have:
        1. 'question': The question text
        2. 'options': An array of 4 possible answers
        3. 'correctAnswer': The 0-based index of the correct answer
        4. 'explanation': A brief explanation of why it's correct
        5. 'difficulty': 'easy', 'medium', or 'hard'

        TEXT CONTENT:
        {content[:4000]}
        """
        
        try:
            result = self.ollama.generate_json(prompt, system_prompt)
            questions = result.get("questions", [])
            
            if not questions:
                raise Exception("Ollama returned no questions.")
                
            return questions[:count]
        except Exception as e:
            print(f"❌ Smart generation failed: {e}")
            raise e
