"""
IncludEd – Streamlit Testing UI
================================
Multi-page app for testing the AI service and backend without the React frontend.

Pages:
  1. 🎓 Student Session    – Simulate a full reading session with live RL adaptation
  2. 🧠 Attention Monitor  – Input telemetry, visualise focus score and RL action
  3. 📊 Teacher Dashboard  – View analytics from the backend / AI service
  4. 🤖 RL Inspector       – Explore the model, test arbitrary state vectors

Run:
    cd streamlit_app
    pip install -r requirements.txt
    streamlit run app.py
"""

import streamlit as st
import requests
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import numpy as np
import time
import json
from typing import Optional

# ── Config ────────────────────────────────────────────────────────────────────

AI_SERVICE_URL  = "http://localhost:8080"
BACKEND_URL     = "http://localhost:3000"

ACTION_LABELS = {
    0: "Keep Original",
    1: "Light Simplification",
    2: "Heavy Simplification",
    3: "TTS + Highlights",
    4: "Syllable Break",
    5: "Attention Break",
}

ACTION_COLORS = {
    0: "#6b7280",   # grey
    1: "#3b82f6",   # blue
    2: "#8b5cf6",   # purple
    3: "#f59e0b",   # amber
    4: "#10b981",   # green
    5: "#ef4444",   # red
}

DISABILITY_OPTIONS = {
    "None (neurotypical)":   0.0,
    "Dyslexia":              0.5,
    "ADHD":                  1.0,
}

SAMPLE_TEXTS = {
    "Rwanda CBC – P4 Science (English)": """
The water cycle is the continuous movement of water through the environment.
Water evaporates from rivers, lakes, and oceans when the sun heats it.
The water vapour rises into the sky and forms clouds when it cools.
When the clouds become heavy with water, rain falls back to the ground.
This process repeats over and over. Rwanda has two rainy seasons each year.
During these seasons, the hills of Rwanda receive plenty of rainfall.
The rainwater fills our rivers, helps farmers grow crops, and supports all living things.
""".strip(),

    "Romeo & Juliet – Act 2 (Literature)": """
O Romeo, Romeo! wherefore art thou Romeo?
Deny thy father and refuse thy name.
Or, if thou wilt not, be but sworn my love,
And I'll no longer be a Capulet.
What's in a name? that which we call a rose
By any other name would smell as sweet.
So Romeo would, were he not Romeo called,
Retain that dear perfection which he owes without that title.
""".strip(),

    "Numbers & Place Value (Mathematics – P3)": """
A number has digits. The digit in the ones place tells us how many ones.
The digit in the tens place tells us how many tens we have.
For example, the number 47 has 4 tens and 7 ones.
We can write forty-seven as 40 + 7. This is called expanded form.
Knowing place value helps us add, subtract, and compare numbers.
When we add 23 and 15, we add the ones first: 3 + 5 = 8. Then the tens: 20 + 10 = 30.
So 23 + 15 = 38.
""".strip(),
}

# ── Utilities ─────────────────────────────────────────────────────────────────

def ai_get(path: str) -> Optional[dict]:
    try:
        r = requests.get(f"{AI_SERVICE_URL}{path}", timeout=5)
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def ai_post(path: str, payload: dict) -> Optional[dict]:
    try:
        r = requests.post(f"{AI_SERVICE_URL}{path}", json=payload, timeout=10)
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def backend_get(path: str, token: str = "") -> Optional[dict]:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        r = requests.get(f"{BACKEND_URL}{path}", headers=headers, timeout=5)
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def action_badge(action_id: int) -> str:
    label = ACTION_LABELS.get(action_id, "Unknown")
    color = ACTION_COLORS.get(action_id, "#6b7280")
    return f'<span style="background:{color};color:white;padding:3px 10px;border-radius:12px;font-size:0.85em;font-weight:600">{action_id}: {label}</span>'

def service_status_badge(url: str, label: str):
    try:
        r = requests.get(url, timeout=2)
        if r.status_code == 200:
            st.success(f"✅ {label} — online")
        else:
            st.warning(f"⚠️ {label} — responded with {r.status_code}")
    except:
        st.error(f"❌ {label} — unreachable at {url}")

