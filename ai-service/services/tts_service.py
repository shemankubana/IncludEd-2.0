import edge_tts
import json
import base64
import os
import asyncio
from typing import List, Dict, Any, Tuple

class TTSService:
    """
    Service for generating Text-to-Speech audio with word-level timestamps 
    using edge-tts. This allows for synchronized highlighting on the frontend.
    """
    
    # Default Rwanda-friendly voices (English and French/Kinyarwanda alternatives)
    VOICES = {
        "en-GB-SoniaNeural": "Sonia (UK English - Clear)",
        "en-KE-AsminaNeural": "Asmina (Kenya English - African Accent)",
        "en-US-GuyNeural": "Guy (US English - Male)",
    }

    def __init__(self, output_dir: str = "temp_audio"):
        self.output_dir = output_dir
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    async def generate_with_timestamps(
        self, 
        text: str, 
        voice: str = "en-KE-AsminaNeural", 
        rate: str = "+0%"
    ) -> Dict[str, Any]:
        """
        Generates audio and extracts word-level timestamps.
        Returns a dict with audio (base64) and timestamps.
        """
        output_file = os.path.join(self.output_dir, f"tts_{int(asyncio.get_event_loop().time())}.mp3")
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        
        timestamps = []
        
        # Submaker to capture word-level events
        submaker = edge_tts.SubMaker()
        
        try:
            with open(output_file, "wb") as f:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        # edge-tts provides offset and duration in 100ns units
                        # We convert to seconds
                        timestamps.append({
                            "word": chunk["text"],
                            "start": chunk["offset"] / 10**7,
                            "duration": chunk["duration"] / 10**7
                        })
            
            # Read audio file and encode to base64
            with open(output_file, "rb") as f:
                audio_base64 = base64.b64encode(f.read()).decode("utf-8")
            
            # Cleanup temp file
            if os.path.exists(output_file):
                os.remove(output_file)
                
            return {
                "audio_base64": audio_base64,
                "format": "mp3",
                "timestamps": timestamps,
                "voice": voice,
                "text": text
            }
            
        except Exception as e:
            if os.path.exists(output_file):
                os.remove(output_file)
            raise e

# For quick testing
if __name__ == "__main__":
    async def main():
        service = TTSService()
        result = await service.generate_with_timestamps("Hello, this is IncludEd 2.0. We are testing text to speech.")
        print(f"Generated {len(result['timestamps'])} word timestamps.")
        print(json.dumps(result['timestamps'][:3], indent=2))
        
    asyncio.run(main())
