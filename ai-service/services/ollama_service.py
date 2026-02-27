import requests
import json
import os
from typing import List, Dict, Any, Optional

class OllamaService:
    """
    Service for interacting with a locally running Ollama instance.
    Standardizes communication with LLMs for question generation and text analysis.
    """
    
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3"):
        self.base_url = os.environ.get("OLLAMA_URL", base_url)
        self.model = os.environ.get("OLLAMA_MODEL", model)
        print(f"🤖 OllamaService initialized with model: {self.model}")

    def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Calls Ollama and requests JSON response.
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "format": "json",
            "stream": False,
            "options": {
                "temperature": 0.2
            }
        }
        
        if system_prompt:
            payload["system"] = system_prompt
            
        try:
            response = requests.post(f"{self.base_url}/api/generate", json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()
            return json.loads(result.get("response", "{}"))
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                print(f"❌ Ollama model '{self.model}' not found. Please run 'ollama pull {self.model}'")
            else:
                print(f"❌ Ollama JSON request failed: {e}")
            return {}
        except Exception as e:
            print(f"❌ Ollama JSON request failed: {e}")
            return {}

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Calls Ollama for standard text generation.
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3
            }
        }
        
        if system_prompt:
            payload["system"] = system_prompt
            
        try:
            response = requests.post(f"{self.base_url}/api/generate", json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()
            return result.get("response", "")
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                print(f"❌ Ollama model '{self.model}' not found. Please run 'ollama pull {self.model}'")
            else:
                print(f"❌ Ollama request failed: {e}")
            return ""
        except Exception as e:
            print(f"❌ Ollama request failed: {e}")
            return ""

    def is_available(self) -> bool:
        """Checks if Ollama is running."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=2)
            return response.status_code == 200
        except:
            return False