def render_synchronized_tts(audio_base64: str, timestamps: list, text: str):
    """
    Renders an HTML component with synchronized word-level highlighting.
    """
    # Prepare word spans
    words = text.split()
    word_spans = []
    
    # Simple check to match words with timestamps (assuming standard split)
    # in production this should be more robust
    for i, word in enumerate(words):
        word_spans.append(f'<span id="word-{i}" class="word">{word}</span>')
    
    html_content = f"""
    <style>
        .reading-box {{
            line-height: 2.2;
            font-size: 1.25rem;
            padding: 20px;
            background: #f8fafc;
            border-radius: 12px;
            color: #1e293b;
            font-family: 'Inter', sans-serif;
        }}
        .word {{
            padding: 2px 4px;
            border-radius: 4px;
            transition: background 0.1s ease;
        }}
        .highlight {{
            background-color: #fde047;
            color: #000;
            font-weight: 600;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .audio-container {{
            margin-bottom: 20px;
        }}
        audio {{
            width: 100%;
            height: 40px;
        }}
    </style>
    
    <div class="audio-container">
        <audio id="audio-player" controls>
            <source src="data:audio/mp3;base64,{audio_base64}" type="audio/mp3">
        </audio>
    </div>
    
    <div id="text-container" class="reading-box">
        {' '.join(word_spans)}
    </div>
    
    <script>
        const audio = document.getElementById('audio-player');
        const timestamps = {json.dumps(timestamps)};
        
        audio.addEventListener('timeupdate', () => {{
            const currentTime = audio.currentTime;
            
            // Find current word
            let activeIndex = -1;
            for (let i = 0; i < timestamps.length; i++) {{
                if (currentTime >= timestamps[i].start && currentTime <= (timestamps[i].start + timestamps[i].duration + 0.1)) {{
                    activeIndex = i;
                    break;
                }}
            }}
            
            // Update highlights
            document.querySelectorAll('.word').forEach((el, idx) => {{
                if (idx === activeIndex) {{
                    el.classList.add('highlight');
                    // Scroll into view if needed
                    // el.scrollIntoView({{ behavior: 'smooth', block: 'nearest' }});
                }} else {{
                    el.classList.remove('highlight');
                }}
            }});
        }});
    </script>
    """
    import streamlit.components.v1 as components
    components.html(html_content, height=400, scrolling=True)

# ── Page setup ────────────────────────────────────────────────────────────────

st.set_page_config(
    page_title  = "IncludEd Testing UI",
    page_icon   = "🎓",
    layout      = "wide",
    initial_sidebar_state = "expanded",
)

# Sidebar
st.sidebar.image("https://via.placeholder.com/200x60/6366f1/ffffff?text=IncludEd+2.0",
                 use_container_width=True)
st.sidebar.markdown("## Navigation")
page = st.sidebar.radio(
    "Go to",
    ["🎓 Student Session", "🧠 Attention Monitor", "📊 Teacher Dashboard", "🤖 RL Inspector"],
    label_visibility="collapsed",
)

st.sidebar.divider()
st.sidebar.markdown("### Service Status")
service_status_badge(f"{AI_SERVICE_URL}/", "AI Service (port 8080)")
service_status_badge(f"{BACKEND_URL}/health", "Node Backend (port 3000)")

st.sidebar.divider()
st.sidebar.caption(
    "IncludEd v2.0 – Adaptive Learning for Students with Learning Disabilities in Rwanda\n\n"
    "BSc. Software Engineering · Ivan Shema"
)

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 1: Student Reading Session
# ═══════════════════════════════════════════════════════════════════════════════

