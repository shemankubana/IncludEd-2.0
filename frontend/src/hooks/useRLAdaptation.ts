/**
 * useRLAdaptation.ts
 * ==================
 * Connects the telemetry state to the PPO RL agent and returns
 * the current adaptation action for the Reader to apply.
 *
 * Action Space (mirrors IncludEdEnv):
 *   0 = Keep Original
 *   1 = Light Simplification
 *   2 = Heavy Simplification
 *   3 = TTS + Highlights
 *   4 = Syllable Break
 *   5 = Attention Break (micro-section chunking)
 *
 * Falls back to rule-based if the AI service is unavailable.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { AttentionState } from "./useTelemetry";

// ── Types ──────────────────────────────────────────────────────────────────────

export const RL_ACTIONS = {
    0: { label: "Keep Original",        icon: "📖", bg: "bg-gray-100 dark:bg-gray-800" },
    1: { label: "Light Simplification", icon: "🔤", bg: "bg-blue-50 dark:bg-blue-900/30" },
    2: { label: "Heavy Simplification", icon: "✂️",  bg: "bg-indigo-50 dark:bg-indigo-900/30" },
    3: { label: "TTS + Highlights",     icon: "🔊", bg: "bg-yellow-50 dark:bg-yellow-900/30" },
    4: { label: "Syllable Break",       icon: "🔡", bg: "bg-purple-50 dark:bg-purple-900/30" },
    5: { label: "Attention Break",      icon: "⏸️",  bg: "bg-rose-50 dark:bg-rose-900/30" },
} as const;

export type ActionId = keyof typeof RL_ACTIONS;

export interface RLAdaptation {
    actionId:       ActionId;
    actionLabel:    string;
    isTTSEnabled:   boolean;
    isSyllabified:  boolean;
    isChunked:      boolean;     // for attention break
    simplifyLevel:  0 | 1 | 2;  // 0=none, 1=light, 2=heavy
    lineSpacing:    number;      // CSS line-height multiplier
    fontSize:       number;      // CSS em multiplier
    model:          "ppo" | "rule_based";
    confidence:     number;      // [0,1]
}

interface UseRLAdaptationOptions {
    sessionId:       string | null;
    idToken:         string | null;
    disabilityType:  number;       // 0.0=none, 0.5=dyslexia, 1.0=adhd
    textDifficulty:  number;       // [0,1]
    attentionState:  AttentionState;
    pollIntervalMs?: number;       // how often to re-query RL (default 30s)
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ── Rule-based fallback (mirrors Python rl_agent_service) ────────────────────

function ruleBasedAction(
    disabilityType: number,
    attentionScore: number,
    sessionFatigue: number,
    mouseDwell:     number,
    backtrackFreq:  number,
): ActionId {
    if (disabilityType >= 0.9) {
        return (attentionScore < 0.4 || sessionFatigue > 0.6) ? 5 : 2;
    }
    if (disabilityType >= 0.4) {
        return (mouseDwell > 0.5 || backtrackFreq > 0.5) ? 4 : 3;
    }
    if (attentionScore < 0.3) return 1;
    return 0;
}

// ── Action → UI properties ────────────────────────────────────────────────────

function buildAdaptation(actionId: ActionId, model: "ppo" | "rule_based"): RLAdaptation {
    return {
        actionId,
        actionLabel:  RL_ACTIONS[actionId].label,
        isTTSEnabled: actionId === 3,
        isSyllabified: actionId === 4,
        isChunked:    actionId === 5,
        simplifyLevel: actionId === 1 ? 1 : actionId === 2 ? 2 : 0,
        lineSpacing:  actionId === 3 || actionId === 4 ? 2.4 : 1.8,
        fontSize:     actionId === 2 ? 1.15 : 1.0,
        model,
        confidence:   model === "ppo" ? 0.85 : 0.6,
    };
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useRLAdaptation({
    sessionId,
    idToken,
    disabilityType,
    textDifficulty,
    attentionState,
    pollIntervalMs = 30_000,
}: UseRLAdaptationOptions) {
    const [adaptation, setAdaptation] = useState<RLAdaptation>(
        buildAdaptation(0, "rule_based")
    );
    const [isLoading, setIsLoading] = useState(false);
    const lastActionId = useRef<ActionId>(0);
    const stableCount  = useRef(0); // how many consecutive same-action predictions

    const queryRL = useCallback(async () => {
        if (!idToken || !sessionId) return;

        const stateVector = [
            attentionState.readingSpeedNorm,
            attentionState.mouseDwellNorm,
            attentionState.scrollHesitation,
            attentionState.backtrackFreq,
            attentionState.attentionScore,
            disabilityType,
            textDifficulty,
            attentionState.sessionFatigue,
        ];

        setIsLoading(true);
        try {
            const resp = await fetch(`${API_URL}/api/sessions/${sessionId}/rl-predict`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    reading_speed:      stateVector[0],
                    mouse_dwell:        stateVector[1],
                    scroll_hesitation:  stateVector[2],
                    backtrack_freq:     stateVector[3],
                    attention_score:    stateVector[4],
                    disability_type:    stateVector[5],
                    text_difficulty:    stateVector[6],
                    session_fatigue:    stateVector[7],
                }),
                signal: AbortSignal.timeout(600),
            });

            if (!resp.ok) throw new Error("RL service error");
            const data = await resp.json();

            const newActionId = (data.action_id ?? 0) as ActionId;
            const model: "ppo" | "rule_based" = data.fallback ? "rule_based" : "ppo";

            // Stability: only switch if different action for 2+ consecutive polls
            if (newActionId === lastActionId.current) {
                stableCount.current += 1;
            } else {
                stableCount.current = 0;
            }
            lastActionId.current = newActionId;

            if (stableCount.current >= 1 || newActionId !== adaptation.actionId) {
                setAdaptation(buildAdaptation(newActionId, model));
            }
        } catch {
            // Offline/service down: use rule-based
            const fallbackAction = ruleBasedAction(
                disabilityType,
                attentionState.attentionScore,
                attentionState.sessionFatigue,
                attentionState.mouseDwellNorm,
                attentionState.backtrackFreq,
            );
            setAdaptation(buildAdaptation(fallbackAction, "rule_based"));
        } finally {
            setIsLoading(false);
        }
    }, [idToken, sessionId, attentionState, disabilityType, textDifficulty, adaptation.actionId]);

    // Poll on interval
    useEffect(() => {
        queryRL();
        const interval = setInterval(queryRL, pollIntervalMs);
        return () => clearInterval(interval);
    }, [queryRL, pollIntervalMs]);

    return { adaptation, isLoading, refreshNow: queryRL };
}
