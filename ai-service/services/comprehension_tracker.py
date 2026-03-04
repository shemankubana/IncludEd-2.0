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
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set


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

    def __init__(self, storage_dir: str = "/tmp/included_comprehension"):
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
                    first_session=data.get("first_session", 0),
                    last_session=data.get("last_session", 0),
                    total_time_s=data.get("total_time_s", 0),
                    sessions_count=data.get("sessions_count", 0),
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
                    "completed": cp.completed,
                }
                for cp in graph.chapter_progress
            ],
            "highlights": graph.highlights[-100:],  # Keep last 100
            "struggle_predictions": graph.struggle_predictions,
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
    ):
        """Record that a student read a section."""
        graph = self.get_or_create(student_id, book_id)
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
            ))

        # Track characters
        if characters_seen:
            for char in characters_seen:
                current = graph.characters_encountered.get(char, 0)
                graph.characters_encountered[char] = min(1.0, current + 0.1)

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
        self, student_id: str, book_id: str, word: str
    ):
        """Record a vocabulary word lookup."""
        graph = self.get_or_create(student_id, book_id)
        if word.lower() not in [w.lower() for w in graph.vocab_looked_up]:
            graph.vocab_looked_up.append(word.lower())
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
            "struggle_predictions": graph.struggle_predictions,
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