if page == "🎓 Student Session":
    st.title("🎓 Student Reading Session Simulator")
    st.markdown(
        "Simulate a complete reading session. Configure a student profile, start the session, "
        "and push telemetry events to see the RL agent adapt in real time."
    )

    # ── Session setup ────────────────────────────────────────────────────────
    st.markdown("### 1  Configure Student Profile")
    c1, c2, c3 = st.columns(3)
    with c1:
        student_id      = st.text_input("Student ID", value="test-student-001")
        disability_name = st.selectbox("Disability Profile", list(DISABILITY_OPTIONS.keys()))
        disability_enc  = DISABILITY_OPTIONS[disability_name]
    with c2:
        grade = st.selectbox("Grade Level", ["P3", "P4", "P5", "P6"])
        text_difficulty = st.slider("Text Difficulty", 0.0, 1.0, 0.5, 0.05)
    with c3:
        text_choice = st.selectbox("Reading Text", list(SAMPLE_TEXTS.keys()))

    reading_text = st.text_area(
        "Reading Text (editable)",
        value=SAMPLE_TEXTS[text_choice],
        height=160,
    )

    st.divider()
    st.markdown("### 2  Start Session")

    if "session_id" not in st.session_state:
        st.session_state.session_id       = None
        st.session_state.session_log      = []
        st.session_state.adapted_text     = ""
        st.session_state.action_history   = []

    col_start, col_end, _ = st.columns([1, 1, 4])
    with col_start:
        if st.button("▶ Start Session", type="primary"):
            resp = ai_post("/session/start", {
                "student_id":      student_id,
                "disability_type": disability_enc,
                "text_difficulty": text_difficulty,
            })
            if "error" in resp:
                st.error(f"Failed to start session: {resp['error']}")
            else:
                st.session_state.session_id     = resp["session_id"]
                st.session_state.session_log    = []
                st.session_state.action_history = []
                init_action = resp.get("initial_action", {})
                st.success(
                    f"✅ Session `{resp['session_id'][:8]}…` started\n\n"
                    f"Initial RL action: **{init_action.get('label', '—')}**"
                )
                st.session_state.action_history.append(init_action.get("id", 0))

    with col_end:
        if st.button("⏹ End Session") and st.session_state.session_id:
            quiz_score = st.session_state.get("quiz_score_input", 0.75)
            resp = ai_post("/session/end", {
                "session_id":     st.session_state.session_id,
                "quiz_score":     quiz_score,
                "completion_rate": 1.0,
            })
            if "error" in resp:
                st.error(f"Error ending session: {resp['error']}")
            else:
                sess = resp.get("session", {})
                st.success(
                    f"✅ Session ended  |  "
                    f"**Final Reward:** {sess.get('final_reward', '—')}  |  "
                    f"**Avg Attention:** {sess.get('avg_attention', '—')}"
                )
                st.session_state.session_id = None

    # ── Telemetry control ────────────────────────────────────────────────────
    if st.session_state.session_id:
        st.divider()
        st.markdown(f"### 3  Push Telemetry   `Session: {st.session_state.session_id[:12]}…`")
        st.markdown("Adjust the sliders to simulate how the student is interacting.")

        tc1, tc2 = st.columns(2)
        with tc1:
            reading_speed_wpm  = st.slider("Reading Speed (WPM)",  10,  250, 90)
            mouse_dwell        = st.slider("Mouse Dwell (sec)",     0.0, 6.0, 1.0, 0.1)
            scroll_back_count  = st.slider("Scroll-backs (30s)",    0,   10,  2)
        with tc2:
            key_latency        = st.slider("Key Latency (ms)",      0,  2000, 300)
            idle_duration      = st.slider("Idle Duration (sec)",   0.0, 20.0, 1.0, 0.5)
            backtrack_count    = st.slider("Re-reads (total)",      0,   8,   1)

        if st.button("📡 Push Telemetry & Get RL Action"):
            telemetry = {
                "reading_speed_wpm": reading_speed_wpm,
                "mouse_dwell":       mouse_dwell,
                "scroll_back_count": scroll_back_count,
                "key_latency":       key_latency,
                "idle_duration":     idle_duration,
                "backtrack_count":   backtrack_count,
                "timestamp":         time.time(),
            }
            resp = ai_post("/session/telemetry", {
                "session_id": st.session_state.session_id,
                "telemetry":  telemetry,
            })

            if "error" in resp:
                st.error(f"Error: {resp['error']}")
            else:
                action = resp.get("action", {})
                attn   = resp.get("attention_score", "—")
                fat    = resp.get("session_fatigue", "—")
                st.session_state.action_history.append(action.get("id", 0))
                log_entry = {
                    "step":             len(st.session_state.action_history),
                    "action_id":        action.get("id"),
                    "action_label":     action.get("label"),
                    "attention_score":  attn,
                    "session_fatigue":  fat,
                    "reading_speed_wpm": reading_speed_wpm,
                }
                st.session_state.session_log.append(log_entry)

                aid = action.get("id", 0)
                st.markdown(
                    f"**RL Decision:** {action_badge(aid)}  "
                    f"  |  Attention: **{round(attn, 3) if isinstance(attn, float) else attn}**  "
                    f"  |  Fatigue: **{round(fat, 3) if isinstance(fat, float) else fat}**",
                    unsafe_allow_html=True,
                )

                # Fetch adapted text preview
                adapt_resp = ai_post("/adapt-text", {
                    "text":             reading_text,
                    "text_difficulty":  text_difficulty,
                    "student_focus":    attn if isinstance(attn, float) else 0.6,
                    "disability_profile": {
                        "disabilities": (
                            ["dyslexia"] if disability_enc == 0.5
                            else ["adhd"] if disability_enc == 1.0
                            else []
                        )
                    },
                })
                if "adaptedText" in adapt_resp:
                    st.session_state.adapted_text = adapt_resp["adaptedText"]

        # Adapted text display
        if st.session_state.adapted_text:
            st.divider()
            st.markdown("### 4  Adapted Text Preview")
            
            # Check if we should show sync TTS
            is_tts = "[AI: ENABLE TTS + HIGHLIGHTS]" in st.session_state.adapted_text
            
            if is_tts:
                if st.button("🔊 Generate TTS & Start Listening"):
                    with st.spinner("Generating synthesized voice..."):
                        clean_text = st.session_state.adapted_text.replace("[AI: ENABLE TTS + HIGHLIGHTS]\n", "")
                        tts_data = ai_post("/tts/generate", {"text": clean_text})
                        if "audio_base64" in tts_data:
                            render_synchronized_tts(
                                tts_data["audio_base64"], 
                                tts_data["timestamps"],
                                clean_text
                            )
                        else:
                            st.error("Failed to generate TTS.")
            else:
                st.text_area("Current Adaptation", value=st.session_state.adapted_text, height=200)

        # Session log
        if st.session_state.session_log:
            st.divider()
            st.markdown("### 5  Session Log")
            df = pd.DataFrame(st.session_state.session_log)
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=df["step"], y=df["attention_score"],
                mode="lines+markers", name="Attention Score",
                line=dict(color="#3b82f6", width=2),
            ))
            fig.add_trace(go.Scatter(
                x=df["step"], y=df["session_fatigue"],
                mode="lines+markers", name="Session Fatigue",
                line=dict(color="#ef4444", width=2, dash="dash"),
            ))
            fig.update_layout(
                title="Attention & Fatigue Over Session",
                xaxis_title="Step", yaxis_title="Score (0–1)",
                height=280, margin=dict(t=40, b=20),
            )
            st.plotly_chart(fig, use_container_width=True)

            st.markdown("**Action history:**")
            badges = "  ".join(
                action_badge(r["action_id"])
                for r in st.session_state.session_log
            )
            st.markdown(badges, unsafe_allow_html=True)

        # Quiz score input (used at session end)
        st.divider()
        st.markdown("### 6  Quiz Score (set before ending session)")
        st.session_state["quiz_score_input"] = st.slider(
            "Quiz Score (0=0%, 1=100%)", 0.0, 1.0, 0.75, 0.05
        )

    else:
        st.info("⬆️ Start a session above to begin testing.")


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 2: Attention Monitor
# ═══════════════════════════════════════════════════════════════════════════════

