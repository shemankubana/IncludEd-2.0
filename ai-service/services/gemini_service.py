import google.generativeai as genai
import json
import os
import re
from typing import Dict, Any, Optional

class GeminiService:
    """
    Cloud-based LLM service using Google Gemini Pro.
    Provides high-performance simplification, analysis, and generation.
    """
    
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.model_name = "gemini-pro"
        self._is_active = False
        
        if self.api_key and self.api_key != "your_gemini_api_key_here":
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel(self.model_name)
                self._is_active = True
                print(f"✨ GeminiService initialized with model: {self.model_name}")
            except Exception as e:
                print(f"❌ GeminiService failed to initialize: {e}")
        else:
            print("⚠️ GeminiService: No valid GEMINI_API_KEY found. Cloud features disabled.")

    def is_available(self) -> bool:
        """Checks if the service is configured and reachable."""
        return self._is_active

    def generate(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        """Standard text generation."""
        if not self._is_active:
            return ""
            
        try:
            full_prompt = prompt
            if system_instruction:
                full_prompt = f"{system_instruction}\n\n{prompt}"
                
            response = self.model.generate_content(full_prompt)
            return response.text
        except Exception as e:
            print(f"❌ Gemini generation failed: {e}")
            return ""

    def generate_json(self, prompt: str, system_instruction: Optional[str] = None) -> Dict[str, Any]:
        """Structured JSON generation with robust parsing."""
        if not self._is_active:
            return {}
            
        try:
            # Append JSON instruction to ensure structured output
            json_prompt = f"{prompt}\n\nRespond ONLY with a valid JSON object."
            if system_instruction:
                json_prompt = f"{system_instruction}\n\n{json_prompt}"
                
            response = self.model.generate_content(json_prompt)
            text = response.text
            
            # Clean possible markdown formatting
            text = re.sub(r'```json\s*|\s*```', '', text).strip()
            
            # Find the first { and last } to handle any conversational noise
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end != -1:
                text = text[start:end+1]
                
            return json.loads(text)
        except Exception as e:
            print(f"❌ Gemini JSON request failed: {e}\nResponse text was: {getattr(response, 'text', 'N/A')}")
            return {}
