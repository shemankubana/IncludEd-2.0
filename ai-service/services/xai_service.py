import os
import json
import requests
from typing import Dict, Any, List, Optional

class XAIService:
    """
    Client for xAI (Grok) API.
    Provides a fallback for pedagogical reasoning when HF or Gemini are unavailable.
    """
    
    def __init__(self, api_token: Optional[str] = None):
        self.api_token = api_token or os.environ.get("XAI_API_TOKEN")
        self.base_url = "https://api.x.ai/v1"
        self.model = "grok-beta" # Default model

    def is_available(self) -> bool:
        return bool(self.api_token)

    def generate_insight(self, prompt: str) -> Optional[str]:
        """Generate a pedagogical insight using Grok."""
        if not self.is_available():
            return None

        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert pedagogical assistant for primary school teachers. Your goal is to translate technical reading telemetry into actionable classroom insights."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "model": self.model,
            "stream": False,
            "temperature": 0.7
        }

        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"❌ xAI (Grok) Request failed: {e}")
            return None
