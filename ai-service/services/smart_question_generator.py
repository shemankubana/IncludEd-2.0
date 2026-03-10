from typing import List, Dict, Any, Optional
from .gemini_service import GeminiService

class SmartQuestionGenerator:
    """
    Advanced question generator that uses Gemini for cloud-based LLM generation.
    Falls back to empty list if Gemini is unavailable (PedagogicalQuestionGenerator
    provides FLAN-T5 and template fallbacks).
    """

    def __init__(self):
        self.gemini = GeminiService()

    def generate(self, content: str, count: int = 5, reading_level: str = "intermediate") -> List[Dict[str, Any]]:
        """
        Generates content-aware multiple choice questions using Gemini.
        """
        count = max(1, min(count, 10))

        level_desc = {
            "beginner": "Primary 4 (9 years old)",
            "intermediate": "Primary 5 (10 years old)",
            "advanced": "Primary 6 (11-12 years old)",
        }.get(reading_level, "Primary 5 student")

        system_prompt = (
            f"You are an expert primary school teacher specializing in literacy for students aged 9-12 ({level_desc}). "
            "Create precise, accurate multiple-choice questions based ONLY on the provided text. "
            "Focus on comprehension, plot, and character motives. "
            "Return a JSON object with a 'questions' key containing a list of questions."
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

        # Primary: Gemini
        if self.gemini.is_available():
            try:
                result = self.gemini.generate_json(prompt, system_prompt)
                questions = result.get("questions", [])
                if questions:
                    return questions[:count]
            except Exception as e:
                print(f"⚠️  Smart generation Gemini failed: {e}")

        return []
