"""
comprehension_tracker.py
========================
Literature Comprehension Graph — per-student, per-book knowledge tracking.

Tracks:
  - Characters understood (from quiz answers + highlight patterns)
  - Themes encountered and comprehended
  - Literary devices recognized
  - Vocabulary acquired (words looked up → words mastered)
  - Chapter/scene comprehension scores
  - Predicted struggle zones ahead

Architecture: JSON-based graph updated after every reading session.
"""

from __future__ import annotations

import json
import os
import re
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

# ── Theme keyword bank ────────────────────────────────────────────────────────
# Maps theme label → keywords. Themes are marked "encountered" when keywords
# appear in section text, "understood" once quiz score ≥ 0.7 on that section.

_THEME_KEYWORDS: Dict[str, List[str]] = {
    "Masculinity & Identity":   ["man", "strength", "weak", "pride", "honour", "honor", "warrior", "masculine", "wrestle", "efulefu"],
    "Colonialism & Change":     ["white", "colonial", "missionary", "church", "district", "commissioner", "civilise", "christianity", "convert"],
    "Tradition & Culture":      ["custom", "tradition", "ritual", "ceremony", "ancestor", "chi", "oracle", "egwugwu", "festival", "clan"],
    "Fate & Free Will":         ["fate", "destiny", "chi", "chosen", "inevitable", "prophecy", "foretold"],
    "Family & Loyalty":         ["father", "son", "daughter", "family", "loyalty", "betray", "clan", "kinship", "blood"],
    "Power & Authority":        ["king", "chief", "power", "rule", "law", "court", "judge", "obey", "command", "authority"],
    "Betrayal & Trust":         ["betray", "trust", "deceive", "false", "promise", "oath", "broke"],
    "Ambition & Hubris":        ["ambition", "pride", "arrogance", "downfall", "overreach", "tragic flaw"],
    "Love & Sacrifice":         ["love", "sacrifice", "devotion", "heart", "tender", "care", "grief"],
    "Justice & Revenge":        ["justice", "revenge", "punish", "crime", "guilt", "innocent", "retribution"],
    "War & Conflict":           ["war", "battle", "fight", "enemy", "blood", "sword", "kill", "conquer"],
    "Appearance & Reality":     ["mask", "disguise", "seem", "appear", "truth", "hidden", "false", "pretend"],
}


def _extract_themes(text: str) -> List[str]:
    """Return list of theme labels whose keywords appear in text."""
    text_lower = text.lower()
    found = []
    for theme, keywords in _THEME_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            found.append(theme)
    return found


@dataclass
class ChapterProgress:
    chapter_id: str = ""
    chapter_title: str = ""
    sections_total: int = 0
    sections_read: int = 0
    time_spent_s: float = 0
    quiz_score: Optional[float] = None
    comprehension_score: float = 0
    highlights_made: int = 0
    vocab_lookups: int = 0
    reading_speed_wpm: Optional[float] = None
    subjective_difficulty: Optional[int] = None  # 1-5 rating from student
    completed: bool = False


@dataclass
class ComprehensionGraph:
    """Per-student, per-book knowledge graph."""
    student_id: str = ""
    book_id: str = ""
    book_title: str = ""
    doc_type: str = "generic"

    # Characters
    characters_encountered: Dict[str, float] = field(default_factory=dict)  # name → understanding [0,1]

    # Themes
    themes_tracked: Dict[str, str] = field(default_factory=dict)  # theme → status (encountered/partial/understood)

    # Literary devices
    devices_recognized: Dict[str, int] = field(default_factory=dict)  # device → count seen

    # Vocabulary
    vocab_looked_up: List[str] = field(default_factory=list)
    vocab_mastered: List[str] = field(default_factory=list)

    # Chapter progress
    chapter_progress: List[ChapterProgress] = field(default_factory=list)

    # Highlighted passages
    highlights: List[Dict[str, Any]] = field(default_factory=list)

    # Predicted struggle zones
    struggle_predictions: List[Dict[str, Any]] = field(default_factory=list)

    # STT Reading Fluency
    stt_readings: List[Dict[str, Any]] = field(default_factory=list) # {timestamp, section_id, accuracy, wpm, feedback}

    # Timestamps
    first_session: float = 0
    last_session: float = 0
    total_time_s: float = 0
    sessions_count: int = 0


