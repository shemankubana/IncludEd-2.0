#!/usr/bin/env python3
"""
IncludEd 2.0 – Performance Benchmark Suite
==========================================
Verifies all thesis performance metrics against running services.

Usage:
  python3 scripts/benchmark.py
  python3 scripts/benchmark.py --backend http://localhost:3000 --ai http://localhost:8082
  python3 scripts/benchmark.py --token YOUR_FIREBASE_JWT_TOKEN
  python3 scripts/benchmark.py --runs 20 --token YOUR_TOKEN

Metrics verified:
  1. RL inference latency        — target < 500ms
  2. Book Brain analysis (~50p)  — informational
  3. Quiz generation (5 Qs)      — informational
  4. TTS synthesis (100 words)   — informational
  5. Backend API CRUD (p95)      — target < 120ms
  6. Session write at close      — target < 200ms
  7. Fallback on AI down         — target < 50ms
  (8. Dashboard load — browser-only, printed as manual instruction)
"""

import argparse
import statistics
import sys
import time
from datetime import datetime
from typing import List, Optional

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: pip install requests")

# ── Defaults ──────────────────────────────────────────────────────────────────
DEFAULT_BACKEND = "http://localhost:3000"
DEFAULT_AI      = "http://localhost:8082"
DEFAULT_RUNS    = 10

# ── ANSI colours ──────────────────────────────────────────────────────────────
GREEN  = "\033[0;32m"
RED    = "\033[0;31m"
YELLOW = "\033[0;33m"
CYAN   = "\033[0;36m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"

# ── Sample data ───────────────────────────────────────────────────────────────

# Exactly ~100 words for TTS
SAMPLE_100_WORDS = (
    "The sun rose slowly over the hills, casting long golden shadows across the "
    "quiet village. Children ran through the narrow streets, laughing and calling "
    "to each other. An old man sat outside his shop, watching them with a smile. "
    "The market was already busy with traders arranging their colourful goods. "
    "Somewhere in the distance a rooster crowed, announcing the start of another "
    "warm and beautiful morning full of promise and possibility for everyone."
)

# 9-dim RL state vector [reading_speed, mouse_dwell, scroll_hesitation,
#   backtrack_freq, attention_score, disability_type, text_difficulty,
#   session_fatigue, content_type]
RL_STATE_VECTOR = [0.5, 0.3, 0.2, 0.1, 0.6, 0.5, 0.4, 0.2, 0.5]

