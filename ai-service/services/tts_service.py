"""
tts_service.py
==============
TTS Service for IncludEd 2.0 — edge-tts with word-level timestamps.

Features
--------
  • Word-boundary timestamps (100 ns → ms) for live word highlighting in Reader
  • Disability-aware voice selection:
      - dyslexia  → slow, clear, high-quality UK voice
      - adhd      → slightly faster, engaging voice
      - default   → Kenya-accented English (closest to Rwandan learners)
  • Long-text chunking: splits at sentence boundaries so edge-tts never
    times out on full chapters; timestamps are offset-adjusted across chunks
  • Rate control: +0% default, -15% for dyslexia, adjustable per student
  • Returns base64 audio + merged timestamp list

Response schema
---------------
  {
    "audio_base64": str,              # MP3, base64-encoded
    "format":       "mp3",
    "voice":        str,              # voice name used
    "rate":         str,              # speaking rate applied
    "duration_ms":  float,            # total audio duration in ms
    "word_count":   int,
    "timestamps": [
      { "word": str, "start_ms": float, "end_ms": float }
    ]
  }
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import tempfile
from typing import Any, Dict, List, Optional, Tuple

import edge_tts


# ── Voice profiles ─────────────────────────────────────────────────────────────

VOICE_PROFILES: Dict[str, Dict[str, str]] = {
    "dyslexia": {
        "voice": "en-GB-SoniaNeural",   # Clear, measured British RP
        "rate":  "-15%",                # Slower to support decoding
        "label": "Sonia — Slow & Clear (UK)",
    },
    "adhd": {
        "voice": "en-US-JennyNeural",   # Friendly, engaging American
        "rate":  "+5%",                 # Slightly faster to hold attention
        "label": "Jenny — Engaging (US)",
    },
    "both": {
        "voice": "en-GB-SoniaNeural",
        "rate":  "-10%",
        "label": "Sonia — Clear (UK)",
    },
    "none": {
        "voice": "en-KE-AsminaNeural",  # East African accent (Rwanda-adjacent)
        "rate":  "+0%",
        "label": "Asmina — Natural (KE)",
    },
    "french": {
        "voice": "fr-FR-DeniseNeural",
        "rate":  "+0%",
        "label": "Denise — Français (FR)",
    },
    "slow": {
        "voice": "en-GB-SoniaNeural",
        "rate":  "-25%",
        "label": "Sonia — Very Slow",
    },
}

# Max chars per TTS chunk (edge-tts handles ~3000 chars comfortably)
_MAX_CHUNK_CHARS = 2500

# 100-nanosecond → millisecond
_100NS_TO_MS = 1e-4


# ── Text chunker ──────────────────────────────────────────────────────────────

def _split_into_chunks(text: str, max_chars: int = _MAX_CHUNK_CHARS) -> List[str]:
    """
    Split text at sentence boundaries so each chunk ≤ max_chars.
    Ensures TTS produces natural prosody (not mid-sentence cuts).
    """
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks: List[str] = []
    current = ""

    for sent in sentences:
        if len(sent) > max_chars:
            # Hard-split overly long sentences at clause boundaries
            parts = re.split(r"(?<=[,;])\s+", sent)
            for part in parts:
                if len(current) + len(part) + 1 <= max_chars:
                    current = (current + " " + part).strip()
                else:
                    if current:
                        chunks.append(current)
                    current = part[:max_chars]
        elif len(current) + len(sent) + 1 <= max_chars:
            current = (current + " " + sent).strip()
        else:
            if current:
                chunks.append(current)
            current = sent

    if current:
        chunks.append(current)

    return chunks or [text[:max_chars]]


# ── Single-chunk synthesizer ──────────────────────────────────────────────────

async def _synthesize_chunk(
    text: str,
    voice: str,
    rate: str,
    time_offset_ms: float,
) -> Tuple[bytes, List[Dict[str, Any]], float]:
    """
    Synthesize one text chunk.

    edge-tts 7.x emits SentenceBoundary events (not WordBoundary).
    We collect sentence durations and distribute them evenly across
    the words in each sentence to produce word-level timestamps.

    Returns
    -------
    (audio_bytes, timestamps_with_offset, chunk_duration_ms)
    """
    communicate   = edge_tts.Communicate(text, voice, rate=rate)
    audio_parts:  List[bytes] = []
    # Collect sentence boundary events: (offset_ms, duration_ms, sentence_text)
    sentence_events: List[Tuple[float, float, str]] = []

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_parts.append(chunk["data"])
        elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
            start_ms = chunk["offset"]   * _100NS_TO_MS
            dur_ms   = chunk["duration"] * _100NS_TO_MS
            sent_text = chunk.get("text", "").strip()
            if sent_ms := dur_ms:
                sentence_events.append((start_ms, sent_ms, sent_text))

    # Build word-level timestamps by splitting each sentence evenly
    timestamps:  List[Dict[str, Any]] = []
    last_end_ms: float = 0.0

    for (sent_start, sent_dur, sent_text) in sentence_events:
        words = [w for w in re.split(r"\s+", sent_text) if w]
        if not words:
            continue
        ms_per_word = sent_dur / len(words)
        for i, word in enumerate(words):
            w_start = time_offset_ms + sent_start + i * ms_per_word
            w_end   = w_start + ms_per_word
            timestamps.append({
                "word":     word.strip(".,!?;:\"'"),
                "start_ms": round(w_start, 1),
                "end_ms":   round(w_end,   1),
            })
            last_end_ms = max(last_end_ms, w_end - time_offset_ms)

    # Fallback: if no boundary events, estimate from text length (~150 wpm)
    if not timestamps and text.strip():
        words = [w for w in re.split(r"\s+", text) if w]
        ms_per_word = 400.0   # ~150 wpm
        for i, word in enumerate(words):
            w_start = time_offset_ms + i * ms_per_word
            w_end   = w_start + ms_per_word
            timestamps.append({
                "word":     word.strip(".,!?;:\"'"),
                "start_ms": round(w_start, 1),
                "end_ms":   round(w_end,   1),
            })
        last_end_ms = len(words) * ms_per_word

    return b"".join(audio_parts), timestamps, last_end_ms


# ── Public service class ──────────────────────────────────────────────────────

class TTSService:
    """
    Generate MP3 audio + word-level timestamps for synchronized highlighting.

    Usage
    -----
        svc = TTSService()
        result = await svc.synthesize(
            text="Romeo, Romeo, wherefore art thou Romeo?",
            disability_type="dyslexia",
        )
        # result["timestamps"] → [{"word":"Romeo","start_ms":0,"end_ms":420}, …]
    """

    def __init__(self, output_dir: str = "temp_audio"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def get_voice_profile(
        self,
        disability_type: str = "none",
        language: str = "english",
        voice_override: Optional[str] = None,
        rate_override: Optional[str] = None,
    ) -> Dict[str, str]:
        """Select a voice + rate based on disability type and language."""
        if voice_override:
            return {"voice": voice_override, "rate": rate_override or "+0%", "label": "Custom"}
        if language == "french":
            profile = dict(VOICE_PROFILES["french"])
        elif disability_type in VOICE_PROFILES:
            profile = dict(VOICE_PROFILES[disability_type])
        else:
            profile = dict(VOICE_PROFILES["none"])
        if rate_override:
            profile["rate"] = rate_override
        return profile

    async def synthesize(
        self,
        text: str,
        disability_type: str = "none",
        language: str = "english",
        voice_override: Optional[str] = None,
        rate_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Synthesize any-length text and return audio + timestamps.

        Long passages are chunked at sentence boundaries; timestamps are
        offset-adjusted so they represent absolute positions in the full audio.

        Returns the response schema described in the module docstring.
        """
        profile = self.get_voice_profile(disability_type, language, voice_override, rate_override)
        voice   = profile["voice"]
        rate    = profile["rate"]

        chunks = _split_into_chunks(text)
        all_audio:      List[bytes]          = []
        all_timestamps: List[Dict[str, Any]] = []
        cursor_ms: float = 0.0

        for chunk_text in chunks:
            audio_bytes, stamps, chunk_dur = await _synthesize_chunk(
                chunk_text, voice, rate, time_offset_ms=cursor_ms
            )
            all_audio.append(audio_bytes)
            all_timestamps.extend(stamps)
            cursor_ms += chunk_dur + 300.0   # 300ms natural pause between chunks

        merged_audio = b"".join(all_audio)
        duration_ms  = max(cursor_ms - 300.0, 0.0)

        return {
            "audio_base64": base64.b64encode(merged_audio).decode("utf-8"),
            "format":       "mp3",
            "voice":        voice,
            "rate":         rate,
            "duration_ms":  round(duration_ms, 1),
            "word_count":   len(all_timestamps),
            "timestamps":   all_timestamps,
        }

    # ── Legacy compat (original API kept intact) ──────────────────────────────

    async def generate_with_timestamps(
        self,
        text: str,
        voice: str = "en-KE-AsminaNeural",
        rate: str = "+0%",
    ) -> Dict[str, Any]:
        """Backward-compatible wrapper (used by existing /tts/generate stub)."""
        audio_bytes, timestamps, duration = await _synthesize_chunk(text, voice, rate, 0.0)
        return {
            "audio_base64": base64.b64encode(audio_bytes).decode("utf-8"),
            "format":       "mp3",
            "voice":        voice,
            "duration_ms":  round(duration, 1),
            "word_count":   len(timestamps),
            "timestamps":   timestamps,
            "text":         text,   # legacy key
        }


# ── Module singleton ──────────────────────────────────────────────────────────

_service: Optional[TTSService] = None

def get_tts_service() -> TTSService:
    global _service
    if _service is None:
        _service = TTSService()
    return _service


# ── Quick test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    async def _test():
        svc = TTSService()
        res = await svc.synthesize(
            "Romeo, Romeo! Wherefore art thou Romeo?",
            disability_type="dyslexia",
        )
        print(f"Duration: {res['duration_ms']} ms  |  Words: {res['word_count']}")
        print(json.dumps(res["timestamps"][:5], indent=2))

    asyncio.run(_test())
