import os
from anthropic import Anthropic
from openai import OpenAI
import json

class QuestionGenerator:
    def __init__(self):
        self.anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        self.openai_key = os.getenv('OPENAI_API_KEY')
        
        if self.anthropic_key:
            self.client = Anthropic(api_key=self.anthropic_key)
            self.provider = 'anthropic'
        elif self.openai_key:
            self.client = OpenAI(api_key=self.openai_key)
            self.provider = 'openai'
        else:
            self.provider = 'fallback'
    
    async def generate(self, content: str, count: int = 10) -> list:
        """
        Generate comprehension questions from literature
        """
        if self.provider == 'fallback':
            return self._generate_fallback_questions(content, count)
        
        prompt = f"""Generate {count} multiple-choice comprehension questions for this literature excerpt.

Content:
{content[:2000]}

Generate questions that test:
- Character understanding
- Plot comprehension
- Theme identification
- Literary devices
- Inference skills

For EACH question, provide:
1. A clear question
2. Four options (A, B, C, D)
3. The correct answer (0-3 index)
4. A brief explanation

Return as JSON array:
[
  {{
    "question": "What is the main theme?",
    "options": ["Love", "Revenge", "Honor", "Fate"],
    "correctAnswer": 0,
    "explanation": "The passage emphasizes love as the central theme...",
    "difficulty": "easy"
  }}
]

Return ONLY the JSON array, no other text."""

        try:
            if self.provider == 'anthropic':
                response = self.client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=4000,
                    messages=[{"role": "user", "content": prompt}]
                )
                questions_text = response.content[0].text
            
            elif self.provider == 'openai':
                response = self.client.chat.completions.create(
                    model="gpt-4-turbo-preview",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=4000,
                    response_format={"type": "json_object"}
                )
                questions_text = response.choices[0].message.content
            
            # Parse JSON
            questions_text = questions_text.strip()
            if questions_text.startswith('```'):
                questions_text = questions_text.split('```')[1]
                if questions_text.startswith('json'):
                    questions_text = questions_text[4:]
            
            questions = json.loads(questions_text)
            
            if isinstance(questions, dict) and 'questions' in questions:
                questions = questions['questions']
            
            return questions[:count]
        
        except Exception as e:
            print(f"Question generation error: {e}")
            return self._generate_fallback_questions(content, count)
    
    def _generate_fallback_questions(self, content: str, count: int) -> list:
        """Generate basic questions without AI"""
        # Extract first sentence as basis
        sentences = content.split('.')[:5]
        
        questions = [
            {
                "question": "What is the main subject of this passage?",
                "options": [
                    "Character development",
                    "Plot summary",
                    "Setting description",
                    "Theme exploration"
                ],
                "correctAnswer": 0,
                "explanation": "The passage focuses on character development.",
                "difficulty": "easy"
            },
            {
                "question": "What literary device is most prominent?",
                "options": [
                    "Metaphor",
                    "Simile",
                    "Personification",
                    "Alliteration"
                ],
                "correctAnswer": 0,
                "explanation": "The text uses metaphorical language throughout.",
                "difficulty": "medium"
            }
        ]
        
        return questions[:count]