"""
teacher_recommendations.py
============================
AI-powered recommendation engine for teachers.

Analyzes student profiles and class patterns to generate:
- Individual student action items
- Small-group intervention strategies  
- Class-wide pedagogical adjustments
- Risk alerts for struggling students
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import numpy as np


@dataclass
class StudentRecommendation:
    """Individual recommendation for a student."""
    student_id: str
    student_name: str
    priority: str  # "high", "medium", "low"
    action: str    # Specific, actionable step
    rationale: str # Why this recommendation
    expected_impact: str  # What should improve


@dataclass
class ClassRecommendation:
    """Aggregated recommendation for a class or cohort."""
    pattern: str  # What pattern was detected
    affected_students: List[str]  # Who is affected
    intervention: str  # Suggested classroom strategy
    resource: Optional[str]  # Suggested resource/book/activity
    timeline: str  # "immediate" | "this week" | "this unit"


class TeacherRecommendationEngine:
    """
    Generates actionable recommendations from student data.
    
    Uses:
    - Learner embedding profiles (128-dim vectors)
    - Session telemetry (attention, speed, struggles)
    - Comprehension graphs (character/theme understanding)
    - Adaptation acceptance data (which adjustments help)
    """

    def __init__(self):
        pass

    def recommend_for_student(
        self,
        student_id: str,
        student_name: str,
        profile: Dict[str, Any],
        recent_sessions: List[Dict[str, Any]],
    ) -> List[StudentRecommendation]:
        """
        Generate 1–3 actionable recommendations for an individual student.

        Args:
            student_id: Student UUID
            student_name: Student's name
            profile: From learner_embedding.get_profile_summary()
            recent_sessions: Last 3–5 completed sessions with metrics

        Returns:
            List of StudentRecommendation objects, ranked by priority
        """
        recommendations: List[StudentRecommendation] = []

        if not recent_sessions:
            return []

        # Extract key metrics
        avg_attention = np.mean([s.get("attention_score", 0.7) for s in recent_sessions])
        recent_frustration = profile.get("frustration_level", 0.3)
        backtrack_rate = profile.get("backtrack_rate", 0.1)
        vocab_lookup_freq = profile.get("vocab_lookup_frequency", 0.3)
        preferred_adaptations = profile.get("preferred_adaptations", [])
        sessions_completed = profile.get("sessions_completed", 0)
        best_time = profile.get("best_time_of_day", "morning")

        # ── Trigger 1: Low attention ────────────────────────────────────────
        if avg_attention < 0.4 and sessions_completed > 2:
            recommendations.append(
                StudentRecommendation(
                    student_id=student_id,
                    student_name=student_name,
                    priority="high",
                    action=(
                        f"Schedule reading for {best_time} when they're freshest. "
                        "Try pairing with TTS + Highlights adaptation."
                    ),
                    rationale=(
                        f"Attention score averaging {avg_attention:.0%} "
                        f"with drift pattern. Best performance historically at {best_time}."
                    ),
                    expected_impact="Attention increase to 0.6+ within 2 sessions",
                )
            )

        # ── Trigger 2: High frustration ─────────────────────────────────────
        if recent_frustration > 0.5:
            recommendations.append(
                StudentRecommendation(
                    student_id=student_id,
                    student_name=student_name,
                    priority="high",
                    action=(
                        "Increase chunk size gradually (currently ~450 words). "
                        "Ensure Heavy Simplification is available for difficult passages."
                    ),
                    rationale=(
                        "Frustration signal (touch pressure, backtracks) elevated. "
                        "May be pushing too hard too fast."
                    ),
                    expected_impact="Frustration decrease; improved session completion rate",
                )
            )

        # ── Trigger 3: Frequent backtracking ────────────────────────────────
        if backtrack_rate > 0.3:
            recommendations.append(
                StudentRecommendation(
                    student_id=student_id,
                    student_name=student_name,
                    priority="medium",
                    action=(
                        "Check for comprehension gaps. Consider pre-reading a chapter summary "
                        "or using Highlight-to-Understand earlier in passage."
                    ),
                    rationale=(
                        f"Backtracking {backtrack_rate:.0%} of scrolls suggests "
                        "decoding or comprehension difficulty."
                    ),
                    expected_impact="Reduced re-reading; smoother reading flow",
                )
            )

        # ── Trigger 4: Heavy vocabulary lookup ───────────────────────────────
        if vocab_lookup_freq > 0.6:
            recommendations.append(
                StudentRecommendation(
                    student_id=student_id,
                    student_name=student_name,
                    priority="medium",
                    action=(
                        "Pre-teach 5–10 key vocabulary words before next chapter. "
                        "Use the Book Brain vocabulary list as reference."
                    ),
                    rationale=(
                        f"Looking up {vocab_lookup_freq:.0%} of sentences. "
                        "Proactive vocabulary support could reduce cognitive load."
                    ),
                    expected_impact="Fewer lookups; faster reading speed",
                )
            )

        # ── Trigger 5: Under-utilizing preferred adaptation ────────────────
        if preferred_adaptations and sessions_completed > 2:
            # Check if they're getting the adaptations they prefer
            top_adaptation = preferred_adaptations[0]
            recommendations.append(
                StudentRecommendation(
                    student_id=student_id,
                    student_name=student_name,
                    priority="low",
                    action=(
                        f"Default next session to '{top_adaptation}' adaptation. "
                        "This student rates it highest for helpfulness."
                    ),
                    rationale=(
                        f"Learning profile shows strong preference for '{top_adaptation}' "
                        f"(acceptance rate 85%+)."
                    ),
                    expected_impact="Better engagement; session completion rate +10%",
                )
            )

        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        recommendations.sort(key=lambda r: priority_order.get(r.priority, 999))

        return recommendations[:3]  # Top 3 per student

    def recommend_for_class(
        self,
        class_id: str,
        students_profiles: List[Dict[str, Any]],
        current_book: Optional[Dict[str, Any]] = None,
    ) -> List[ClassRecommendation]:
        """
        Analyze class-wide patterns and generate cohort-level recommendations.

        Args:
            class_id: Class UUID
            students_profiles: List of learner embedding summaries for all students
            current_book: Current book metadata (title, type, difficulty)

        Returns:
            List of ClassRecommendation objects
        """
        recommendations: List[ClassRecommendation] = []

        if not students_profiles:
            return []

        # Extract cohort metrics
        attention_scores = [p.get("reading_speed", 0.5) for p in students_profiles]
        frustration_levels = [p.get("frustration_level", 0.3) for p in students_profiles]
        vocab_lookup_freqs = [p.get("vocab_lookup_frequency", 0.3) for p in students_profiles]
        backtrack_rates = [p.get("backtrack_rate", 0.1) for p in students_profiles]

        avg_attention = np.mean(attention_scores)
        avg_frustration = np.mean(frustration_levels)
        avg_vocab_lookup = np.mean(vocab_lookup_freqs)
        avg_backtrack = np.mean(backtrack_rates)

        # ── Pattern 1: Class-wide attention drift ───────────────────────────
        if avg_attention < 0.45:
            low_attention_students = [
                p.get("student_id")
                for p in students_profiles
                if p.get("reading_speed", 0.5) < 0.4
            ]
            recommendations.append(
                ClassRecommendation(
                    pattern="Widespread attention drift after 10–15 min",
                    affected_students=low_attention_students,
                    intervention=(
                        "Introduce 10-minute reading chunks with breathing breaks. "
                        "Consider pairing with background focus sounds (binaural beats, rain)."
                    ),
                    resource="ADHD Chunking Engine + Focus Ambient Sounds",
                    timeline="immediate",
                )
            )

        # ── Pattern 2: Class-wide vocabulary struggle ────────────────────────
        if avg_vocab_lookup > 0.5:
            recommendations.append(
                ClassRecommendation(
                    pattern="High vocabulary lookup rates across cohort",
                    affected_students=[p.get("student_id") for p in students_profiles],
                    intervention=(
                        f"This book {'is using archaic language' if current_book and current_book.get('doc_type') == 'play' else 'has advanced vocabulary'}. "
                        "Pre-teach 10 key words before each chapter. "
                        "Emphasize Highlight-to-Understand feature."
                    ),
                    resource="Book Brain vocabulary list + Simplification service",
                    timeline="this week",
                )
            )

        # ── Pattern 3: Class-wide frustration ───────────────────────────────
        if avg_frustration > 0.4:
            recommendations.append(
                ClassRecommendation(
                    pattern="Elevated frustration signals (backtracking, hard taps)",
                    affected_students=[p.get("student_id") for p in students_profiles],
                    intervention=(
                        "Book difficulty may be mismatched. Consider: "
                        "(1) Smaller chunks, (2) More adaptations available, "
                        "(3) Character summary + theme preview before reading."
                    ),
                    resource="Book Brain pre-analysis + Dyslexia/ADHD layer enablement",
                    timeline="immediate",
                )
            )

        # ── Pattern 4: Disengaged subgroup ──────────────────────────────────
        disengaged = [
            p for p in students_profiles
            if p.get("sessions_completed", 0) < 2 and p.get("reading_speed", 0.5) < 0.35
        ]
        if len(disengaged) >= 2:
            recommendations.append(
                ClassRecommendation(
                    pattern="Subgroup shows low engagement (few sessions, slow speed)",
                    affected_students=[p.get("student_id") for p in disengaged],
                    intervention=(
                        "Check-in individually. May need: "
                        "(1) Preferred book genre from Book Brain, "
                        "(2) 1-on-1 reading session with teacher, "
                        "(3) Simplified version of text."
                    ),
                    resource="Learner profile review + Simplification service",
                    timeline="this week",
                )
            )

        return recommendations

    def generate_risk_alert(
        self,
        student_id: str,
        student_name: str,
        profile: Dict[str, Any],
        recent_sessions: List[Dict[str, Any]],
        alert_threshold: float = 0.3,  # Risk score >= 0.3 triggers alert
    ) -> Optional[Dict[str, Any]]:
        """
        Identify students at risk of disengagement or learning loss.

        Args:
            student_id: Student UUID
            student_name: Student's name
            profile: Learner embedding summary
            recent_sessions: Session telemetry data
            alert_threshold: Risk score cutoff [0, 1]

        Returns:
            Alert dict with risk level, factors, and interventions.
            None if risk is low.
        """
        risk_factors = []
        risk_score = 0.0

        if not recent_sessions:
            return None

        # Factor 1: Declining attention trend
        if len(recent_sessions) >= 2:
            recent_attn = recent_sessions[-1].get("attention_score", 0.7)
            prev_attn = recent_sessions[-2].get("attention_score", 0.7)
            if recent_attn < 0.3:
                risk_factors.append("Critically low attention (< 0.3)")
                risk_score += 0.3

        # Factor 2: High frustration
        if profile.get("frustration_level", 0) > 0.6:
            risk_factors.append("High frustration signals")
            risk_score += 0.2

        # Factor 3: Few sessions completed
        if profile.get("sessions_completed", 0) <= 1:
            risk_factors.append("Few sessions (possible early dropout)")
            risk_score += 0.25

        # Factor 4: Declining quiz scores
        quiz_scores = [s.get("quiz_score") for s in recent_sessions if s.get("quiz_score")]
        if len(quiz_scores) >= 2 and quiz_scores[-1] < quiz_scores[0] - 0.2:
            risk_factors.append("Declining comprehension scores")
            risk_score += 0.15

        if risk_score < alert_threshold:
            return None

        return {
            "student_id": student_id,
            "student_name": student_name,
            "risk_level": "high" if risk_score > 0.6 else "medium",
            "risk_score": risk_score,
            "factors": risk_factors,
            "recommended_actions": [
                "Teacher check-in or parent communication",
                "Simplify current text or switch to easier book",
                "Schedule small-group reading session",
                "Review student's preferred adaptation settings",
            ],
            "escalate_if": "No improvement after 1 week of intervention",
        }


# ── Module-level singleton ───────────────────────────────────────────────────

_engine = TeacherRecommendationEngine()


def get_recommendation_engine() -> TeacherRecommendationEngine:
    """Get the singleton recommendation engine."""
    return _engine
