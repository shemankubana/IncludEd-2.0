import edge_tts
import asyncio
import os
import uuid
import base64
from typing import Optional, Dict, Any, List

class TTSService:
    """
    Service for generating high-quality neural TTS using Microsoft Edge-TTS.
    Replaces the previous basic TTS service.
    """
    
    # Default voices per language and disability
    VOICES = {
        "english": {
            "none": "en-GB-SoniaNeural",
            "dyslexia": "en-GB-RyanNeural", # Clear, male British
            "adhd": "en-US-JennyNeural"     # Energetic
        },
        "french": {
            "none": "fr-FR-DeniseNeural",
            "dyslexia": "fr-FR-HenriNeural",
            "adhd": "fr-FR-DeniseNeural"
        }
    }

    def __init__(self, output_dir: str = "temp_audio"):
        self.output_dir = output_dir
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    async def generate_audio(self, text: str, voice: Optional[str] = None, language: str = "english") -> str:
        """Generates an MP3 file and returns the path."""
        if not voice:
            lang_voices = self.VOICES.get(language, self.VOICES["english"])
            voice = lang_voices["none"]
            
        filename = f"{uuid.uuid4()}.mp3"
        filepath = os.path.join(self.output_dir, filename)
        
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(filepath)
        
        return filepath

    async def synthesize(
        self,
        text: str,
        disability_type: str = "none",
        language: str = "english",
        voice_override: Optional[str] = None,
        rate_override: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Full synthesis method as expected by main.py /tts/synthesize endpoint.
        """
        # Determine voice
        lang_voices = self.VOICES.get(language.lower(), self.VOICES["english"])
        voice = voice_override or lang_voices.get(disability_type.lower(), lang_voices["none"])
        
        # Determine rate adjustment
        # Edge-TTS rate format: "+0%", "-10%", etc.
        rate = rate_override or "+0%"
        if not rate_override and disability_type in ["dyslexia", "both"]:
            rate = "-15%" # Slower for dyslexia
            
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        
        # For now, we collect all audio in memory for base64 return
        # In a real high-scale app, we'd use streaming or signed URLs
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
                
        audio_b64 = base64.b64encode(audio_data).decode("utf-8")
        
        # Edge-TTS doesn't easily provide word timestamps in the same request as save/stream 
        # without complex sub-chunking. We'll return empty timestamps for now to avoid breaking UI.
        # But we'll estimate duration.
        word_count = len(text.split())
        estimated_duration_ms = word_count * 400 # Rough estimate: 2.5 words/sec -> 400ms/word
        
        return {
            "audio_base64": audio_b64,
            "voice": voice,
            "rate": rate,
            "word_count": word_count,
            "duration_ms": estimated_duration_ms,
            "timestamps": [], # Placeholder — if the UI needs these for highlighting, we'll need a better fix
            "format": "mp3"
        }

_tts_service = None

def get_tts_service() -> TTSService:
    global _tts_service
    if _tts_service is None:
        _tts_service = TTSService()
    return _tts_service