# Approx 50-page text (~12,500 words) for Book Brain
_PARA = (
    "Alice was beginning to get very tired of sitting by her sister on the bank, "
    "and of having nothing to do: once or twice she had peeped into the book her "
    "sister was reading, but it had no pictures or conversations in it, and what "
    "is the use of a book, thought Alice, without pictures or conversations? "
    "So she was considering in her own mind, as well as she could, whether the "
    "pleasure of making a daisy-chain would be worth the trouble of getting up "
    "and picking the daisies, when suddenly a White Rabbit with pink eyes ran "
    "close by her. "
)
SAMPLE_50_PAGE_TEXT = "\n\n".join(
    [f"Chapter {i+1}\n\n" + (_PARA * 6) for i in range(50)]
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def section(title: str) -> None:
    print(f"\n{CYAN}{'═' * 52}{RESET}")
    print(f"{CYAN}  {title}{RESET}")
    print(f"{CYAN}{'═' * 52}{RESET}")


def p95(times: List[float]) -> float:
    s = sorted(times)
    return s[min(int(len(s) * 0.95), len(s) - 1)]


def fmt_ms(ms: float) -> str:
    return f"{ms:.1f}ms" if ms < 1000 else f"{ms/1000:.2f}s"


def pass_fail(ok: bool) -> str:
    return f"{GREEN}✓ PASS{RESET}" if ok else f"{RED}✗ FAIL{RESET}"


def time_call(fn, timeout: int = 30) -> float:
    """Returns elapsed ms."""
    t0 = time.perf_counter()
    fn()
    return (time.perf_counter() - t0) * 1000


# ── Benchmarks ────────────────────────────────────────────────────────────────

def check_connectivity(backend: str, ai: str) -> tuple[bool, bool]:
    section("Connectivity")
    be_ok = ai_ok = False
    for name, url in [("Backend   ", backend + "/"), ("AI service", ai + "/health")]:
        try:
            r = requests.get(url, timeout=3)
            print(f"  {GREEN}✓{RESET} {name}  HTTP {r.status_code}  ({url})")
            if "Backend" in name:
                be_ok = True
            else:
                ai_ok = True
        except Exception as e:
            print(f"  {RED}✗{RESET} {name}  unreachable — {e}")
    return be_ok, ai_ok


def bench_rl_predict(ai: str, runs: int) -> None:
    section(f"1. RL Inference Latency  (n={runs}, target < 500ms)")
    url     = f"{ai}/rl/predict"
    payload = {"state_vector": RL_STATE_VECTOR, "content_type": 0.5}
    times: List[float] = []
    fallback_active = False

    for _ in range(runs):
        try:
            t0 = time.perf_counter()
            r  = requests.post(url, json=payload, timeout=5)
            times.append((time.perf_counter() - t0) * 1000)
            if r.status_code == 200 and r.json().get("fallback"):
                fallback_active = True
        except Exception as e:
            print(f"  {RED}✗ request failed: {e}{RESET}")
            return

    avg    = statistics.mean(times)
    median = statistics.median(times)
    p95v   = p95(times)
    ok     = avg < 500

    print(f"  mean   {fmt_ms(avg):>10}   {pass_fail(ok)}")
    print(f"  median {fmt_ms(median):>10}")
    print(f"  p95    {fmt_ms(p95v):>10}")
    print(f"  min    {fmt_ms(min(times)):>10}   max {fmt_ms(max(times))}")

    if fallback_active:
        print(f"\n  {YELLOW}⚠ model_ready=False — rule-based fallback is active{RESET}")
        print(f"  {DIM}  PPO model not loaded; latency reflects heuristic, not RL inference{RESET}")
    else:
        print(f"\n  {GREEN}✓ PPO model loaded (fallback=False){RESET}")


def bench_book_brain(ai: str) -> None:
    section("2. Book Brain Analysis  (~50-page text, informational)")
    url = f"{ai}/book-brain/analyze"
    payload = {"text": SAMPLE_50_PAGE_TEXT, "title": "Benchmark Test Book"}
    print(f"  Sending ~{len(SAMPLE_50_PAGE_TEXT)//1000}k chars … (may take 8–14s)")
    try:
        t0 = time.perf_counter()
        r  = requests.post(url, json=payload, timeout=120)
        elapsed = (time.perf_counter() - t0) * 1000
        if r.status_code == 200:
            print(f"  {GREEN}✓{RESET} completed in {fmt_ms(elapsed)}  (reference: 8–14s)")
        else:
            print(f"  {RED}✗{RESET} HTTP {r.status_code}: {r.text[:200]}")
    except requests.exceptions.Timeout:
        print(f"  {RED}✗{RESET} timed out after 120s")
    except Exception as e:
        print(f"  {RED}✗{RESET} {e}")


def bench_quiz_generation(ai: str) -> None:
    section("3. Quiz Generation  (5 questions, informational)")
    url = f"{ai}/quiz/generate"
    payload = {
        "text": SAMPLE_50_PAGE_TEXT[:3000],
        "num_questions": 5,
        "difficulty": "medium",
    }
    print("  Generating 5 questions …")
    try:
        t0 = time.perf_counter()
        r  = requests.post(url, json=payload, timeout=60)
        elapsed = (time.perf_counter() - t0) * 1000
        if r.status_code == 200:
            data = r.json()
            count = len(data.get("questions", data.get("quiz", [])))
            print(f"  {GREEN}✓{RESET} {count} questions in {fmt_ms(elapsed)}  (reference: 12–18s)")
        else:
            print(f"  {RED}✗{RESET} HTTP {r.status_code}: {r.text[:200]}")
    except requests.exceptions.Timeout:
        print(f"  {RED}✗{RESET} timed out after 60s")
    except Exception as e:
        print(f"  {RED}✗{RESET} {e}")


def bench_tts(ai: str) -> None:
    section("4. TTS Synthesis  (~100 words, informational)")
    url     = f"{ai}/tts/synthesize"
    payload = {"text": SAMPLE_100_WORDS, "disability_type": "none", "language": "en"}
    word_count = len(SAMPLE_100_WORDS.split())
    print(f"  Synthesising {word_count} words …")
    try:
        t0 = time.perf_counter()
        r  = requests.post(url, json=payload, timeout=30)
        elapsed = (time.perf_counter() - t0) * 1000
        if r.status_code == 200:
            data = r.json()
            kb   = len(data.get("audio_base64", "")) * 3 // 4 // 1024
            print(f"  {GREEN}✓{RESET} {fmt_ms(elapsed)}  (~{kb}KB audio)  (reference: ~2.1s)")
        else:
            print(f"  {RED}✗{RESET} HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"  {RED}✗{RESET} {e}")


def bench_backend_crud(backend: str, token: Optional[str], runs: int) -> None:
    section(f"5. Backend API Response  (p95, n={runs}, target < 120ms)")
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    endpoints = [
        ("GET /api/literature",        "GET",  f"{backend}/api/literature"),
        ("GET /api/auth/me",            "GET",  f"{backend}/api/auth/me"),
        ("GET /api/analytics/overview", "GET",  f"{backend}/api/analytics/overview"),
    ]

    if not token:
        print(f"  {YELLOW}⚠ No --token provided — unauthenticated requests may return 401/403{RESET}")

    for label, method, url in endpoints:
        times: List[float] = []
        error = None
        for _ in range(runs):
            try:
                t0 = time.perf_counter()
                requests.get(url, headers=headers, timeout=5)
                times.append((time.perf_counter() - t0) * 1000)
            except Exception as e:
                error = str(e)
                break

        if error:
            print(f"  {RED}✗{RESET} {label}: {error}")
            continue

        avg   = statistics.mean(times)
        p95v  = p95(times)
        ok    = p95v < 120
        print(f"  {pass_fail(ok)}  {label}")
        print(f"           mean={fmt_ms(avg)}  p95={fmt_ms(p95v)}  min={fmt_ms(min(times))}")


def bench_session_write(backend: str, token: Optional[str], runs: int) -> None:
    section(f"6. Session Write at Close  (n={runs}, target < 200ms)")

    if not token:
        print(f"  {YELLOW}⚠ Skipped — requires --token (Firebase JWT) to create sessions{RESET}")
        print(f"  {DIM}  Get token: in browser console → firebase.auth().currentUser.getIdToken(){RESET}")
        return

    headers = {
        "Content-Type":  "application/json",
        "Authorization": f"Bearer {token}",
    }

    # Create a disposable session first
    session_id = None
    try:
        r = requests.post(f"{backend}/api/sessions", json={
            "literatureId": 1, "disabilityType": "none", "textDifficulty": 0.5
        }, headers=headers, timeout=5)
        if r.status_code in (200, 201):
            data = r.json()
            session_id = data.get("id") or data.get("sessionId")
    except Exception as e:
        print(f"  {YELLOW}⚠ Could not create test session: {e}{RESET}")
        return

    if not session_id:
        print(f"  {YELLOW}⚠ Session creation returned no ID (check token + literatureId=1 exists){RESET}")
        return

    patch_payload = {
        "status":             "completed",
        "avgAttentionScore":  0.72,
        "avgSessionFatigue":  0.3,
        "completionRate":     0.95,
        "quizScore":          4,
        "quizAttempts":       5,
        "finalReward":        0.8,
        "rlActionsCount":     12,
        "rlActionsSummary":   {"0": 5, "1": 4, "3": 3},
    }

    times: List[float] = []
    for _ in range(runs):
        try:
            t0 = time.perf_counter()
            requests.patch(
                f"{backend}/api/sessions/{session_id}",
                json=patch_payload, headers=headers, timeout=5
            )
            times.append((time.perf_counter() - t0) * 1000)
        except Exception as e:
            print(f"  {RED}✗ PATCH failed: {e}{RESET}")
            return

    avg  = statistics.mean(times)
    p95v = p95(times)
    ok   = avg < 200
    print(f"  {pass_fail(ok)}  PATCH /api/sessions/{session_id}")
    print(f"           mean={fmt_ms(avg)}  p95={fmt_ms(p95v)}  min={fmt_ms(min(times))}")


def bench_fallback(ai: str, backend: str, token: Optional[str]) -> None:
    section("7. Fallback Activation  (AI service down, target < 50ms)")

    # Probe AI service status
    ai_up = False
    try:
        requests.get(f"{ai}/health", timeout=2)
        ai_up = True
    except Exception:
        pass

    # ── Case A: AI service is UP — check its own rule-based fallback ──────────
    if ai_up:
        url     = f"{ai}/rl/predict"
        payload = {"state_vector": RL_STATE_VECTOR, "content_type": 0.5}
        times: List[float] = []
        for _ in range(10):
            try:
                t0 = time.perf_counter()
                r  = requests.post(url, json=payload, timeout=5)
                times.append((time.perf_counter() - t0) * 1000)
            except Exception as e:
                print(f"  {RED}✗ {e}{RESET}")
                return

        avg  = statistics.mean(times)
        is_fallback = r.status_code == 200 and r.json().get("fallback", False)

        if is_fallback:
            ok = avg < 50
            print(f"  {pass_fail(ok)}  Rule-based fallback (model not loaded)")
            print(f"           mean={fmt_ms(avg)}  (target < 50ms)")
        else:
            print(f"  {GREEN}✓{RESET}  PPO model IS loaded — fallback not exercised")
            print(f"           mean response={fmt_ms(avg)}")
            print(f"\n  {DIM}To test < 50ms fallback path:{RESET}")
            print(f"  {DIM}  1. Stop the AI service{RESET}")
            print(f"  {DIM}  2. Re-run: python3 scripts/benchmark.py --token YOUR_TOKEN{RESET}")

    # ── Case B: AI service is DOWN — measure backend's fallback path ──────────
    else:
        print(f"  {YELLOW}· AI service is DOWN{RESET}")
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        times: List[float] = []
        for _ in range(10):
            try:
                t0 = time.perf_counter()
                requests.post(
                    f"{backend}/api/sessions/0/rl-predict",
                    json={"state_vector": RL_STATE_VECTOR, "disability_type": "dyslexia"},
                    headers=headers, timeout=5
                )
                times.append((time.perf_counter() - t0) * 1000)
            except Exception as e:
                print(f"  {RED}✗ {e}{RESET}")
                return

        avg = statistics.mean(times)
        ok  = avg < 50
        print(f"  {pass_fail(ok)}  Backend fallback (AI unreachable)")
        print(f"           mean={fmt_ms(avg)}  (target < 50ms)")


def print_manual_metrics() -> None:
    section("8. Student Dashboard Load  (browser metric)")
    print(f"  This metric requires a browser — run either:")
    print()
    print(f"  {CYAN}Option A – Lighthouse CLI:{RESET}")
    print(f"    npx lighthouse http://localhost:5173/student \\")
    print(f"      --only-categories=performance --output=json \\")
    print(f"      | python3 -c \"import sys,json; d=json.load(sys.stdin); \\")
    print(f"        print('LCP:', d['audits']['largest-contentful-paint']['displayValue'])\"")
    print()
    print(f"  {CYAN}Option B – Chrome DevTools:{RESET}")
    print(f"    DevTools → Network → Disable cache → hard-reload")
    print(f"    Look for DOMContentLoaded and Load times in the status bar")
    print()
    print(f"  {CYAN}Option C – window.performance:{RESET}")
    print(f"    In browser console:")
    print(f"    performance.timing.loadEventEnd - performance.timing.navigationStart")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="IncludEd 2.0 — Performance Benchmark Suite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--backend", default=DEFAULT_BACKEND, metavar="URL",
                        help=f"Backend URL (default: {DEFAULT_BACKEND})")
    parser.add_argument("--ai",      default=DEFAULT_AI,      metavar="URL",
                        help=f"AI service URL (default: {DEFAULT_AI})")
    parser.add_argument("--token",   default=None,            metavar="JWT",
                        help="Firebase ID token for authenticated endpoints")
    parser.add_argument("--runs",    type=int, default=DEFAULT_RUNS, metavar="N",
                        help=f"Repetitions per latency test (default: {DEFAULT_RUNS})")
    parser.add_argument("--skip-slow", action="store_true",
                        help="Skip Book Brain and Quiz (they take 10–20s each)")
    args = parser.parse_args()

    print(f"\n{BOLD}IncludEd 2.0 — Performance Benchmark{RESET}")
    print(f"  Backend:    {args.backend}")
    print(f"  AI service: {args.ai}")
    print(f"  Runs/test:  {args.runs}")
    print(f"  Token:      {'provided' if args.token else 'not provided (session tests skipped)'}")
    print(f"  Time:       {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    be_ok, ai_ok = check_connectivity(args.backend, args.ai)

    if ai_ok:
        bench_rl_predict(args.ai, args.runs)
        if not args.skip_slow:
            bench_book_brain(args.ai)
            bench_quiz_generation(args.ai)
        else:
            print(f"\n{DIM}  [skipped] Book Brain & Quiz (--skip-slow){RESET}")
        bench_tts(args.ai)
    else:
        print(f"\n{YELLOW}⚠ AI service unreachable — skipping AI benchmarks{RESET}")

    if be_ok:
        bench_backend_crud(args.backend, args.token, args.runs)
        bench_session_write(args.backend, args.token, args.runs)
        bench_fallback(args.ai, args.backend, args.token)
    else:
        print(f"\n{YELLOW}⚠ Backend unreachable — skipping backend benchmarks{RESET}")

    print_manual_metrics()
    print()


if __name__ == "__main__":
    main()
