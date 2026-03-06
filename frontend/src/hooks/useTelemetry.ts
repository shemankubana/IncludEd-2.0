/**
 * useTelemetry.ts
 * ================
 * Lightweight telemetry engine for IncludEd Reader.
 *
 * Tracks:
 *  - Scroll speed and direction (backtracking detection)
 *  - Mouse/pointer pause duration (dwell time)
 *  - Click frequency
 *  - Time on current paragraph / section
 *  - Reading speed estimation (words per minute)
 *  - Attention lapses (long idle periods)
 *
 * Data is batched and sent to the backend every FLUSH_INTERVAL ms.
 * Falls back to localStorage when offline (IndexedDB queue).
 */

import { useRef, useEffect, useCallback, useState } from "react";

// ── Config ─────────────────────────────────────────────────────────────────────

const FLUSH_INTERVAL = 10_000; // ms between batch sends
const IDLE_THRESHOLD = 8_000;  // ms of no movement = attention lapse
const SCROLL_SAMPLE_RATE = 200;    // ms between scroll samples
const ATTENTION_REFRESH_RATE = 2_500;  // ms — real-time struggle score (D1)

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TelemetryEvent {
    type:
    | "scroll"
    | "mouse_pause"
    | "click"
    | "paragraph_enter"
    | "paragraph_exit"
    | "attention_lapse"
    | "backtrack"
    | "reading_speed";
    timestamp: number;
    payload: Record<string, number | string | boolean>;
}

export interface AttentionState {
    readingSpeedNorm: number; // [0,1] normalised from WPM
    mouseDwellNorm: number; // [0,1]
    scrollHesitation: number; // [0,1]
    backtrackFreq: number; // [0,1]
    attentionScore: number; // [0,1] composite
    sessionFatigue: number; // [0,1] accumulated fatigue
    touchPressureNorm: number; // [0,1] avg touch pressure — frustration proxy (D1)
    wordDwellMs: number; // ms spent on current visible word region (D1)
}

interface UseTelemetryOptions {
    sessionId: string | null;
    literatureId: string | null;
    idToken: string | null;
    onStateUpdate?: (state: AttentionState) => void;
}

// ── IndexedDB offline queue ────────────────────────────────────────────────────

const DB_NAME = "included_telemetry";
const STORE_NAME = "pending_events";
const DB_VERSION = 1;

async function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME, { autoIncrement: true });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function queueOffline(batch: TelemetryEvent[]): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.add({ batch, ts: Date.now() });
    } catch { /* silently ignore IDB errors */ }
}

async function drainOfflineQueue(idToken: string, sessionId: string): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = async () => {
            const items: { batch: TelemetryEvent[]; ts: number }[] = req.result;
            if (!items.length) return;
            for (const item of items) {
                await sendBatch(item.batch, idToken, sessionId);
            }
            store.clear();
        };
    } catch { /* silently ignore */ }
}

