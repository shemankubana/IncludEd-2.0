"""
IncludEd AI Service – FastAPI Application
==========================================
Endpoints:
  GET  /                          — health check
  POST /adapt-text                — RL-powered text adaptation
  POST /generate-questions        — question generation
  POST /session/start             — start a reading session
  POST /session/telemetry         — push telemetry, receive RL action
  POST /session/end               — finalise session, compute reward
  GET  /session/{session_id}      — get session details
  POST /rl/predict                — direct RL prediction (testing)
  GET  /rl/status                 — model info
  GET  /analytics/summary         — aggregate performance for teacher dashboard
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
import time
from dotenv import load_dotenv

# Service imports
from services.question_generator  import FreeQuestionGenerator
from services.accessibility_adapter import FreeAccessibilityAdapter
from services.rl_agent_service    import RLAgentService
from services.attention_monitor   import AttentionMonitor
from services.session_manager     import SessionManager

load_dotenv()

app = FastAPI(
    title     = "IncludEd AI Service",
    version   = "2.0.0",
    description = (
        "RL-powered adaptive learning backend for students with Dyslexia and ADHD. "
        "Implements PPO-based personalisation aligned with the IncludEd research proposal."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Service singletons ────────────────────────────────────────────────────────
question_gen        = FreeQuestionGenerator()
accessibility_adapter = FreeAccessibilityAdapter()
rl_agent            = RLAgentService()
session_manager     = SessionManager()

# Simple in-memory analytics store (per session summary for teacher dashboard)
# In production this would be replaced by calls to the Node.js backend's DB
_session_summaries: List[Dict] = []


# ── Request / Response models ─────────────────────────────────────────────────

class TextAdaptRequest(BaseModel):
    text: str
    target_level: Optional[str] = "accessible"
    disability_profile: Optional[Dict] = None
    student_focus: Optional[float] = Field(default=0.6, ge=0.0, le=1.0)
    text_difficulty: Optional[float] = Field(default=0.5, ge=0.0, le=1.0)

class QuestionGenRequest(BaseModel):
    content: str
    count: int = Field(default=10, ge=1, le=20)

class SessionStartRequest(BaseModel):
    student_id: str
    disability_type: float = Field(default=0.0, ge=0.0, le=1.0,
        description="0.0=none, 0.5=dyslexia, 1.0=ADHD")
    text_difficulty: float = Field(default=0.5, ge=0.0, le=1.0)
    literature_id: Optional[str] = None

class TelemetryRequest(BaseModel):
    session_id: str
    telemetry: Dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Raw telemetry: mouse_speed, mouse_dwell, scroll_back_count, "
            "key_latency, idle_duration, reading_speed_wpm, backtrack_count"
        )
    )

class SessionEndRequest(BaseModel):
    session_id: str
    quiz_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    completion_rate: float = Field(default=1.0, ge=0.0, le=1.0)

class RLPredictRequest(BaseModel):
    state_vector: List[float] = Field(
        description=(
            "8-dim vector: [reading_speed, mouse_dwell, scroll_hesitation, "
            "backtrack_freq, attention_score, disability_type, text_difficulty, session_fatigue]"
        )
    )


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service":       "IncludEd AI Service",
        "version":       "2.0.0",
        "status":        "healthy",
        "model_status":  "RL Model Loaded" if rl_agent.model_ready else "Rule-based fallback",
        "active_sessions": len(session_manager.list_active_sessions()),
        "timestamp":     time.time(),
    }


# ── Text adaptation ───────────────────────────────────────────────────────────

@app.post("/adapt-text")
async def adapt_text(request: TextAdaptRequest):
    """Adapt text using RL to decide the strategy, then apply it."""
    try:
        action_id, action_desc = rl_agent.predict_action(
            text_difficulty    = request.text_difficulty or 0.5,
            student_focus      = request.student_focus or 0.6,
            disability_profile = request.disability_profile,
        )

        text_chunk = request.text[:5000]

        # Map RL action to adapter params
        if action_id == 0:
            return {
                "adaptedText": text_chunk,
                "strategy":    action_desc,
                "action_id":   action_id,
                "note":        "RL decided original text is optimal.",
            }

        level = "very_accessible" if action_id == 2 else "accessible"
        adapted = accessibility_adapter.adapt_text(
            text_chunk, level, disability_profile=request.disability_profile
        )

        prefix = ""
        if action_id in (3, 4):
            prefix = "[AI: ENABLE TTS + HIGHLIGHTS]\n"
        elif action_id == 5:
            prefix = "[AI: SUGGEST ATTENTION BREAK — Short break recommended]\n"

        return {
            "adaptedText": prefix + adapted,
            "strategy":    action_desc,
            "action_id":   action_id,
        }

    except Exception as e:
        return {"adaptedText": request.text[:5000], "error": str(e)}


# ── Question generation ───────────────────────────────────────────────────────

@app.post("/generate-questions")
async def generate_questions(request: QuestionGenRequest):
    try:
        content_chunk = request.content[:3000]
        questions = question_gen.generate(content_chunk, request.count)
        return {"questions": questions}
    except Exception as e:
        return {"questions": question_gen.generate_fallback(request.content[:1000], request.count)}


# ── Reading session endpoints ─────────────────────────────────────────────────

@app.post("/session/start")
async def start_session(request: SessionStartRequest):
    """
    Start a new adaptive reading session.
    Returns session_id and the initial RL action recommendation.
    """
    session = session_manager.start_session(
        student_id      = request.student_id,
        disability_type = request.disability_type,
        text_difficulty = request.text_difficulty,
        literature_id   = request.literature_id,
    )

    # Initial RL recommendation from neutral state
    initial_state = [
        0.5,                    # reading_speed (neutral)
        0.0,                    # mouse_dwell
        0.0,                    # scroll_hesitation
        0.0,                    # backtrack_freq
        1.0,                    # attention_score (fresh start)
        request.disability_type,
        request.text_difficulty,
        0.0,                    # session_fatigue
    ]
    action_id, action_label = rl_agent.predict_from_state_vector(initial_state)
    session_manager.record_rl_action(
        session.session_id, action_id, action_label, initial_state
    )

    return {
        "session_id":       session.session_id,
        "student_id":       session.student_id,
        "disability_type":  session.disability_type,
        "started_at":       session.started_at,
        "initial_action":   {"id": action_id, "label": action_label},
        "message":          "Session started. Send telemetry events to /session/telemetry",
    }


@app.post("/session/telemetry")
async def push_telemetry(request: TelemetryRequest):
    """
    Push a telemetry snapshot. Returns the RL-recommended next action
    and the current attention state.
    """
    session = session_manager.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.is_active:
        raise HTTPException(status_code=400, detail="Session has ended")

    # Process telemetry → get state vector
    state_vector = session_manager.get_rl_state(
        request.session_id, request.telemetry
    )
    if state_vector is None:
        raise HTTPException(status_code=500, detail="Could not compute state vector")

    # RL prediction
    action_id, action_label = rl_agent.predict_from_state_vector(state_vector)
    session_manager.record_rl_action(
        request.session_id, action_id, action_label, state_vector
    )

    # Compute attention state for the response
    from services.attention_monitor import AttentionMonitor
    monitor = session_manager._monitors.get(request.session_id)

    return {
        "session_id":      request.session_id,
        "action":          {"id": action_id, "label": action_label},
        "state_vector":    state_vector,
        "attention_score": state_vector[4],
        "session_fatigue": state_vector[7],
        "total_events":    len(session.telemetry_events),
    }


@app.post("/session/end")
async def end_session(request: SessionEndRequest):
    """
    Finalise a session. Computes final reward for RL training data.
    Stores summary in memory for the analytics endpoint.
    """
    session = session_manager.end_session(
        session_id      = request.session_id,
        quiz_score      = request.quiz_score,
        completion_rate = request.completion_rate,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    summary = session_manager.session_to_dict(session)

    # Store for analytics
    _session_summaries.append(summary)

    return {
        "message":      "Session ended",
        "session":      summary,
        "rl_training_record": {
            "session_id":      session.session_id,
            "student_id":      session.student_id,
            "disability_type": session.disability_type,
            "final_reward":    session.final_reward,
            "actions_taken":   [
                {"action_id": a.action_id, "action_label": a.action_label,
                 "state_vector": a.state_vector}
                for a in session.rl_actions
            ],
        },
    }


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_manager.session_to_dict(session)


# ── RL introspection ──────────────────────────────────────────────────────────

@app.post("/rl/predict")
async def rl_predict(request: RLPredictRequest):
    """Direct RL prediction — mainly for testing via Streamlit."""
    if len(request.state_vector) != 8:
        raise HTTPException(
            status_code=422,
            detail="state_vector must have exactly 8 elements"
        )
    action_id, action_label = rl_agent.predict_from_state_vector(request.state_vector)
    return {
        "action_id":    action_id,
        "action_label": action_label,
        "state_vector": request.state_vector,
        "model_used":   "PPO" if rl_agent.model_ready else "rule-based-fallback",
    }


@app.get("/rl/status")
async def rl_status():
    return rl_agent.status()


@app.post("/rl/reload")
async def rl_reload():
    """Reload the model (call after training a new model)."""
    rl_agent.reload_model()
    return {"message": "Model reloaded", **rl_agent.status()}


# ── Analytics ─────────────────────────────────────────────────────────────────

@app.get("/analytics/summary")
async def analytics_summary():
    """
    Aggregate session stats for the teacher dashboard.
    Returns class-wide and per-disability-type summaries.
    """
    if not _session_summaries:
        return {
            "total_sessions": 0,
            "message":        "No sessions recorded yet.",
            "by_disability":  {},
            "sessions":       [],
        }

    import numpy as np

    disability_labels = {0.0: "none", 0.5: "dyslexia", 1.0: "adhd"}

    by_disability: Dict[str, Dict] = {}
    for label in disability_labels.values():
        group = [s for s in _session_summaries
                 if disability_labels.get(s.get("disability_type", 0.0)) == label]
        if group:
            by_disability[label] = {
                "count":            len(group),
                "avg_attention":    round(float(np.mean([s["avg_attention"]    for s in group])), 3),
                "avg_quiz_score":   round(float(np.mean([s["quiz_score"]       for s in group if s["quiz_score"] is not None] or [0])), 3),
                "avg_completion":   round(float(np.mean([s["completion_rate"]  for s in group])), 3),
                "avg_final_reward": round(float(np.mean([s["final_reward"]     for s in group if s["final_reward"] is not None] or [0])), 3),
            }

    overall_quiz = [s["quiz_score"] for s in _session_summaries if s.get("quiz_score") is not None]
    overall_attn = [s["avg_attention"] for s in _session_summaries]

    return {
        "total_sessions":     len(_session_summaries),
        "overall_avg_attention": round(float(np.mean(overall_attn)), 3) if overall_attn else None,
        "overall_avg_quiz":      round(float(np.mean(overall_quiz)), 3)  if overall_quiz  else None,
        "by_disability":      by_disability,
        "recent_sessions":    _session_summaries[-20:],   # last 20 sessions
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)