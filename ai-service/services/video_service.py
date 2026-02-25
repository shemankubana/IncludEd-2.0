import whisper
import os
import tempfile
from typing import Dict, Any

class VideoService:
    """
    Service for transcribing video/audio files and generating captions in WebVTT format.
    Uses OpenAI Whisper for local transcription.
    """
    
    def __init__(self, model_size: str = "base"):
        # Load model only on first use to save memory at startup
        self.model = None
        self.model_size = model_size

    def _load_model(self):
        if self.model is None:
            print(f"Loading Whisper model ({self.model_size})...")
            self.model = whisper.load_model(self.model_size)

    def transcribe_to_vtt(self, file_path: str) -> str:
        """
        Transcribes an audio/video file and returns content in WebVTT format.
        """
        self._load_model()
        
        result = self.model.transcribe(file_path, verbose=False)
        
        vtt_output = ["WEBVTT\n"]
        
        for segment in result["segments"]:
            start = self._format_timestamp(segment["start"])
            end = self._format_timestamp(segment["end"])
            text = segment["text"].strip()
            
            vtt_output.append(f"{start} --> {end}\n{text}\n")
            
        return "\n".join(vtt_output)

    def _format_timestamp(self, seconds: float) -> str:
        """Converts seconds to HH:MM:SS.mmm format for WebVTT."""
        m_secs = int((seconds - int(seconds)) * 1000)
        secs = int(seconds) % 60
        mins = int(seconds // 60) % 60
        hours = int(seconds // 3600)
        
        return f"{hours:02d}:{mins:02d}:{secs:02d}.{m_secs:03d}"

# For quick testing
if __name__ == "__main__":
    service = VideoService()
    # service.transcribe_to_vtt("path/to/video.mp4")