elif page == "🧠 Attention Monitor":
    st.title("🧠 Attention Monitor")
    st.markdown(
        "Feed raw telemetry values into the AI service and inspect the computed "
        "focus score and RL action. Helps you understand how the system reacts to "
        "different student behaviours."
    )

    st.markdown("### Configure Telemetry")
    mc1, mc2 = st.columns(2)
    with mc1:
        m_disability = st.selectbox("Disability Profile", list(DISABILITY_OPTIONS.keys()), key="m_dis")
        m_difficulty = st.slider("Text Difficulty", 0.0, 1.0, 0.5, key="m_diff")
        m_wpm        = st.slider("Reading Speed (WPM)", 10, 250, 80, key="m_wpm")
        m_dwell      = st.slider("Mouse Dwell (sec)", 0.0, 6.0, 2.5, 0.1, key="m_dwell")
    with mc2:
        m_scroll     = st.slider("Scroll-backs (30s)", 0, 10, 3, key="m_scroll")
        m_latency    = st.slider("Key Latency (ms)", 0, 2000, 600, key="m_lat")
        m_idle       = st.slider("Idle Duration (sec)", 0.0, 20.0, 5.0, 0.5, key="m_idle")
        m_backtrack  = st.slider("Re-reads (total)", 0, 8, 3, key="m_bt")

    disability_enc = DISABILITY_OPTIONS[m_disability]
    session_fatigue = st.slider("Session Fatigue", 0.0, 1.0, 0.2, 0.05, key="m_fat")

    if st.button("🔍 Compute Attention State & RL Action", type="primary"):
        # Build 8-dim state vector directly for the /rl/predict endpoint
        # We approximate the normalised values here (monitor logic mirrors attention_monitor.py)
        MAX_WPM   = 200.0
        wpm_norm  = np.clip((m_wpm - 10) / (MAX_WPM - 10), 0, 1)
        dwell_n   = np.clip(m_dwell / 3.0, 0, 1)
        scroll_n  = np.clip(m_scroll / 5.0, 0, 1)
        bt_n      = np.clip(m_backtrack / 4.0, 0, 1)
        idle_flag = 1.0 if m_idle >= 8.0 else 0.0
        neg_sig   = 0.30*dwell_n + 0.25*scroll_n + 0.25*bt_n + 0.20*idle_flag
        focus     = float(np.clip((1.0 - neg_sig)*0.7 + wpm_norm*0.3, 0, 1))

        state_vector = [
            float(wpm_norm),
            float(dwell_n),
            float(scroll_n),
            float(bt_n),
            focus,
            disability_enc,
            m_difficulty,
            session_fatigue,
        ]

        resp = ai_post("/rl/predict", {"state_vector": state_vector})

        st.divider()
        st.markdown("### Results")
        r1, r2, r3, r4 = st.columns(4)
        r1.metric("Focus Score",      f"{focus:.3f}")
        r2.metric("Reading Speed",    f"{wpm_norm:.3f}  (norm)")
        r3.metric("Confusion Signals", f"{neg_sig:.3f}")
        r4.metric("Attention Lapse",  "Yes" if m_idle >= 8.0 else "No")

        if "error" not in resp:
            action_id    = resp.get("action_id", 0)
            action_label = resp.get("action_label", "?")
            model_used   = resp.get("model_used", "?")

            st.markdown(f"**RL Decision:** {action_badge(action_id)}", unsafe_allow_html=True)
            st.caption(f"_Model: {model_used}_")

            # Draw gauge
            fig = go.Figure(go.Indicator(
                mode  = "gauge+number",
                value = focus,
                title = {"text": "Student Focus Score", "font": {"size": 18}},
                gauge = {
                    "axis": {"range": [0, 1]},
                    "bar":  {"color": "#3b82f6"},
                    "steps": [
                        {"range": [0.0, 0.35], "color": "#fde68a"},
                        {"range": [0.35, 0.65], "color": "#bbf7d0"},
                        {"range": [0.65, 1.0],  "color": "#86efac"},
                    ],
                    "threshold": {
                        "line":  {"color": "#ef4444", "width": 4},
                        "thickness": 0.75,
                        "value": 0.35,
                    },
                },
            ))
            fig.update_layout(height=280, margin=dict(t=30, b=0))
            st.plotly_chart(fig, use_container_width=True)

            # Full state vector table
            with st.expander("📐 Full 8-dim State Vector"):
                labels = [
                    "reading_speed","mouse_dwell","scroll_hesitation",
                    "backtrack_freq","attention_score","disability_type",
                    "text_difficulty","session_fatigue",
                ]
                st.dataframe(
                    pd.DataFrame({"dimension": labels, "value": state_vector}),
                    use_container_width=True, hide_index=True,
                )
        else:
            st.error(f"AI service error: {resp['error']}")


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 3: Teacher Dashboard
# ═══════════════════════════════════════════════════════════════════════════════