async function sendBatch(
    events: TelemetryEvent[],
    idToken: string,
    sessionId: string
): Promise<void> {
    try {
        await fetch(`${API_URL}/api/sessions/${sessionId}/telemetry`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ events }),
        });
    } catch {
        // Network unavailable — will be drained later
        await queueOffline(events);
    }
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useTelemetry({
    sessionId,
    literatureId,
    idToken,
    onStateUpdate,
}: UseTelemetryOptions) {
    // Event queue
    const queue = useRef<TelemetryEvent[]>([]);

    // Scroll tracking
    const lastScrollY = useRef(0);
    const lastScrollTime = useRef(Date.now());
    const scrollSpeeds = useRef<number[]>([]);
    const backtrackCount = useRef(0);
    const scrollEventCount = useRef(0);

    // Mouse dwell
    const lastMoveTime = useRef(Date.now());
    const dwellAccum = useRef(0);
    const dwellSamples = useRef(0);
    const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Click / touch pressure tracking
    const clickCount = useRef(0);
    const touchPressureAccum = useRef(0);   // sum of pointer pressures (0–1)
    const touchPressureCount = useRef(0);   // number of pressure samples

    // Word-level dwell: time elapsed on current visible word range
    const lastScrollStopTime = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wordDwellAccum = useRef(0);   // ms spent stationary on current word
    const wordDwellStart = useRef(Date.now());

    // Session timing
    const sessionStart = useRef(Date.now());
    const sectionStart = useRef(Date.now());

    // Reading speed estimation
    const wordsRead = useRef(0);

    // Derived state
    const [attentionState, setAttentionState] = useState<AttentionState>({
        readingSpeedNorm: 0.5,
        mouseDwellNorm: 0.0,
        scrollHesitation: 0.0,
        backtrackFreq: 0.0,
        attentionScore: 0.7,
        sessionFatigue: 0.0,
        touchPressureNorm: 0.0,
        wordDwellMs: 0,
    });

    // Push event into queue
    const push = useCallback((event: TelemetryEvent) => {
        queue.current.push(event);
    }, []);

    // Compute normalised attention state from accumulated metrics
    const computeAttentionState = useCallback((): AttentionState => {
        const sessionSecs = (Date.now() - sessionStart.current) / 1000;
        const wpm = sessionSecs > 0 ? (wordsRead.current / sessionSecs) * 60 : 0;

        // Normalise WPM (expected range 80–250 WPM for P3-P6 students)
        const readingSpeedNorm = Math.min(1, Math.max(0, (wpm - 30) / 200));

        const avgDwell = dwellSamples.current > 0
            ? dwellAccum.current / dwellSamples.current
            : 0;
        // Normalise dwell (0–10s maps to 0–1)
        const mouseDwellNorm = Math.min(1, avgDwell / 10_000);

        // Scroll hesitation: ratio of slow/hesitant scroll events
        const hesitantScrolls = scrollSpeeds.current.filter((s) => s < 0.5).length;
        const scrollHesitation = scrollSpeeds.current.length > 0
            ? hesitantScrolls / scrollSpeeds.current.length
            : 0;

        // Backtrack frequency: normalised by total scroll events
        const backtrackFreq = scrollEventCount.current > 0
            ? Math.min(1, backtrackCount.current / scrollEventCount.current)
            : 0;

        // Session fatigue: increases with time (30-min session = 1.0)
        const sessionFatigue = Math.min(1, sessionSecs / 1800);

        // Touch pressure: avg normalised pressure (high = frustration signal)
        const touchPressureNorm = touchPressureCount.current > 0
            ? Math.min(1, touchPressureAccum.current / touchPressureCount.current)
            : 0;

        // Word dwell: current accumulated ms on visible region
        const wordDwellMs = wordDwellAccum.current;

        // Composite attention score (higher = better focus).
        // Touch pressure > 0.6 reduces score (frustration signal, D1).
        const pressurePenalty = touchPressureNorm > 0.6 ? (touchPressureNorm - 0.6) * 0.25 : 0;
        const attentionScore = Math.max(
            0,
            Math.min(
                1,
                0.35 * readingSpeedNorm
                + 0.2 * (1 - mouseDwellNorm)
                + 0.2 * (1 - scrollHesitation)
                + 0.15 * (1 - backtrackFreq)
                - 0.1 * sessionFatigue
                - pressurePenalty
            )
        );

        return {
            readingSpeedNorm,
            mouseDwellNorm,
            scrollHesitation,
            backtrackFreq,
            attentionScore,
            sessionFatigue,
            touchPressureNorm,
            wordDwellMs,
        };
    }, []);

    // Flush batch to server
    const flush = useCallback(async () => {
        if (!idToken || !sessionId || queue.current.length === 0) return;

        const toSend = [...queue.current];
        queue.current = [];

        // Drain any offline queue first
        drainOfflineQueue(idToken, sessionId);
        await sendBatch(toSend, idToken, sessionId);

        // Update attention state
        const state = computeAttentionState();
        setAttentionState(state);
        onStateUpdate?.(state);
    }, [idToken, sessionId, computeAttentionState, onStateUpdate]);

    // ── Event listeners ────────────────────────────────────────────────────────

    useEffect(() => {
        // Scroll handler
        const handleScroll = () => {
            const now = Date.now();
            const dy = window.scrollY - lastScrollY.current;
            const dt = now - lastScrollTime.current;

            if (dt > SCROLL_SAMPLE_RATE) {
                const speed = Math.abs(dy) / dt; // px/ms
                scrollSpeeds.current.push(speed);
                scrollEventCount.current += 1;

                if (dy < -20) {
                    // Scrolling up = backtrack
                    backtrackCount.current += 1;
                    push({
                        type: "backtrack",
                        timestamp: now,
                        payload: { distance: Math.abs(dy) },
                    });
                }

                push({
                    type: "scroll",
                    timestamp: now,
                    payload: { scrollY: window.scrollY, speed, direction: dy > 0 ? 1 : -1 },
                });

                lastScrollY.current = window.scrollY;
                lastScrollTime.current = now;
            }
        };

        // Mouse move handler
        const handleMouseMove = () => {
            const now = Date.now();
            const gap = now - lastMoveTime.current;

            if (gap > 300) {
                // Treated as a "dwell pause"
                dwellAccum.current += gap;
                dwellSamples.current += 1;
                push({
                    type: "mouse_pause",
                    timestamp: now,
                    payload: { dwell_ms: gap },
                });
            }

            lastMoveTime.current = now;

            // Reset idle timer
            if (idleTimer.current) clearTimeout(idleTimer.current);
            idleTimer.current = setTimeout(() => {
                push({
                    type: "attention_lapse",
                    timestamp: Date.now(),
                    payload: { idle_ms: IDLE_THRESHOLD },
                });
            }, IDLE_THRESHOLD);
        };

        // Touch move (mobile equivalent of mouse move)
        const handleTouchMove = () => handleMouseMove();

        // Click handler
        const handleClick = () => {
            clickCount.current += 1;
            push({
                type: "click",
                timestamp: Date.now(),
                payload: { total_clicks: clickCount.current },
            });
        };

        // Touch pressure handler (D1: frustration correlates with harder taps).
        // PointerEvent.pressure is 0–1 (0 = no contact, 1 = max force).
        // Hardware that doesn't report pressure returns 0.5 for active contact.
        const handlePointerDown = (e: PointerEvent) => {
            const pressure = e.pressure ?? 0;
            if (pressure > 0 && pressure !== 0.5) {
                // Only count when device actually reports pressure (> default 0.5)
                touchPressureAccum.current += pressure;
                touchPressureCount.current += 1;
                if (pressure > 0.7) {
                    // Hard tap — signal of frustration
                    push({
                        type: "click",
                        timestamp: Date.now(),
                        payload: { touch_pressure: pressure, hard_tap: 1 },
                    });
                }
            }
        };

        // Word-level dwell: when scrolling stops, start accumulating dwell time
        // on the currently visible text region (proxy for word fixation).
        const handleScrollForDwell = () => {
            if (lastScrollStopTime.current) clearTimeout(lastScrollStopTime.current);
            wordDwellStart.current = Date.now();
            lastScrollStopTime.current = setTimeout(() => {
                // Scrolling stopped — start counting dwell time
                const dwell = Date.now() - wordDwellStart.current;
                wordDwellAccum.current += dwell;
                if (dwell > 3_000) {
                    // 3+ second fixation on visible region = decoding difficulty
                    push({
                        type: "mouse_pause",
                        timestamp: Date.now(),
                        payload: { word_fixation_ms: dwell, region: window.scrollY },
                    });
                }
            }, 600); // 600ms without scrolling = paused on content
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("scroll", handleScrollForDwell, { passive: true });
        window.addEventListener("mousemove", handleMouseMove, { passive: true });
        window.addEventListener("touchmove", handleTouchMove, { passive: true });
        window.addEventListener("click", handleClick, { passive: true });
        window.addEventListener("pointerdown", handlePointerDown, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("scroll", handleScrollForDwell);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("click", handleClick);
            window.removeEventListener("pointerdown", handlePointerDown);
            if (idleTimer.current) clearTimeout(idleTimer.current);
            if (lastScrollStopTime.current) clearTimeout(lastScrollStopTime.current);
        };
    }, [push]);

    // Auto-flush interval
    useEffect(() => {
        const interval = setInterval(flush, FLUSH_INTERVAL);
        return () => clearInterval(interval);
    }, [flush]);

    // Real-time struggle score refresh every 2.5s (D1 deliverable).
    // Updates attentionState locally without sending a network request.
    useEffect(() => {
        const interval = setInterval(() => {
            const state = computeAttentionState();
            setAttentionState(state);
            onStateUpdate?.(state);
        }, ATTENTION_REFRESH_RATE);
        return () => clearInterval(interval);
    }, [computeAttentionState, onStateUpdate]);

    // Update words read when section changes
    const markSectionRead = useCallback((sectionWordCount: number) => {
        wordsRead.current += sectionWordCount;
        sectionStart.current = Date.now();
        push({
            type: "paragraph_enter",
            timestamp: Date.now(),
            payload: { word_count: sectionWordCount },
        });
    }, [push]);

    // Final flush on unmount
    useEffect(() => {
        return () => { flush(); };
    }, [flush]);

    return {
        attentionState,
        markSectionRead,
        flushNow: flush,
    };
}
