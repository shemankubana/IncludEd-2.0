import google.generativeai as genai
import json
import os
import re
import time
from typing import Dict, Any, Optional
from services.hf_inference_service import HFInferenceService


class GeminiService:
    """
    Cloud-based LLM service using Google Gemini Pro.
    Automatically falls back to HuggingFace if Gemini hits rate limits (429).
    Includes a circuit breaker to avoid spamming Gemini after quota is exceeded.
    """

    # How long to pause Gemini after a 429 before retrying (seconds)
    CIRCUIT_BREAKER_DURATION = 3600  # 1 hour

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.model_name = "gemini-2.5-flash"
        self._is_active = False
        self._rate_limited_until: float = 0.0  # epoch timestamp

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

        self.hf_service = HFInferenceService()
        if self.hf_service.api_token:
            print(f"✨ Hugging Face fallback enabled ({self.hf_service.models['structural_analysis']}).")
        else:
            print("⚠️ No HF_API_TOKEN found. Fallback disabled.")

    def _gemini_available(self) -> bool:
        """Returns True only if Gemini is active and not in circuit-breaker cooldown."""
        if not self._is_active:
            return False
        if time.time() < self._rate_limited_until:
            return False
        return True

    def _handle_rate_limit(self, error: Exception, retry_seconds: int = None) -> None:
        """Activate circuit breaker on 429. Uses retry_delay from error if available."""
        duration = retry_seconds if retry_seconds else self.CIRCUIT_BREAKER_DURATION
        self._rate_limited_until = time.time() + duration
        remaining = int(self._rate_limited_until - time.time())
        print(f"🔴 Gemini rate limit hit. Circuit breaker active for {remaining}s. Using HF fallback.")

    def is_available(self) -> bool:
        """Checks if Gemini or the HF fallback is available."""
        return self._is_active or bool(self.hf_service.api_token)

    def _hf_fallback(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        """Helper to call Hugging Face when Gemini fails."""
        if not self.hf_service.api_token:
            raise Exception("No HF_API_TOKEN available for fallback.")
            
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = self.hf_service.client.chat_completion(
                messages=messages,
                model=self.hf_service.models["structural_analysis"],
                max_tokens=2048,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"Hugging Face fallback failed: {e}")

    def generate(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        """Standard text generation with HF fallback."""
        text = ""

        if self._gemini_available():
            full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
            try:
                response = self.model.generate_content(full_prompt)
                return response.text
            except Exception as e:
                error_str = str(e)
                if "429" in error_str or "quota" in error_str.lower():
                    self._handle_rate_limit(e)
                else:
                    print(f"⚠️ Gemini error ({e}). Attempting Hugging Face fallback...")

        try:
            return self._hf_fallback(prompt, system_instruction)
        except Exception as fallback_e:
            print(f"❌ All LLM providers failed: {fallback_e}")
            return ""

    def generate_json(self, prompt: str, system_instruction: Optional[str] = None) -> Dict[str, Any]:
        """Structured JSON generation with HF fallback."""
        text = ""

        if self._gemini_available():
            json_prompt = f"{prompt}\n\nRespond ONLY with a valid JSON object."
            full_prompt = f"{system_instruction}\n\n{json_prompt}" if system_instruction else json_prompt
            try:
                response = self.model.generate_content(full_prompt)
                text = response.text
            except Exception as e:
                error_str = str(e)
                if "429" in error_str or "quota" in error_str.lower():
                    self._handle_rate_limit(e)
                else:
                    print(f"⚠️ Gemini JSON error ({e}). Attempting Hugging Face fallback...")

        if not text:
            try:
                text = self._hf_fallback(prompt, system_instruction)
            except Exception as hf_e:
                print(f"❌ All LLM JSON fallbacks failed: {hf_e}")
                return {}
                
        # Clean possible markdown formatting from whichever provider succeeded
        try:
            # Remove everything except the JSON body (handles both { } and [ ])
            # Look for the first { or [ and the last } or ]
            json_match = re.search(r'([\{\[].*[\}\]])', text.strip(), flags=re.DOTALL)
            if json_match:
                clean_json = json_match.group(1)
                return json.loads(clean_json)
            
            # Fallback for plain JSON without markdown wrappers
            return json.loads(text.strip())
        except Exception as parse_e:
            print(f"❌ JSON parsing failed: {parse_e}\nResponse text was: {text[:500]}...")
            return {}
