import requests
import json
import re
import asyncio

class OllamaClient:
    """
    Optional: Use Ollama for better quality (FREE, runs locally)
    Install: curl https://ollama.ai/install.sh | sh
    Then: ollama pull llama2 (or llama3, mistral)
    """
    
    def __init__(self):
        self.base_url = "http://localhost:11434"
        self.model = "llama2"  # Ensure you have run: ollama pull llama2
    
    def is_available(self) -> bool:
        """Check if Ollama is installed and running"""
        try:
            # Short timeout to prevent hanging the whole app if Ollama is down
            response = requests.get(f"{self.base_url}/api/tags", timeout=2)
            return response.status_code == 200
        except:
            return False
    
    async def adapt_text(self, text: str) -> str:
        """Use Ollama to adapt text for accessibility"""
        if not self.is_available():
            print("Ollama not available, falling back to rule-based adaptation.")
            return text
        
        prompt = f"""Adapt this literary text for students with dyslexia and ADHD. 
Simplify sentences, replace archaic words, and add paragraph breaks.
Maintain the story's meaning.

Original:
{text[:2000]}

Adapted version:"""
        
        try:
            # Use run_in_executor if not using an async session to prevent blocking
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=60
            )
            
            result = response.json()
            return result.get('response', text)
        except Exception as e:
            print(f"Ollama Adaptation Error: {e}")
            return text
    
    async def generate_questions(self, content: str, count: int) -> list:
        """Generate questions using Ollama with JSON enforcement"""
        if not self.is_available():
            print("Ollama not available for question generation.")
            return []
        
        # Explicit instructions to help the LLM stay on track
        prompt = f"""Generate {count} multiple choice questions about this text.
Return ONLY a valid JSON array of objects. Do not include any conversational text.

Each object must have:
- "question": string
- "options": array of 4 strings
- "answer": integer (0-3)
- "explanation": string
- "difficulty": "easy", "medium", or "hard"

Text:
{content[:1500]}"""
        
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"  # Forces newer Ollama versions to output JSON
                },
                timeout=90
            )
            
            result = response.json()
            raw_response = result.get('response', '[]')
            
            # 1. Clean up potential markdown blocks (```json ... ```)
            clean_json = re.search(r'\[.*\]', raw_response, re.DOTALL)
            if clean_json:
                data = json.loads(clean_json.group(0))
                return data
            
            # 2. Direct parse attempt
            return json.loads(raw_response)
            
        except json.JSONDecodeError as je:
            print(f"Ollama JSON Parse Error: {je}. Raw output was: {raw_response[:100]}")
            return []
        except Exception as e:
            print(f"Ollama Question Gen Error: {e}")
            return []