elif page == "📊 Teacher Dashboard":
    st.title("📊 Teacher Dashboard")
    st.markdown(
        "Aggregate performance data from the AI service analytics endpoint. "
        "In production this also connects to the Node.js backend."
    )

    if st.button("🔄 Refresh Data"):
        st.cache_data.clear()

    # AI service analytics
    st.markdown("### AI Service Analytics (Live Sessions)")
    ai_analytics = ai_get("/analytics/summary")

    if "error" in ai_analytics:
        st.warning(f"Could not reach AI Service: {ai_analytics['error']}")
    else:
        total = ai_analytics.get("total_sessions", 0)
        avg_attn  = ai_analytics.get("overall_avg_attention")
        avg_quiz  = ai_analytics.get("overall_avg_quiz")

        m1, m2, m3 = st.columns(3)
        m1.metric("Total Sessions Recorded", total)
        m2.metric("Overall Avg Attention",   f"{avg_attn:.3f}" if avg_attn else "—")
        m3.metric("Overall Avg Quiz Score",  f"{avg_quiz:.3f}" if avg_quiz else "—")

        by_dis = ai_analytics.get("by_disability", {})
        if by_dis:
            st.markdown("#### Performance by Disability Type")
            rows = []
            for key, vals in by_dis.items():
                rows.append({
                    "Disability":     key.title(),
                    "Sessions":       vals.get("count", 0),
                    "Avg Attention":  vals.get("avg_attention"),
                    "Avg Quiz":       vals.get("avg_quiz_score"),
                    "Avg Completion": vals.get("avg_completion"),
                    "Avg Reward":     vals.get("avg_final_reward"),
                })
            df_dis = pd.DataFrame(rows)
            st.dataframe(df_dis, use_container_width=True, hide_index=True)

            # Bar chart
            fig = px.bar(
                df_dis, x="Disability", y=["Avg Attention", "Avg Quiz", "Avg Completion"],
                barmode="group", title="Key Metrics by Disability Type",
                color_discrete_sequence=["#3b82f6", "#10b981", "#f59e0b"],
            )
            fig.update_layout(height=320, margin=dict(t=40, b=20))
            st.plotly_chart(fig, use_container_width=True)

        recent = ai_analytics.get("recent_sessions", [])
        if recent:
            st.markdown("#### Recent Sessions")
            df_recent = pd.DataFrame(recent)[[
                "session_id", "student_id", "disability_type",
                "avg_attention", "quiz_score", "completion_rate",
                "final_reward", "total_rl_actions",
            ]].copy()
            df_recent["session_id"] = df_recent["session_id"].str[:8] + "…"
            st.dataframe(df_recent, use_container_width=True, hide_index=True)

            # Scatter plot: attention vs quiz
            df_scatter = pd.DataFrame(recent).dropna(subset=["quiz_score"])
            if not df_scatter.empty:
                fig2 = px.scatter(
                    df_scatter,
                    x="avg_attention", y="quiz_score",
                    color="disability_type",
                    size="total_rl_actions",
                    title="Attention Score vs Quiz Score (per session)",
                    labels={"avg_attention": "Avg Attention", "quiz_score": "Quiz Score"},
                    color_discrete_map={"0.0": "#6b7280", "0.5": "#3b82f6", "1.0": "#ef4444"},
                )
                fig2.update_layout(height=320, margin=dict(t=40, b=20))
                st.plotly_chart(fig2, use_container_width=True)
        else:
            st.info("No session data yet. Run some sessions on the Student Session page first.")

    # Backend analytics (if available with token)
    st.divider()
    st.markdown("### Backend Analytics (Node.js)")
    st.caption("Requires a teacher/admin JWT token to access the backend API.")
    token = st.text_input("JWT Token (optional)", type="password")
    if token and st.button("Fetch Class Analytics"):
        class_data = backend_get("/api/analytics/class", token)
        if "error" in class_data:
            st.error(f"Backend error: {class_data['error']}")
        else:
            ov = class_data.get("overview", {})
            bc1, bc2, bc3, bc4 = st.columns(4)
            bc1.metric("Total Students",   ov.get("totalStudents"))
            bc2.metric("Total Sessions",   ov.get("totalSessions"))
            bc3.metric("Avg Quiz Score",   ov.get("avgQuizScore"))
            bc4.metric("Avg Attention",    ov.get("avgAttention"))

            dis_data = class_data.get("byDisabilityType", [])
            if dis_data:
                st.dataframe(pd.DataFrame(dis_data), use_container_width=True, hide_index=True)

    # Video Captioning Tool
    st.divider()
    st.markdown("### 🎥 Video Processing & Captioning")
    st.caption("Upload a video or audio file to generate WebVTT captions using AI transcription.")
    
    uploaded_video = st.file_uploader("Upload Video/Audio", type=["mp4", "mp3", "wav", "m4a", "mov"])
    
    if uploaded_video:
        if st.button("📝 Transcribe & Generate Captions", type="primary"):
            with st.spinner("Transcribing video... This may take a moment depending on length."):
                # Prepare file for upload
                files = {"file": (uploaded_video.name, uploaded_video.getvalue())}
                try:
                    r = requests.post(f"{AI_SERVICE_URL}/video/transcribe", files=files, timeout=300)
                    transcription = r.json()
                    
                    if "vtt" in transcription:
                        st.success("✅ Transcription complete!")
                        
                        vtt_content = transcription["vtt"]
                        
                        col1, col2 = st.columns(2)
                        with col1:
                            st.markdown("#### Preview Captions")
                            st.text_area("WebVTT Content", value=vtt_content, height=300)
                            st.download_button(
                                "📥 Download .vtt File",
                                vtt_content,
                                file_name=f"{uploaded_video.name.split('.')[0]}.vtt",
                                mime="text/vtt"
                            )
                        
                        with col2:
                            st.markdown("#### Video Preview")
                            # Note: Native Streamlit st.video doesn't support caption tracks easily
                            # We'd need custom HTML for that, but we can show the video here.
                            st.video(uploaded_video)
                            st.info("The downloaded .vtt file can be used in your preferred video player (e.g., VLC, YouTube) to provide accessible captions.")
                    else:
                        st.error(f"Transcription failed: {transcription.get('error', 'Unknown error')}")
                except Exception as e:
                    st.error(f"Error connecting to AI Service: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 4: RL Inspector
# ═══════════════════════════════════════════════════════════════════════════════

elif page == "🤖 RL Inspector":
    st.title("🤖 RL Model Inspector")
    st.markdown(
        "Inspect the loaded PPO model, explore the action space, and test "
        "arbitrary state vectors to understand the policy."
    )

    # Model status
    st.markdown("### Model Status")
    status = ai_get("/rl/status")
    if "error" in status:
        st.error(f"Cannot reach AI service: {status['error']}")
    else:
        s1, s2, s3 = st.columns(3)
        s1.metric("Model Loaded",   "✅ Yes" if status.get("model_loaded") else "⚠️ No (fallback)")
        s2.metric("State Dims",     status.get("state_dims", "—"))
        s3.metric("Model Path",     (status.get("model_path") or "rule-based fallback")[-40:])

        with st.expander("📁 State Dimension Labels"):
            labels = status.get("state_labels", [])
            for i, lbl in enumerate(labels):
                st.markdown(f"- **dim {i}:** `{lbl}`")

        with st.expander("🎮 Action Space"):
            for aid, label in (status.get("action_space") or ACTION_LABELS).items():
                color = ACTION_COLORS.get(int(aid), "#6b7280")
                st.markdown(
                    f'<span style="background:{color};color:white;padding:2px 8px;border-radius:8px">'
                    f'{aid}</span>  **{label}**',
                    unsafe_allow_html=True,
                )

    st.divider()
    if st.button("🔃 Reload Model"):
        r = ai_post("/rl/reload", {})
        st.json(r)

    # ── Manual state probe ────────────────────────────────────────────────────
    st.markdown("### Probe Policy: Custom State Vector")
    st.markdown(
        "Set each state dimension manually and see what action the RL policy selects. "
        "Ideal for checking that the policy has learned correct disability-specific behaviours."
    )

    dim_labels = [
        "reading_speed", "mouse_dwell", "scroll_hesitation",
        "backtrack_freq", "attention_score", "disability_type",
        "text_difficulty", "session_fatigue",
    ]
    dim_defaults = [0.5, 0.2, 0.1, 0.1, 0.8, 0.0, 0.5, 0.1]
    dim_hints = [
        "0=very slow, 1=fast", "0=none, 1=long hover", "0=smooth, 1=many backscrolls",
        "0=none, 1=frequent", "0=distracted, 1=focused",
        "0=none, 0.5=dyslexia, 1.0=ADHD", "0=easy, 1=hard", "0=fresh, 1=exhausted",
    ]

    sv = []
    probe_cols = st.columns(4)
    for i, (lbl, dflt, hint) in enumerate(zip(dim_labels, dim_defaults, dim_hints)):
        col_idx = i % 4
        with probe_cols[col_idx]:
            val = st.slider(
                f"`{lbl}`",
                min_value=0.0 if lbl != "disability_type" else 0.0,
                max_value=1.0,
                value=dflt,
                step=0.05 if lbl != "disability_type" else 0.5,
                help=hint,
                key=f"probe_{i}",
            )
            sv.append(val)

    if st.button("🎯 Predict Action", type="primary"):
        resp = ai_post("/rl/predict", {"state_vector": sv})
        if "error" in resp:
            st.error(f"Error: {resp['error']}")
        else:
            a_id  = resp.get("action_id", 0)
            a_lbl = resp.get("action_label", "—")
            m_used = resp.get("model_used", "—")
            st.markdown(f"**Predicted Action:** {action_badge(a_id)}", unsafe_allow_html=True)
            st.caption(f"Model: _{m_used}_")

    # ── Scenario sweep ────────────────────────────────────────────────────────
    st.divider()
    st.markdown("### Scenario Sweep")
    st.markdown(
        "Automatically probe the policy across all three disability types at "
        "varying attention levels to verify expected behaviour."
    )

    if st.button("▶ Run Sweep (9 scenarios)"):
        scenarios = []
        for disability in [0.0, 0.5, 1.0]:
            for attn in [0.2, 0.5, 0.9]:
                state = [0.5, 0.2, 0.2, 0.2, attn, disability, 0.6, 0.2]
                resp = ai_post("/rl/predict", {"state_vector": state})
                a_id  = resp.get("action_id", -1)
                a_lbl = resp.get("action_label", "error")
                dis_name = {0.0: "None", 0.5: "Dyslexia", 1.0: "ADHD"}.get(disability, "?")
                scenarios.append({
                    "Disability":       dis_name,
                    "Attention Level":  f"{attn:.1f}",
                    "Action ID":        a_id,
                    "Action Label":     a_lbl,
                })

        df_sweep = pd.DataFrame(scenarios)
        st.dataframe(df_sweep, use_container_width=True, hide_index=True)

        # Sanity check messages
        def check(df, dis, attn_max, expected_actions):
            sub = df[(df["Disability"] == dis) & (df["Action ID"].isin(expected_actions))]
            low_attn = df[(df["Disability"] == dis) & (df["Attention Level"].astype(float) <= attn_max)]
            return len(low_attn) > 0 and all(
                row["Action ID"] in expected_actions
                for _, row in low_attn.iterrows()
            )

        st.markdown("**Policy Sanity Checks:**")
        results_ok = [
            ("Dyslexia at low attention → TTS/Syllable Break (3 or 4)",
             check(df_sweep, "Dyslexia", 0.5, [3, 4])),
            ("ADHD at low attention → Attention Break/Heavy Simplif. (5 or 2)",
             check(df_sweep, "ADHD", 0.5, [5, 2])),
            ("None at high attention → Keep Original/Light (0 or 1)",
             check(df_sweep, "None", 0.9, [0, 1])),
        ]
        for desc, ok in results_ok:
            st.markdown(f"{'✅' if ok else '❌'} {desc}")