class ComprehensionTracker:
    """
    Manages comprehension graphs for students across books.

    Usage:
        tracker = ComprehensionTracker()
        graph = tracker.get_or_create("student_123", "book_456", "Things Fall Apart", "novel")
        tracker.record_section_read("student_123", "book_456", "ch1_s1", quiz_score=0.8)
        tracker.record_highlight("student_123", "book_456", "carry coals", "act1_scene1")
        tracker.record_vocab_lookup("student_123", "book_456", "persistent")
        summary = tracker.get_summary("student_123", "book_456")
    """

    def __init__(self, storage_dir: str = "data/comprehension"):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        self._cache: Dict[str, ComprehensionGraph] = {}

    def _key(self, student_id: str, book_id: str) -> str:
        return f"{student_id}_{book_id}"

    def _path(self, student_id: str, book_id: str) -> str:
        safe_key = self._key(student_id, book_id).replace("/", "_").replace("\\", "_")
        return os.path.join(self.storage_dir, f"{safe_key}.json")

    def get_or_create(
        self,
        student_id: str,
        book_id: str,
        book_title: str = "",
        doc_type: str = "generic",
    ) -> ComprehensionGraph:
        key = self._key(student_id, book_id)
        if key in self._cache:
            return self._cache[key]

        path = self._path(student_id, book_id)
        if os.path.exists(path):
            try:
                with open(path) as f:
                    data = json.load(f)
                graph = ComprehensionGraph(
                    student_id=data.get("student_id", student_id),
                    book_id=data.get("book_id", book_id),
                    book_title=data.get("book_title", book_title),
                    doc_type=data.get("doc_type", doc_type),
                    characters_encountered=data.get("characters_encountered", {}),
                    themes_tracked=data.get("themes_tracked", {}),
                    devices_recognized=data.get("devices_recognized", {}),
                    vocab_looked_up=data.get("vocab_looked_up", []),
                    vocab_mastered=data.get("vocab_mastered", []),
                    highlights=data.get("highlights", []),
                    struggle_predictions=data.get("struggle_predictions", []),
                    stt_readings=data.get("stt_readings", []),
                    first_session=data.get("first_session", 0),
                    last_session=data.get("last_session", 0),
                    total_time_s=data.get("total_time_s", 0),
                    sessions_count=data.get("sessions_count", 0),
                    # Migration: some files might not have these yet
                )
                # Reconstruct chapter progress
                for cp_data in data.get("chapter_progress", []):
                    graph.chapter_progress.append(ChapterProgress(**cp_data))
                self._cache[key] = graph
                return graph
            except Exception:
                pass

        graph = ComprehensionGraph(
            student_id=student_id,
            book_id=book_id,
            book_title=book_title,
            doc_type=doc_type,
            first_session=time.time(),
            sessions_count=1,
        )
        self._cache[key] = graph
        return graph

    def _save(self, student_id: str, book_id: str):
        key = self._key(student_id, book_id)
        graph = self._cache.get(key)
        if not graph:
            return

        data = {
            "student_id": graph.student_id,
            "book_id": graph.book_id,
            "book_title": graph.book_title,
            "doc_type": graph.doc_type,
            "characters_encountered": graph.characters_encountered,
            "themes_tracked": graph.themes_tracked,
            "devices_recognized": graph.devices_recognized,
            "vocab_looked_up": graph.vocab_looked_up,
            "vocab_mastered": graph.vocab_mastered,
            "chapter_progress": [
                {
                    "chapter_id": cp.chapter_id,
                    "chapter_title": cp.chapter_title,
                    "sections_total": cp.sections_total,
                    "sections_read": cp.sections_read,
                    "time_spent_s": cp.time_spent_s,
                    "quiz_score": cp.quiz_score,
                    "comprehension_score": cp.comprehension_score,
                    "highlights_made": cp.highlights_made,
                    "vocab_lookups": cp.vocab_lookups,
                    "reading_speed_wpm": cp.reading_speed_wpm,
                    "subjective_difficulty": cp.subjective_difficulty,
                    "completed": cp.completed,
                }
                for cp in graph.chapter_progress
            ],
            "highlights": graph.highlights[-100:],  # Keep last 100
            "struggle_predictions": graph.struggle_predictions,
            "stt_readings": graph.stt_readings[-50:], # Keep last 50
            "first_session": graph.first_session,
            "last_session": graph.last_session,
            "total_time_s": graph.total_time_s,
            "sessions_count": graph.sessions_count,
        }

        path = self._path(student_id, book_id)
        with open(path, "w") as f:
            json.dump(data, f)

    def record_section_read(
        self,
        student_id: str,
        book_id: str,
        section_id: str,
        section_title: str = "",
        chapter_title: str = "",
        time_spent_s: float = 0,
        quiz_score: Optional[float] = None,
        characters_seen: Optional[List[str]] = None,
        section_text: str = "",
        subjective_difficulty: Optional[int] = None,
        reading_speed_wpm: Optional[float] = None,
    ):
        """Record that a student read a section."""
        graph = self.get_or_create(student_id, book_id)
        
        # If more than 30 minutes have passed since the last read, count as a new session
        if time.time() - graph.last_session > 1800:
            graph.sessions_count += 1
            
        graph.last_session = time.time()
        graph.total_time_s += time_spent_s

        # Update or create chapter progress
        existing = None
        for cp in graph.chapter_progress:
            if cp.chapter_id == section_id:
                existing = cp
                break

        if existing:
            existing.sections_read += 1
            existing.time_spent_s += time_spent_s
            if quiz_score is not None:
                existing.quiz_score = quiz_score
                existing.comprehension_score = quiz_score
        else:
            graph.chapter_progress.append(ChapterProgress(
                chapter_id=section_id,
                chapter_title=chapter_title or section_title,
                sections_read=1,
                time_spent_s=time_spent_s,
                quiz_score=quiz_score,
                comprehension_score=quiz_score or 0.5,
                subjective_difficulty=subjective_difficulty,
                reading_speed_wpm=reading_speed_wpm,
            ))

        # Track characters
        if characters_seen:
            for char in characters_seen:
                current = graph.characters_encountered.get(char, 0)
                graph.characters_encountered[char] = min(1.0, current + 0.1)

        # Extract and update themes from section text (D4 — theme tracking)
        if section_text:
            detected = _extract_themes(section_text)
            for theme in detected:
                current_status = graph.themes_tracked.get(theme, "")
                if current_status == "understood":
                    pass  # Already at highest level
                elif quiz_score is not None and quiz_score >= 0.7:
                    graph.themes_tracked[theme] = "understood"
                elif current_status == "encountered":
                    graph.themes_tracked[theme] = "partial"
                else:
                    graph.themes_tracked[theme] = "encountered"

        self._save(student_id, book_id)

    def record_highlight(
        self,
        student_id: str,
        book_id: str,
        highlighted_text: str,
        section_id: str,
        was_simplified: bool = True,
    ):
        """Record a student highlighting text."""
        graph = self.get_or_create(student_id, book_id)
        graph.highlights.append({
            "text": highlighted_text[:200],
            "section_id": section_id,
            "timestamp": time.time(),
            "was_simplified": was_simplified,
        })

        # Update highlight count on chapter
        for cp in graph.chapter_progress:
            if cp.chapter_id == section_id:
                cp.highlights_made += 1
                break

        self._save(student_id, book_id)

    def record_vocab_lookup(
        self, student_id: str, book_id: str, word: str, source: str = "highlight"
    ):
        """Record a vocabulary word lookup from a specific interaction source."""
        graph = self.get_or_create(student_id, book_id)
        word_lower = word.lower()
        
        # Check if already tracked, otherwise add
        existing = next((v for v in graph.vocab_looked_up if isinstance(v, dict) and v["word"] == word_lower), None)
        if not existing:
            # Migration support: vocab_looked_up might be List[str] or List[dict]
            graph.vocab_looked_up.append({
                "word": word_lower,
                "timestamp": time.time(),
                "source": source
            })
        self._save(student_id, book_id)

    def record_vocab_mastered(
        self, student_id: str, book_id: str, word: str
    ):
        """Record that a student has mastered a vocabulary word."""
        graph = self.get_or_create(student_id, book_id)
        if word.lower() not in [w.lower() for w in graph.vocab_mastered]:
            graph.vocab_mastered.append(word.lower())
        self._save(student_id, book_id)

    def record_device_recognized(
        self, student_id: str, book_id: str, device: str
    ):
        """Record that a student encountered a literary device."""
        graph = self.get_or_create(student_id, book_id)
        graph.devices_recognized[device] = graph.devices_recognized.get(device, 0) + 1
        self._save(student_id, book_id)

    def record_stt_assessment(
        self,
        student_id: str,
        book_id: str,
        section_id: str,
        accuracy: float,
        wpm: float,
        feedback: str = "",
        mispronounced: List[str] = None
    ):
        """Record a speech-to-text reading assessment result."""
        graph = self.get_or_create(student_id, book_id)
        graph.stt_readings.append({
            "timestamp": time.time(),
            "section_id": section_id,
            "accuracy": accuracy,
            "wpm": wpm,
            "feedback": feedback,
            "mispronounced": mispronounced or []
        })
        
        # Also update overall progress if relevant
        for cp in graph.chapter_progress:
            if cp.chapter_id == section_id:
                # If they read correctly, improve comprehension score slightly
                if accuracy > 80:
                    cp.comprehension_score = min(1.0, cp.comprehension_score + 0.05)
                break
                
        self._save(student_id, book_id)

    def get_summary(
        self, student_id: str, book_id: str
    ) -> Dict[str, Any]:
        """Get a comprehensive comprehension summary."""
        graph = self.get_or_create(student_id, book_id)

        # Chapter comprehension
        chapters_read = len(graph.chapter_progress)
        chapters_with_quiz = [cp for cp in graph.chapter_progress if cp.quiz_score is not None]
        chapters_good = [cp for cp in chapters_with_quiz if (cp.quiz_score or 0) >= 0.7]
        chapters_needing_revisit = [
            {"id": cp.chapter_id, "title": cp.chapter_title, "score": cp.quiz_score}
            for cp in chapters_with_quiz
            if (cp.quiz_score or 0) < 0.5
        ]

        avg_comprehension = (
            sum(cp.comprehension_score for cp in graph.chapter_progress) / chapters_read
            if chapters_read > 0 else 0
        )

        # Calculate chapter-level telemetry
        chapters_with_wpm = [c for c in graph.chapter_progress if c.reading_speed_wpm is not None and c.reading_speed_wpm > 0]
        avg_wpm = sum(c.reading_speed_wpm for c in chapters_with_wpm) / len(chapters_with_wpm) if chapters_with_wpm else 0
        
        diff_ratings = [c.subjective_difficulty for c in graph.chapter_progress if c.subjective_difficulty is not None and c.subjective_difficulty > 0]
        avg_subjective_diff = sum(diff_ratings) / len(diff_ratings) if diff_ratings else 0

        # Group vocabulary by source
        vocab_by_source = defaultdict(list)
        for entry in graph.vocab_looked_up:
            if isinstance(entry, dict):
                vocab_by_source[entry.get("source", "highlight")].append(entry["word"])
            else: # Migration support for old List[str] format
                vocab_by_source["highlight"].append(entry)

        vocab_target = max(len(graph.vocab_looked_up), 1)
        vocab_progress = len(graph.vocab_mastered) / vocab_target

        return {
            "student_id": student_id,
            "book_id": book_id,
            "book_title": graph.book_title,
            "doc_type": graph.doc_type,
            "sessions_count": graph.sessions_count,
            "total_time_minutes": round(graph.total_time_s / 60, 1),
            "chapters_read": chapters_read,
            "chapters_with_good_comprehension": len(chapters_good),
            "chapters_needing_revisit": chapters_needing_revisit,
            "average_comprehension": round(avg_comprehension, 2),
            "average_wpm": round(avg_wpm, 1),
            "average_subjective_difficulty": round(avg_subjective_diff, 1),
            "characters_understood": {
                name: round(score, 2)
                for name, score in sorted(
                    graph.characters_encountered.items(),
                    key=lambda x: x[1], reverse=True,
                )
            },
            "themes_tracked": graph.themes_tracked,
            "literary_devices_seen": graph.devices_recognized,
            "vocabulary_looked_up": len(graph.vocab_looked_up),
            "vocabulary_mastered": len(graph.vocab_mastered),
            "vocabulary_progress": round(vocab_progress, 2),
            "total_highlights": len(graph.highlights),
            "recent_highlights": graph.highlights[-20:],  # last 20 for teacher common-pattern detection
            "struggle_predictions": graph.struggle_predictions,
            "stt_history": graph.stt_readings,
            "last_session": graph.last_session,
        }

    def get_recap(
        self, student_id: str, book_id: str
    ) -> Dict[str, Any]:
        """Generate a 'Story So Far' recap for when a student returns."""
        graph = self.get_or_create(student_id, book_id)

        read_chapters = [
            {"title": cp.chapter_title, "score": cp.comprehension_score}
            for cp in graph.chapter_progress
        ]
        main_characters = sorted(
            graph.characters_encountered.items(),
            key=lambda x: x[1], reverse=True,
        )[:5]
        recent_vocab = graph.vocab_looked_up[-10:]

        return {
            "book_title": graph.book_title,
            "chapters_completed": read_chapters,
            "main_characters": [
                {"name": name, "familiarity": round(score, 2)}
                for name, score in main_characters
            ],
            "recent_vocabulary": recent_vocab,
            "themes_so_far": graph.themes_tracked,
            "sessions_count": graph.sessions_count,
            "last_read": graph.last_session,
            "total_time_minutes": round(graph.total_time_s / 60, 1),
        }

    def get_class_wide_stats(self, book_id: str) -> Dict[str, Any]:
        """
        Aggregate stats across all students for a specific book.
        This enables Class-Level and Content-Level insights.
        """
        files = [f for f in os.listdir(self.storage_dir) if f.endswith(f"_{book_id}.json")]
        
        all_tricky_words = Counter()
        chapter_stats = defaultdict(lambda: {"times": [], "scores": [], "ratings": [], "count": 0})
        
        for filename in files:
            try:
                with open(os.path.join(self.storage_dir, filename)) as f:
                    data = json.load(f)
                    
                # Accummulate tricky words (lookups)
                for word in data.get("vocab_looked_up", []):
                    all_tricky_words[word] += 1
                    
                # Accumulate chapter-level metrics
                for cp in data.get("chapter_progress", []):
                    cid = cp["chapter_id"]
                    chapter_stats[cid]["count"] += 1
                    if cp.get("time_spent_s"):
                        chapter_stats[cid]["times"].append(cp["time_spent_s"])
                    if cp.get("quiz_score") is not None:
                        chapter_stats[cid]["scores"].append(cp["quiz_score"])
                    if cp.get("subjective_difficulty") is not None:
                        chapter_stats[cid]["ratings"].append(cp["subjective_difficulty"])
            except Exception:
                continue

        # Process aggregates
        formatted_chapters = {}
        for cid, stats in chapter_stats.items():
            formatted_chapters[cid] = {
                "avg_time_s": sum(stats["times"]) / len(stats["times"]) if stats["times"] else 0,
                "avg_score": sum(stats["scores"]) / len(stats["scores"]) if stats["scores"] else 0,
                "avg_difficulty_rating": sum(stats["ratings"]) / len(stats["ratings"]) if stats["ratings"] else 0,
                "student_count": stats["count"]
            }

        return {
            "book_id": book_id,
            "top_tricky_words": [{"word": w, "count": c} for w, c in all_tricky_words.most_common(20)],
            "chapter_insights": formatted_chapters,
            "student_count": len(files)
        }
