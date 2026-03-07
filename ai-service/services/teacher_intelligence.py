"""
teacher_intelligence.py
=======================
Teacher Intelligence Layer — generates actionable insights in plain language.

Teachers don't want dashboards with graphs. They want answers:
  "Amina is 2 chapters behind. She understands characters well but struggles
   with figurative language. Recommended: Pair her with Jean for the proverbs
   discussion on Thursday."

Generates:
  - Natural language student summaries
  - Specific, actionable teaching recommendations
  - Class-wide pattern alerts
  - Predicted exam risk areas
"""

from __future__ import annotations

import time
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional

from .ollama_service import OllamaService


class TeacherIntelligence:
    """
    Generates teacher-facing intelligence from student data.

    Usage:
        ti = TeacherIntelligence()
        summary = ti.student_summary(student_data, book_data)
        alerts = ti.class_alerts(all_students_data)
        recs = ti.teaching_recommendations(class_data)
    """

    def __init__(self):
        self.ollama = OllamaService()

    def student_summary(
        self,
        student_name: str,
        comprehension_data: Dict[str, Any],
        learner_profile: Dict[str, Any],
        class_average_chapter: int = 0,
    ) -> Dict[str, Any]:
        """
        Generate a natural language summary for one student.

        Returns:
            {
                "summary": str,         # NL paragraph
                "strengths": [str],
                "areas_for_growth": [str],
                "recommendation": str,  # Specific action
                "risk_level": "low" | "medium" | "high",
                "chapters_behind": int,
            }
        """
        chapters_read = comprehension_data.get("chapters_read", 0)
        avg_comp = comprehension_data.get("average_comprehension", 0)
        vocab_progress = comprehension_data.get("vocabulary_progress", 0)
        characters = comprehension_data.get("characters_understood", {})
        devices = comprehension_data.get("literary_devices_seen", {})
        chapters_needing_revisit = comprehension_data.get("chapters_needing_revisit", [])
        highlights = comprehension_data.get("total_highlights", 0)
        total_time = comprehension_data.get("total_time_minutes", 0)

        profile_persistence = learner_profile.get("persistence", 0.5)
        profile_frustration = learner_profile.get("frustration_level", 0.3)
        preferred_adaptations = learner_profile.get("preferred_adaptations", [])
        best_time = learner_profile.get("best_time_of_day", "")

        chapters_behind = max(0, class_average_chapter - chapters_read)

        # Determine strengths
        strengths = []
        if avg_comp >= 0.7:
            strengths.append("strong comprehension overall")
        if len(characters) >= 3 and all(v > 0.5 for v in characters.values()):
            strengths.append("good character understanding")
        if vocab_progress > 0.5:
            strengths.append("building vocabulary effectively")
        if profile_persistence > 0.6:
            strengths.append("persistent reader who doesn't give up easily")
        if highlights > 5:
            strengths.append("actively engages with difficult text")

        # Areas for growth
        areas = []
        if avg_comp < 0.5:
            areas.append("overall comprehension needs support")
        if len(devices) < 2:
            areas.append("recognizing literary devices")
        if vocab_progress < 0.3:
            areas.append("vocabulary acquisition")
        if profile_frustration > 0.6:
            areas.append("managing frustration with difficult text")
        if chapters_behind > 2:
            areas.append(f"pacing — {chapters_behind} chapters behind class average")
        if chapters_needing_revisit:
            revisit_titles = [c["title"] for c in chapters_needing_revisit[:3]]
            areas.append(f'needs to revisit: {", ".join(revisit_titles)}')

        # Risk level
        risk = "low"
        if avg_comp < 0.4 or chapters_behind > 3 or profile_frustration > 0.7:
            risk = "high"
        elif avg_comp < 0.6 or chapters_behind > 1:
            risk = "medium"

        # Generate recommendation
        recommendation = self._generate_recommendation(
            student_name, strengths, areas, risk,
            preferred_adaptations, best_time,
        )

        # Build summary
        summary = self._build_summary(
            student_name, chapters_read, avg_comp, vocab_progress,
            strengths, areas, chapters_behind, total_time,
        )

        return {
            "student_name": student_name,
            "summary": summary,
            "strengths": strengths,
            "areas_for_growth": areas,
            "recommendation": recommendation,
            "risk_level": risk,
            "chapters_behind": chapters_behind,
            "chapters_read": chapters_read,
            "average_comprehension": round(avg_comp, 2),
            "total_time_minutes": round(total_time, 1),
        }

    def _build_summary(
        self,
        name: str,
        chapters: int,
        avg_comp: float,
        vocab_progress: float,
        strengths: List[str],
        areas: List[str],
        behind: int,
        total_time: float,
    ) -> str:
        parts = []

        # Progress
        comp_desc = "excellent" if avg_comp >= 0.8 else "good" if avg_comp >= 0.6 else "developing" if avg_comp >= 0.4 else "needs support"
        parts.append(
            f"{name} has read {chapters} chapter{'s' if chapters != 1 else ''} "
            f"and is showing {comp_desc} progress in their comprehension ({int(avg_comp * 100)}%)."
        )

        if behind > 0:
            parts.append(f"Currently {behind} chapter{'s' if behind != 1 else ''} behind the class average.")

        # Strengths
        if strengths:
            parts.append(f"Strengths: {', '.join(strengths[:3])}.")

        # Areas
        if areas:
            parts.append(f"Areas for growth: {', '.join(areas[:3])}.")

        # Time
        if total_time > 0:
            parts.append(f"Total reading time: {int(total_time)} minutes.")

        return " ".join(parts)

    def _generate_recommendation(
        self,
        name: str,
        strengths: List[str],
        areas: List[str],
        risk: str,
        preferred_adaptations: List[str],
        best_time: str,
    ) -> str:
        if risk == "high":
            if "vocabulary acquisition" in areas:
                return (
                    f"Recommended: Provide {name} with a vocabulary pre-teaching session "
                    f"before the next chapter. Consider pairing with a stronger reader "
                    f"for shared reading activities."
                )
            if "overall comprehension needs support" in areas:
                return (
                    f"Recommended: Schedule a brief 1-on-1 check-in with {name}. "
                    f"Use guided reading questions to scaffold understanding. "
                    f"Consider reducing the reading pace temporarily."
                )
            return (
                f"Recommended: {name} needs additional support. Consider meeting with them "
                f"to identify specific barriers and adjust the reading approach."
            )

        if risk == "medium":
            if "recognizing literary devices" in areas:
                return (
                    f"Suggested: Include {name} in a small group discussion about "
                    f"literary techniques used in the current chapters."
                )
            return (
                f"Suggested: Monitor {name}'s progress over the next session. "
                f"They may benefit from targeted vocabulary activities."
            )

        # Low risk
        if "persistent reader" in str(strengths):
            return (
                f"{name} is progressing well. Consider offering enrichment activities "
                f"or peer tutoring opportunities."
            )
        return f"{name} is on track. Continue current approach."

    def class_alerts(
        self,
        all_student_summaries: List[Dict[str, Any]],
        book_title: str = "",
    ) -> List[Dict[str, Any]]:
        """
        Generate class-wide pattern alerts.

        Returns list of alerts like:
            {
                "type": "common_struggle" | "pacing" | "vocabulary" | "engagement",
                "severity": "info" | "warning" | "urgent",
                "message": str,
                "affected_students": [str],
                "suggested_action": str,
            }
        """
        alerts = []

        # Check for common struggles
        high_risk = [s for s in all_student_summaries if s.get("risk_level") == "high"]
        if len(high_risk) >= 3:
            names = [s["student_name"] for s in high_risk[:5]]
            alerts.append({
                "type": "common_struggle",
                "severity": "urgent",
                "message": (
                    f"{len(high_risk)} students are struggling significantly"
                    + (f" with {book_title}" if book_title else "")
                    + "."
                ),
                "affected_students": names,
                "suggested_action": (
                    "Consider a class-wide review session or reducing the reading pace. "
                    "Meet individually with the most at-risk students."
                ),
            })

        # Check pacing issues
        behind_students = [s for s in all_student_summaries if s.get("chapters_behind", 0) > 2]
        if behind_students:
            names = [s["student_name"] for s in behind_students[:5]]
            alerts.append({
                "type": "pacing",
                "severity": "warning",
                "message": f"{len(behind_students)} student{'s are' if len(behind_students) > 1 else ' is'} more than 2 chapters behind.",
                "affected_students": names,
                "suggested_action": "Consider a catch-up reading session or provide audio summaries of missed chapters.",
            })

        # Check vocabulary patterns
        low_vocab = [
            s for s in all_student_summaries
            if "vocabulary acquisition" in s.get("areas_for_growth", [])
        ]
        if len(low_vocab) >= 2:
            names = [s["student_name"] for s in low_vocab[:5]]
            alerts.append({
                "type": "vocabulary",
                "severity": "warning",
                "message": f"{len(low_vocab)} students are struggling with vocabulary.",
                "affected_students": names,
                "suggested_action": (
                    "Suggested: 5-minute vocabulary warm-up before the next reading session. "
                    "Focus on the key words from upcoming chapters."
                ),
            })

        # Engagement check
        avg_time = sum(s.get("total_time_minutes", 0) for s in all_student_summaries) / max(len(all_student_summaries), 1)
        low_engagement = [s for s in all_student_summaries if s.get("total_time_minutes", 0) < avg_time * 0.5]
        if low_engagement:
            names = [s["student_name"] for s in low_engagement[:5]]
            alerts.append({
                "type": "engagement",
                "severity": "info",
                "message": f"{len(low_engagement)} student{'s have' if len(low_engagement) > 1 else ' has'} significantly less reading time than average.",
                "affected_students": names,
                "suggested_action": "Check in on reading habits and consider suggesting shorter reading sessions.",
            })

        return alerts

    def common_highlight_alerts(
        self,
        all_highlights: List[Dict[str, Any]],
        book_title: str = "",
        min_students: int = 2,
    ) -> List[Dict[str, Any]]:
        """
        Detect passages highlighted by multiple students (D6 deliverable).

        Parameters
        ----------
        all_highlights : list of {student_name, text, section_id, timestamp}
        min_students   : minimum students who must share a passage to trigger alert

        Returns alerts like:
            {
                "type": "common_highlight",
                "severity": "warning" | "info",
                "message": str,
                "passage": str,
                "section_id": str,
                "student_count": int,
                "student_names": [str],
                "suggested_action": str,
            }
        """
        passage_map: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"students": set(), "original": "", "section_id": ""}
        )

        for h in all_highlights:
            text = (h.get("text") or "").strip()
            if len(text) < 15:
                continue
            # Group by first 80 chars (catches near-identical highlights)
            key = text[:80].lower()
            passage_map[key]["students"].add(h.get("student_name", "Unknown"))
            passage_map[key]["original"] = text[:160]
            passage_map[key]["section_id"] = h.get("section_id", "")

        alerts = []
        for _key, info in passage_map.items():
            if len(info["students"]) >= min_students:
                names = list(info["students"])
                count = len(names)
                preview = info["original"][:100] + ("…" if len(info["original"]) > 100 else "")
                book_note = f' in "{book_title}"' if book_title else ""

                alerts.append({
                    "type": "common_highlight",
                    "severity": "warning" if count >= 3 else "info",
                    "message": (
                        f"{count} students highlighted the same passage{book_note}: \"{preview}\""
                    ),
                    "passage": info["original"],
                    "section_id": info["section_id"],
                    "student_count": count,
                    "student_names": names[:10],
                    "suggested_action": (
                        "Consider a brief class discussion about this passage. "
                        f"{'Multiple' if count >= 3 else 'Some'} students may not understand "
                        "the concept or literary device used here."
                    ),
                })

        alerts.sort(key=lambda a: a["student_count"], reverse=True)
        return alerts

    def generate_recap_text(
        self,
        recap_data: Dict[str, Any],
        language: str = "en",
    ) -> str:
        """
        Generate a 'Story So Far' recap text from comprehension data.
        Uses Ollama if available, otherwise templates.
        """
        book_title = recap_data.get("book_title", "the book")
        chapters = recap_data.get("chapters_completed", [])
        characters = recap_data.get("main_characters", [])
        vocab = recap_data.get("recent_vocabulary", [])

        if self.ollama.is_available():
            try:
                chapter_list = ", ".join(c["title"] for c in chapters[-5:])
                char_list = ", ".join(c["name"] for c in characters)

                if language == "fr":
                    prompt = (
                        f"Écris un bref résumé (3-4 phrases) de ce que l'élève a lu "
                        f'dans "{book_title}". Chapitres lus: {chapter_list}. '
                        f"Personnages principaux: {char_list}. "
                        f"Ton simple et engageant pour un élève du primaire (9-12 ans)."
                    )
                else:
                    prompt = (
                        f'Write a brief "Story So Far" recap (3-4 sentences) for a student '
                        f'reading "{book_title}". Chapters completed: {chapter_list}. '
                        f"Main characters: {char_list}. "
                        f"Keep it simple, engaging, and suitable for a primary school student (ages 9-12)."
                    )
                result = self.ollama.generate(prompt)
                if result and len(result.strip()) > 30:
                    return result.strip()
            except Exception:
                pass

        # Template fallback
        if not chapters:
            return f'Welcome to "{book_title}"! You\'re about to start an exciting journey.'

        last_chapter = chapters[-1]["title"] if chapters else ""
        char_names = [c["name"] for c in characters[:3]]

        if language == "fr":
            recap = f'Tu as lu jusqu\'à "{last_chapter}" dans "{book_title}". '
            if char_names:
                recap += f"Les personnages principaux jusqu'ici: {', '.join(char_names)}. "
            recap += "Continue ta lecture pour découvrir la suite !"
        else:
            recap = f'You\'ve read up to "{last_chapter}" in "{book_title}". '
            if char_names:
                recap += f"Main characters so far: {', '.join(char_names)}. "
            recap += "Keep reading to find out what happens next!"

        return recap
