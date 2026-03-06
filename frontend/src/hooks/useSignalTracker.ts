import { useState, useEffect, useRef, useCallback } from 'react';

export interface ReadingSignals {
    reading_speed_wpm: number;
    mouse_dwell: number;
    scroll_hesitation: number;
    backtrack_count: number;
    attention_score: number;
    session_fatigue: number;
    avg_dwell_time_ms: number;
    scroll_events: number;
}

interface UseSignalTrackerProps {
    enabled: boolean;
    wordCount: number;
    onUpdate?: (signals: ReadingSignals) => void;
    updateIntervalMs?: number;
}

export const useSignalTracker = ({
    enabled,
    wordCount,
    onUpdate,
    updateIntervalMs = 5000
}: UseSignalTrackerProps) => {
    const [signals, setSignals] = useState<ReadingSignals>({
        reading_speed_wpm: 0,
        mouse_dwell: 0,
        scroll_hesitation: 0,
        backtrack_count: 0,
        attention_score: 1.0,
        session_fatigue: 0,
        avg_dwell_time_ms: 0,
        scroll_events: 0,
    });

    const lastScrollY = useRef(window.scrollY);
    const lastScrollTime = useRef(Date.now());
    const scrollDeltas = useRef<number[]>([]);
    const dwellStartTime = useRef<number>(Date.now());
    const backtracks = useRef(0);
    const scrollEvents = useRef(0);
    const startTime = useRef(Date.now());
    const lastActiveTime = useRef(Date.now());

    const handleScroll = useCallback(() => {
        const currentScrollY = window.scrollY;
        const currentTime = Date.now();
        const deltaY = currentScrollY - lastScrollY.current;

        scrollEvents.current += 1;
        lastActiveTime.current = currentTime;

        if (deltaY < -10) {
            // Significant upward scroll = backtrack
            backtracks.current += 1;
        }

        lastScrollY.current = currentScrollY;
        lastScrollTime.current = currentTime;
    }, []);

    const handleMouseMove = useCallback(() => {
        lastActiveTime.current = Date.now();
    }, []);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('mousemove', handleMouseMove, { passive: true });

        const interval = setInterval(() => {
            const now = Date.now();
            const sessionDurationMinutes = (now - startTime.current) / 60000;
            const idleTimeSeconds = (now - lastActiveTime.current) / 1000;

            // Calculate signals
            const newSignals: ReadingSignals = {
                reading_speed_wpm: wordCount > 0 ? wordCount / Math.max(0.1, sessionDurationMinutes) : 0,
                mouse_dwell: idleTimeSeconds > 2 ? Math.min(1, idleTimeSeconds / 10) : 0,
                scroll_hesitation: scrollEvents.current < 2 ? 1 : 0, // simplistic proxy
                backtrack_count: backtracks.current,
                attention_score: Math.max(0, 1 - (idleTimeSeconds / 30)),
                session_fatigue: Math.min(1, sessionDurationMinutes / 45), // 45 min fatigue cap
                avg_dwell_time_ms: now - lastActiveTime.current,
                scroll_events: scrollEvents.current,
            };

            setSignals(newSignals);
            onUpdate?.(newSignals);
        }, updateIntervalMs);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('mousemove', handleMouseMove);
            clearInterval(interval);
        };
    }, [enabled, wordCount, onUpdate, updateIntervalMs, handleScroll, handleMouseMove]);

    return signals;
};
