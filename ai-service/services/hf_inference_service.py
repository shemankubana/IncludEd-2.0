import requests
import os
import json
import time
from typing import Dict, Any, List, Tuple, Optional
from huggingface_hub import InferenceClient
from .xai_service import XAIService

class HFInferenceService:
    """
    Client for Hugging Face Inference API using official InferenceClient.
    Offloads heavy ML models (Mistral, Llama, BERT) to HF infrastructure.
    """
    
    def __init__(self, api_token: Optional[str] = None):
        self.api_token = api_token or os.environ.get("HF_API_TOKEN")
        self.client = InferenceClient(token=self.api_token)
        
        # Default models for each task — Qwen 72B is the primary high-quality fallback
        self.models = {
            "structural_analysis": "Qwen/Qwen2.5-72B-Instruct",
            "quiz_generation": "Qwen/Qwen2.5-72B-Instruct",
            "character_ner": "dbmdz/bert-large-cased-finetuned-conll03-english",
            "character_qa": "deepset/deberta-v3-base-squad2",
            "teacher_insight": "Qwen/Qwen2.5-72B-Instruct" # Primary choice
        }
        
        self.xai = XAIService()

    def _query(self, model_id: str, payload: Dict[str, Any], wait_for_model: bool = True) -> Any:
        """Fallback low-level request handler if specific client methods don't fit."""
        try:
            # Use the official client's request method
            response = self.client.post(json=payload, model=model_id)
            return json.loads(response.decode("utf-8"))
        except Exception as e:
            print(f"❌ HF Client Request failed: {e}")
            return None

    def is_heading(self, text: str) -> bool:
        """Use an LLM to classify if a line is a chapter heading."""
        if not self.api_token: return False
        
        prompt = f"Is the following text a chapter or section heading? Answer ONLY YES or NO.\nText: {text}\nAnswer:"
        try:
            # Using chat_completion as required by some providers for this model
            response = self.client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=self.models["structural_analysis"],
                max_tokens=5,
            )
            answer = response.choices[0].message.content.strip().upper()
            return "YES" in answer
        except Exception as e:
            print(f"❌ Heading detection failed: {e}")
            return False

        print(f"DEBUG: HFInference - Generating {num_questions} quiz questions")
        prompt = f"Based on this text, generate {num_questions} multiple-choice comprehension questions for children. Respond ONLY with a valid JSON list of objects, each containing 'question' (string), 'options' (list of 4 strings), 'correctAnswer' (index 0-3), and 'explanation' (string).\n\nTEXT: {context[:1500]}"
        try:
            start_time = time.time()
            response = self.client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=self.models["quiz_generation"],
                max_tokens=1000,
            )
            print(f"DEBUG: HFInference - Request took {time.time() - start_time:.2f}s")
            text = response.choices[0].message.content.strip()
            # Basic JSON extraction if there's markdown fluff
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "[" in text and "]" in text:
                text = text[text.find("["):text.rfind("]")+1]
            result = json.loads(text)
            print(f"DEBUG: HFInference - Successfully parsed {len(result)} questions")
            return result
        except Exception as e:
            print(f"❌ Quiz generation failed: {e}")
            return []

    def simplify_text(
        self,
        text: str,
        book_title: str,
        author: str,
        doc_type: str,
        chapter_context: str,
        speaker: str,
        reading_level: str,
        language: str,
    ) -> Dict[str, Any]:
        """Use an LLM to simplify text for children."""
        if not self.api_token: return {}

        prompt = f"You are a teacher. Simplify this text from '{book_title}' for a {reading_level} reader. Respond ONLY with JSON with these keys: 'simple_version' (2 sentences), 'author_intent' (the message), 'vocabulary' (list of {{'word', 'meaning', 'analogy'}} objects).\n\nTEXT: {text}"
        try:
            response = self.client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=self.models["structural_analysis"], # Reuse Mistral/Llama
                max_tokens=800,
            )
            text = response.choices[0].message.content.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "{" in text and "}" in text:
                text = text[text.find("{"):text.rfind("}")+1]
            return json.loads(text)
        except Exception as e:
            print(f"❌ Simplification failed: {e}")
            return {}

    def extract_characters(self, text: str) -> List[str]:
        """Use NER to extract person entities."""
        if not self.api_token: return []
        
        try:
            result = self.client.token_classification(
                text,
                model=self.models["character_ner"]
            )
            names = set()
            if result and isinstance(result, list):
                for ent in result:
                    word = ent.get("word", "").strip()
                    if ent.get("entity_group") == "PER":
                        if word and not word.startswith("##"):
                            names.add(word)
            return sorted(list(names))
        except Exception as e:
            print(f"❌ Character extraction failed: {e}")
            return []

    def answer_question(self, question: str, context: str) -> Dict[str, Any]:
        """Use an extractive QA model to answer questions about the text."""
        if not self.api_token: return {}
        
        try:
            result = self.client.question_answering(
                question=question,
                context=context,
                model=self.models["character_qa"]
            )
            return {
                "answer": result.answer,
                "score": result.score,
                "start": result.start,
                "end": result.end
            }
        except Exception as e:
            print(f"❌ QA failed: {e}")
            return {}
    def generate_pedagogical_insight(
        self,
        student_name: str,
        rl_history: List[Dict[str, Any]],
        context: Optional[str] = None
    ) -> Optional[str]:
        """
        Generates a teacher-facing insight based on RL history.
        Uses HF Cloud (Qwen) with a fallback to xAI (Grok).
        """
        if not self.api_token and not self.xai.is_available():
            return None

        # Format RL History for the prompt
        history_summary = "\n".join([
            f"- Action: {h['action']}, Reasoning: {h['reason']}"
            for h in rl_history[-10:] if 'action' in h and 'reason' in h
        ])

        prompt = (
            f"As a pedagogical expert, analyze the recent reading session for {student_name}.\n"
            f"The AI reading assistant took the following actions based on the student's telemetry:\n"
            f"{history_summary}\n\n"
            f"Write a 2-3 sentence insight for the teacher. Focus on *why* the student is "
            f"struggling and what teaching strategy to use next (e.g. phonics, 1-on-1, "
            f"pre-teaching vocabulary). Keep it actionable and warm. "
            f"Do not use markdown formatting."
        )

        # ── Attempt 1: Hugging Face (Cloud) ─────────────────────────
        if self.api_token:
            try:
                print(f"📡 Requesting Teacher Insight from HF Cloud ({self.models['teacher_insight']})...")
                response = self.client.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.models["teacher_insight"],
                    max_tokens=250,
                )
                result = response.choices[0].message.content.strip()
                if result and len(result) > 20:
                    return result
            except Exception as e:
                print(f"⚠️ HF Insight generation failed: {e}. Falling back...")

        # ── Attempt 2: xAI (Grok) Fallback ──────────────────────────
        if self.xai.is_available():
            print(f"📡 Falling back to xAI (Grok) for Teacher Insight...")
            return self.xai.generate_insight(prompt)

        return None
