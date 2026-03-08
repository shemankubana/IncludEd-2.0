/**
 * Reader.tsx — Adaptive RL-powered reading interface.
 *
 * Integrates:
 *  - useTelemetry: scroll/mouse/idle event collection
 *  - useRLAdaptation: PPO-based content adaptation
 *  - PlayDialogueUI: animated avatar dialogue for plays
 *  - Chapter navigation with lazy loading + IndexedDB progress
 *  - Content simplification based on RL action
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
    Play, Pause, RotateCcw, Type, Eye, EyeOff,
    ArrowLeft, BrainCircuit, Loader2,
    BookOpen, ChevronLeft, ChevronRight, Volume2, Zap,
    AlertCircle, Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import PlayDialogueUI, { type DialogueLine } from "@/components/play/PlayDialogueUI";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useRLAdaptation, RL_ACTIONS } from "@/hooks/useRLAdaptation";
import HighlightToUnderstand from "@/components/LiteratureViewer/HighlightToUnderstand";
import { DyslexiaText, type DyslexiaSettings, DEFAULT_DYSLEXIA_SETTINGS } from "@/components/LiteratureViewer/DyslexiaRenderer";
import ComprehensionMiniPanel from "@/components/reader/ComprehensionMiniPanel";
import VocabSidebar from "@/components/reader/VocabSidebar";
import CharacterTooltip from "@/components/reader/CharacterTooltip";
import PoemRenderer from "@/components/reader/PoemRenderer";
import CharacterMapPanel from "@/components/reader/CharacterMapPanel";
import { useTranslation } from "@/hooks/useTranslation";


// ── Types ──────────────────────────────────────────────────────────────────────

interface Section {
    title: string;
    content: string;
    simplified_content?: string; // pre-computed simplified version (stored by background ML)
    dialogue?: DialogueLine[];
    wordCount?: number;
    // Phase 1 enriched metadata
    emotion?: string;
    setting?: string;
    characters_present?: string[];
    archaic_phrases?: Array<{ word: string; modern_meaning: string }>;
    literary_devices?: string[];
    faction?: string;
    difficulty?: number;
    estimated_read_minutes?: number;
}

// ── IndexedDB helpers for offline progress ────────────────────────────────────

const IDB_DB = "included_reader";
const IDB_STORE = "progress";

async function idbGetProgress(litId: string): Promise<number | null> {
    return new Promise((resolve) => {
        const req = indexedDB.open(IDB_DB, 1);
        req.onupgradeneeded = () =>
            req.result.createObjectStore(IDB_STORE, { keyPath: "id" });
        req.onsuccess = () => {
            const tx = req.result.transaction(IDB_STORE, "readonly");
            const get = tx.objectStore(IDB_STORE).get(litId);
            get.onsuccess = () => resolve(get.result?.section ?? null);
            get.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
    });
}

async function idbSaveProgress(litId: string, section: number): Promise<void> {
    return new Promise((resolve) => {
        const req = indexedDB.open(IDB_DB, 1);
        req.onupgradeneeded = () =>
            req.result.createObjectStore(IDB_STORE, { keyPath: "id" });
        req.onsuccess = () => {
            const tx = req.result.transaction(IDB_STORE, "readwrite");
            tx.objectStore(IDB_STORE).put({ id: litId, section, ts: Date.now() });
            resolve();
        };
        req.onerror = () => resolve();
    });
}


// ── Main Component ─────────────────────────────────────────────────────────────

const AdaptiveReader = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user, profile, dyslexicMode } = useAuth();

    // Reader state
    const [isPlaying, setIsPlaying] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lesson, setLesson] = useState<any>(null);
    const [intro, setIntro] = useState<string | null>(null);
    const [showIntro, setShowIntro] = useState(true);
    const [sections, setSections] = useState<Section[]>([]);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [allQuizzes, setAllQuizzes] = useState<any[]>([]);
    const [showQuizPrompt, setShowQuizPrompt] = useState(false);
    const [contentType, setContentType] = useState<"play" | "novel" | "poem" | "generic">("generic");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [idToken, setIdToken] = useState<string | null>(null);
    const [showRLBadge, setShowRLBadge] = useState(false);

    // Book Brain + Comprehension Graph state
    const [bookBrain, setBookBrain] = useState<any>(null);
    const [showRecap, setShowRecap] = useState(false);
    const [recapText, setRecapText] = useState<string | null>(null);
    const [showStrugglePrep, setShowStrugglePrep] = useState(false);
    const [struggleVocab, setStruggleVocab] = useState<any[]>([]);

    // ADHD inline micro-check state (D3 deliverable)
    const [microCheck, setMicroCheck] = useState<{ id?: string; question: string; options: string[]; answer: number | string } | null>(null);
    const [microCheckAnswer, setMicroCheckAnswer] = useState<number | string | null>(null);
    const microCheckWordsRef = useRef(0); // words read since last micro-check
    const MICRO_CHECK_INTERVAL = 250;       // trigger every ~250 words

    // Scene summary card state (Phase 2 — Play mode "What just happened?")
    const [sceneSummary, setSceneSummary] = useState<{
        emotion: string;
        setting: string;
        characters: string[];
        archiPhrases: Array<{ word: string; modern_meaning: string }>;
    } | null>(null);

    // ADHD breathing break + cliffhanger teaser state (Phase 3)
    const [breathingBreak, setBreathingBreak] = useState(false);
    const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
    const [cliffhangerTeaser, setCliffhangerTeaser] = useState<string | null>(null);
    const breathIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const ADHD_SECTION_BREAK_EVERY = 3; // show breathing break every N sections
    const adhdSectionCountRef = useRef(0);

    // Character Map panel state (Phase 5)
    const [showCharacterMap, setShowCharacterMap] = useState(false);

    // Translations
    const { t } = useTranslation(lesson?.language);

    // Session tracking for learner embedding
    const sessionStartRef = useRef<number>(Date.now());
    const wordsReadRef = useRef<number>(0);
    const adaptationsRef = useRef<number[]>([]);

    const AI_URL = import.meta.env.VITE_AI_URL || "http://localhost:8000";

    // TTS
    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const [, setCurrentTime] = useState(0);
    const ttsRef = useRef<SpeechSynthesisUtterance | null>(null);

    const totalSections = sections.length;
    const currentSection = sections[currentSectionIndex] || { title: "", content: "" };

    // ── Disability encoding ────────────────────────────────────────────────────
    const disabilityEncoded: number = (() => {
        const dt = profile?.disabilityType || "none";
        if (dt === "adhd") return 1.0;
        if (dt === "dyslexia") return 0.5;
        if (dt === "both") return 1.5;
        return 0.0;
    })();

    const contentTypeEncoded: number = (() => {
        if (contentType === "play") return 1.0;
        if (contentType === "novel") return 0.5;
        if (contentType === "poem") return 0.5;
        return 0.0;
    })();

    // ── Telemetry ──────────────────────────────────────────────────────────────
    const { attentionState, markSectionRead, flushNow } = useTelemetry({
        sessionId,
        literatureId: id ?? null,
        idToken,
    });

    // ── RL Adaptation ──────────────────────────────────────────────────────────
    const { adaptation, isLoading: rlLoading } = useRLAdaptation({
        sessionId,
        idToken,
        disabilityType: disabilityEncoded,
        contentType: contentTypeEncoded,
        textDifficulty: 0.5,
        attentionState,
        pollIntervalMs: 5_000,
    });

    // Use pre-computed simplified content for RL simplification actions (1=Light, 2=Heavy)
    const useSimplified = (adaptation.actionId === 1 || adaptation.actionId === 2) && !!currentSection.simplified_content;
    const safeContent = (useSimplified ? currentSection.simplified_content : currentSection.content) || "";
    const words = safeContent.split(/\s+/).filter(Boolean);

    // ── RL → DyslexiaRenderer settings bridge ─────────────────────────────────
    // Each RL action maps to a specific DyslexiaSettings configuration.
    // This makes the abstract RL output concrete and visible in the UI.
    const dyslexiaSettings: DyslexiaSettings = useMemo(() => {
        const base = { ...DEFAULT_DYSLEXIA_SETTINGS };
        // OpenDyslexic font from user profile always wins
        if (dyslexicMode) base.openDyslexicFont = true;
        switch (adaptation.actionId) {
            case 1: // Light Simplification → widen spacing to reduce crowding
                return { ...base, letterSpacing: 2, wordSpacing: 5, lineHeight: 2.0 };
            case 2: // Heavy Simplification → max spacing + larger font
                return { ...base, letterSpacing: 2, wordSpacing: 6, lineHeight: 2.2, fontSize: 1.15 };
            case 3: // TTS + Highlights → reading ruler to track the line being spoken
                return { ...base, readingRuler: true, lineHeight: 2.2 };
            case 4: // Syllable Break → color-coded syllables
                return { ...base, syllableColors: true, lineHeight: 2.0, fontSize: 1.05 };
            case 5: // Attention Break → bionic reading to anchor eyes + alternating lines
                return { ...base, bionicReading: true, alternatingLines: true, lineHeight: 2.1 };
            default: // Keep Original (0) → user prefs only
                return base;
        }
    }, [adaptation.actionId, dyslexicMode]);

    // Show RL badge when action changes
    const prevActionId = useRef(adaptation.actionId);
    useEffect(() => {
        if (adaptation.actionId !== prevActionId.current) {
            prevActionId.current = adaptation.actionId;
            setShowRLBadge(true);
            const t = setTimeout(() => setShowRLBadge(false), 4000);
            return () => clearTimeout(t);
        }
    }, [adaptation.actionId]);

    // ── Apply RL text transformations ──────────────────────────────────────────
    // DyslexiaRenderer now handles syllable colors and bionic reading visually.
    // We still need the plain-text version for TTS and word-highlight counting.
    const displayText = (() => {
        if (adaptation.isChunked) {
            // Attention break: trim to ~3 sentences to reduce overload
            const sentences = safeContent.split(/(?<=[.!?])\s+/).filter(Boolean);
            return sentences.slice(0, 3).join(" ") || safeContent;
        }
        return safeContent;
    })();

    const displayWords = displayText.split(/\s+/).filter(Boolean);

    // ── Session creation ───────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            if (!user || !id) return;
            const token = await user.getIdToken();
            setIdToken(token);
            try {
                const resp = await fetch(
                    `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/sessions`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            literatureId: id,
                            disabilityType: profile?.disabilityType || "none",
                            textDifficulty: 0.5,
                        }),
                    }
                );
                if (resp.ok) {
                    const data = await resp.json();
                    setSessionId(data.sessionId);
                }
            } catch { /* session tracking optional */ }
        };
        init();
    }, [user, id, profile]);

    // ── Fetch lesson ───────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchLesson = async () => {
            if (!user || !id) return;
            try {
                const token = await user.getIdToken();
                const response = await fetch(
                    `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/literature/${id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = await response.json();

                // Fetch quizzes concurrently
                const quizResp = await fetch(
                    `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/quiz/${id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (quizResp.ok) {
                    const qData = await quizResp.json();
                    setAllQuizzes(qData);
                }

                setLesson({ title: data.title, author: data.author, difficulty: data.difficulty || "Adaptive" });
                if (data.introduction) {
                    setIntro(data.introduction);
                    setShowIntro(true);
                }
                if (data.contentType) setContentType(data.contentType);
                if (data.bookBrain) setBookBrain(data.bookBrain);

                if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
                    setSections(data.sections);
                } else {
                    const raw = data.adaptedContent || data.originalContent || "";
                    const w = raw.split(/\s+/);
                    const SIZE = 400;
                    const chunks: Section[] = [];
                    for (let i = 0; i < w.length; i += SIZE) {
                        chunks.push({
                            title: `Page ${Math.floor(i / SIZE) + 1}`,
                            content: w.slice(i, i + SIZE).join(" "),
                            wordCount: Math.min(SIZE, w.length - i),
                        });
                    }
                    setSections(chunks.length > 0 ? chunks : [{ title: "Content", content: raw }]);
                }

                // Load progress from IndexedDB first (offline-safe)
                const cachedSection = await idbGetProgress(id);
                if (cachedSection !== null) {
                    setCurrentSectionIndex(cachedSection);
                    // Show "Story So Far" recap if returning to a book already in progress
                    if (cachedSection > 0 && user) {
                        try {
                            const aiUrl = import.meta.env.VITE_AI_URL || "http://localhost:8000";
                            const recapRes = await fetch(
                                `${aiUrl}/comprehension/recap?student_id=${user.uid}&book_id=${id}`
                            );
                            if (recapRes.ok) {
                                const rd = await recapRes.json();
                                if (rd.chapters_completed && rd.chapters_completed.length > 0) {
                                    // Generate text recap
                                    const textRes = await fetch(`${aiUrl}/teacher/recap`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            student_id: user.uid,
                                            book_id: id,
                                            language: data.language?.startsWith("fr") ? "fr" : "en",
                                        }),
                                    });
                                    if (textRes.ok) {
                                        const td = await textRes.json();
                                        if (td.recap && td.recap.length > 20) {
                                            setRecapText(td.recap);
                                            setShowRecap(true);
                                        }
                                    }
                                }
                            }
                        } catch { /* recap optional */ }
                    }
                } else {
                    // Try server progress
                    try {
                        const token2 = await user.getIdToken();
                        const progressRes = await fetch(
                            `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/progress/${id}`,
                            { headers: { Authorization: `Bearer ${token2}` } }
                        );
                        if (progressRes.ok) {
                            const pd = await progressRes.json();
                            if (pd?.currentSection !== undefined) {
                                setCurrentSectionIndex(pd.currentSection);
                            }
                        }
                    } catch { /* offline */ }
                }
            } catch (error) {
                console.error("Failed to fetch lesson:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLesson();
    }, [id, user]);

    // ── TTS auto-play ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isPlaying || !adaptation.isTTSEnabled) return;
        if (!window.speechSynthesis) return;

        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(displayText);
        utter.rate = 0.9;
        utter.onend = () => setIsPlaying(false);
        ttsRef.current = utter;
        window.speechSynthesis.speak(utter);

        return () => window.speechSynthesis.cancel();
    }, [isPlaying, adaptation.isTTSEnabled, displayText]);

    // ── Mock word highlight timer (for generic mode) ──────────────────────────
    useEffect(() => {
        if (!isPlaying || adaptation.isTTSEnabled) return;
        let interval: ReturnType<typeof setInterval>;
        interval = setInterval(() => {
            setCurrentTime((prev) => {
                const next = prev + 0.1;
                if (next > 5) { setIsPlaying(false); return 0; }
                const idx = Math.floor((next / 5) * Math.min(8, displayWords.length));
                setActiveWordIndex(idx);
                if (next > 4 && !showQuizPrompt) setShowQuizPrompt(true);
                return next;
            });
        }, 100);
        return () => clearInterval(interval);
    }, [isPlaying, adaptation.isTTSEnabled, displayWords.length, showQuizPrompt]);

    // ── Navigation ─────────────────────────────────────────────────────────────
    const saveProgress = useCallback(
        async (index: number, status: "in_progress" | "completed" = "in_progress") => {
            await idbSaveProgress(id!, index);
            if (!user || !id) return;
            try {
                const token = await user.getIdToken();
                await fetch(
                    `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/progress/${id}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            currentSection: index,
                            status,
                            schoolId: profile?.schoolId,
                        }),
                    }
                );
            } catch { /* offline fallback handled by idb */ }
        },
        [id, user, profile]
    );

    // ── Record comprehension for current section ──────────────────────────────
    const recordComprehension = useCallback(async (sectionIdx: number) => {
        if (!user || !id) return;
        const sec = sections[sectionIdx];
        if (!sec) return;
        const timeSpent = (Date.now() - sessionStartRef.current) / 1000;
        wordsReadRef.current += sec.wordCount ?? sec.content?.split(/\s+/).length ?? 0;
        try {
            await fetch(`${AI_URL}/comprehension/record`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_id: user.uid,
                    book_id: id,
                    section_id: `section_${sectionIdx}`,
                    section_title: sec.title || `Section ${sectionIdx + 1}`,
                    chapter_title: lesson?.title || "",
                    time_spent_s: Math.min(timeSpent, 3600),
                    section_text: (sec.content || "").slice(0, 1000),
                }),
            });
        } catch { /* optional */ }
        sessionStartRef.current = Date.now(); // reset timer for next section
    }, [user, id, sections, AI_URL, lesson]);

    // ── Update learner embedding at session end ────────────────────────────────
    const updateLearnerEmbedding = useCallback(async () => {
        if (!user) return;
        const sessionDurationS = (Date.now() - sessionStartRef.current) / 1000;
        const wpm = sessionDurationS > 0
            ? (wordsReadRef.current / sessionDurationS) * 60
            : 0;
        try {
            await fetch(`${AI_URL}/learner/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_id: user.uid,
                    session_duration_s: Math.min(sessionDurationS, 7200),
                    words_read: wordsReadRef.current,
                    reading_speed_wpm: Math.round(wpm),
                    backtrack_count: Math.round(attentionState.backtrackFreq * 20),
                    scroll_events: 30,
                    attention_lapses: attentionState.attentionScore < 0.4 ? 3 : 1,
                    highlights_made: 0,
                    vocab_lookups: 0,
                    time_of_day_hour: new Date().getHours(),
                    disability_type: disabilityEncoded,
                    doc_type: contentType,
                    adaptations_applied: adaptationsRef.current,
                    adaptation_accepted: adaptationsRef.current.map(() => true),
                    session_fatigue: attentionState.sessionFatigue,
                    avg_dwell_time_ms: attentionState.mouseDwellNorm * 10000,
                }),
            });
        } catch { /* optional */ }
    }, [user, attentionState, disabilityEncoded, contentType, AI_URL]);

    // Track adaptation changes for embedding
    useEffect(() => {
        if (adaptation.actionId !== 0) {
            adaptationsRef.current.push(adaptation.actionId);
        }
    }, [adaptation.actionId]);

    // ── Check if next section is a struggle zone ──────────────────────────────
    const checkStruggleZone = useCallback((nextIdx: number) => {
        if (!bookBrain) return;
        const nextSection = sections[nextIdx];
        if (!nextSection) return;

        // Check difficulty_map for this section
        const diffEntry = bookBrain.difficulty_map?.find(
            (d: any) => d.section_title === nextSection.title || d.section_id === `section_${nextIdx}`
        );
        const isStruggle = diffEntry?.overall_difficulty > 0.6 ||
            bookBrain.struggle_zones?.some(
                (z: any) => z.section_title === nextSection.title || z.section_id === `section_${nextIdx}`
            );

        if (isStruggle && bookBrain.vocabulary?.length > 0) {
            // Find vocab words that appear in the next section content
            const nextContent = (nextSection.content || "").toLowerCase();
            const relevantVocab = bookBrain.vocabulary
                .filter((v: any) => nextContent.includes(v.word?.toLowerCase()))
                .slice(0, 5);
            if (relevantVocab.length >= 2) {
                setStruggleVocab(relevantVocab);
                setShowStrugglePrep(true);
            }
        }
    }, [bookBrain, sections]);

    // ── ADHD micro-check: show a simple comprehension pulse every ~250 words ──
    const maybeTriggerMicroCheck = useCallback(() => {
        // Only trigger for ADHD users, not during TTS, not more than once per section
        const isAdhd = (profile?.disabilityType === "adhd" || profile?.disabilityType === "both");
        if (!isAdhd || adaptation.isTTSEnabled) return false;

        // Try to find a quiz associated with this chunkIndex
        const chunkQuiz = allQuizzes.find(q => q.chunkIndex === currentSectionIndex);

        if (chunkQuiz) {
            setMicroCheck({
                id: chunkQuiz.id,
                question: chunkQuiz.question,
                options: chunkQuiz.options,
                answer: chunkQuiz.correctAnswer,
            });
            setMicroCheckAnswer(null);
            return true; // Triggered real quiz
        }

        // Fallback: build a lightweight comprehension pulse from the just-read section
        const sec = sections[currentSectionIndex];
        if (!sec?.content) return false;

        // Only trigger fallback if words exceeded
        if (microCheckWordsRef.current < MICRO_CHECK_INTERVAL) return false;
        microCheckWordsRef.current = 0;

        const firstSentence = sec.content.split(/[.!?]/)[0]?.trim() || "";
        if (firstSentence.length < 20) return false;

        setMicroCheck({
            question: "Quick check — what was this section mainly about?",
            options: [
                firstSentence.slice(0, 60) + "…",
                "A description of a different character",
                "A flashback to an earlier event",
            ],
            answer: 0, // Assume first option is "correct" for fallback
        });
        setMicroCheckAnswer(null);
        return true;
    }, [profile, adaptation.isTTSEnabled, allQuizzes, currentSectionIndex, sections]);

    const startBreathingBreak = useCallback(() => {
        setBreathingBreak(true);
        setBreathPhase("inhale");
        let phase: "inhale" | "hold" | "exhale" = "inhale";
        const phases: ("inhale" | "hold" | "exhale")[] = ["inhale", "hold", "exhale"];
        let phaseIdx = 0;
        // 4s inhale, 2s hold, 4s exhale — 3 cycles then auto-dismiss
        let cycles = 0;
        breathIntervalRef.current = setInterval(() => {
            phaseIdx = (phaseIdx + 1) % 3;
            const newPhase = phases[phaseIdx];
            setBreathPhase(newPhase);
            if (phaseIdx === 0) {
                cycles += 1;
                if (cycles >= 3) {
                    if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
                    setBreathingBreak(false);
                }
            }
        }, 4000); // Standardize to 4s for simplicity and to avoid lint error on stale 'phase' comparison
    }, []);

    const handleNextSection = useCallback(() => {
        const sectionWords = currentSection.wordCount ?? words.length;

        // ADHD bite-sized check: trigger before moving to next section
        if (!microCheck) {
            const triggered = maybeTriggerMicroCheck();
            if (triggered) {
                // Return early so navigation doesn't happen yet
                return;
            }
        }

        if (currentSectionIndex < totalSections - 1) {
            const next = currentSectionIndex + 1;
            // Record comprehension for current section before moving
            recordComprehension(currentSectionIndex);
            // Check if next section is a struggle zone
            checkStruggleZone(next);

            // ADHD breathing break every N sections (Phase 3)
            const isAdhd = (profile?.disabilityType === "adhd" || profile?.disabilityType === "both");
            if (isAdhd) {
                adhdSectionCountRef.current += 1;
                if (adhdSectionCountRef.current >= ADHD_SECTION_BREAK_EVERY) {
                    adhdSectionCountRef.current = 0;
                    // Pre-fetch cliffhanger teaser from next section
                    const nextSection = sections[next];
                    if (nextSection?.content) {
                        const firstSentence = nextSection.content.split(/[.!?]/)[0]?.trim();
                        if (firstSentence && firstSentence.length > 20) {
                            setCliffhangerTeaser(firstSentence.slice(0, 120) + "…");
                        }
                    }
                    startBreathingBreak();
                }
            }

            setCurrentSectionIndex(next);
            saveProgress(next, "in_progress");
            markSectionRead(sectionWords);
            setActiveWordIndex(-1);
            setCurrentTime(0);
            setIsPlaying(false);
            setMicroCheck(null); // Reset for next section
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            recordComprehension(currentSectionIndex);
            updateLearnerEmbedding();
            saveProgress(currentSectionIndex, "completed");
            flushNow();
            // Save RL session summary before quiz
            if (sessionId && idToken) {
                fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/sessions/${sessionId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                    body: JSON.stringify({
                        avgAttentionScore: attentionState.attentionScore,
                        avgSessionFatigue: attentionState.sessionFatigue,
                        completionRate: 1.0,
                        status: "completed",
                    }),
                }).catch(() => { });
            }
            navigate(`/student/quiz/${id}`);
        }
    }, [
        currentSectionIndex, totalSections, saveProgress, markSectionRead,
        currentSection.wordCount, words.length, flushNow, sessionId, idToken,
        attentionState, navigate, id, recordComprehension, updateLearnerEmbedding,
        checkStruggleZone, maybeTriggerMicroCheck,
    ]);

    const handlePrevSection = useCallback(() => {
        if (currentSectionIndex > 0) {
            const prev = currentSectionIndex - 1;
            setCurrentSectionIndex(prev);
            saveProgress(prev, "in_progress");
            setActiveWordIndex(-1);
            setCurrentTime(0);
            setIsPlaying(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [currentSectionIndex, saveProgress]);

    // ── Play dialogue lines extraction ────────────────────────────────────────
    const dialogueLines: DialogueLine[] = (() => {
        if (contentType !== "play") return [];
        if (currentSection.dialogue && currentSection.dialogue.length > 0) {
            // Filter page-number artifacts and running-header lines baked into stored dialogue
            // (e.g. bare "5", or "15 Macbeth ACT 1. SC. 3 SECOND WITCH FIRST WITCH...")
            return currentSection.dialogue.filter((d: DialogueLine) => {
                const c = d.content?.trim() || "";
                if (c.length <= 5) return false;
                if (/^\d+$/.test(c)) return false;           // bare page number
                if (/^\d{1,4}\s+\S/.test(c)) return false;  // running header
                return true;
            });
        }
        // Parse from raw content (fallback for legacy data)
        return (currentSection.content || "").split("\n").reduce<DialogueLine[]>((acc, line) => {
            const trimmed = line.trim();
            // Skip empty lines and bare page numbers
            if (!trimmed || /^\d+$/.test(trimmed)) return acc;
            // Match "CHARACTER: dialogue" or "CHARACTER. dialogue"
            const charMatch = trimmed.match(/^([A-Z][A-Z\s'\.]{1,28}[A-Z])[:.]\s+(.*)/);
            if (charMatch && charMatch[2].trim().length > 5) {
                acc.push({ type: "dialogue", character: charMatch[1].trim(), content: charMatch[2] });
            } else if (/^[\[(].+[\])]$/.test(trimmed)) {
                acc.push({ type: "stage_direction", content: trimmed.slice(1, -1) });
            } else if (trimmed.length > 15) {
                acc.push({ type: "paragraph", content: trimmed });
            }
            return acc;
        }, []);
    })();

    // ── Helper: extract clean Act / Scene from messy ML titles ───────────────
    // e.g. "9 MACBETH ACT 1. SC. 2 DUNCAN MALCOLM..." → { act: "Act 1", scene: "Scene 2" }
    function parseActScene(title: string): { act: string; scene: string } {
        const actM = title.match(/ACT\s+(\d+|[IVX]+)/i);
        const sceneM = title.match(/SC(?:ENE)?\.?\s*(\d+|[IVX]+)/i);
        return {
            act: actM ? `Act ${actM[1]}` : "Prologue",
            scene: sceneM ? `Scene ${sceneM[1]}` : "",
        };
    }

    // ── Act/Scene group navigation for plays ─────────────────────────────────
    const sectionGroups = useMemo(() => {
        if (contentType !== "play") return null;
        const groups: { actTitle: string; scenes: { idx: number; sceneTitle: string }[] }[] = [];
        sections.forEach((sec, idx) => {
            const { act, scene } = parseActScene(sec.title);
            const sceneLabel = scene || `Part ${idx + 1}`;
            const existing = groups.find(g => g.actTitle === act);
            if (existing) {
                // Only add the first occurrence of each scene to the nav
                if (!existing.scenes.some(s => s.sceneTitle === sceneLabel)) {
                    existing.scenes.push({ idx, sceneTitle: sceneLabel });
                }
            } else {
                groups.push({ actTitle: act, scenes: [{ idx, sceneTitle: sceneLabel }] });
            }
        });
        // Sort scenes within each act by numeric value
        groups.forEach(g => {
            g.scenes.sort((a, b) => {
                const na = parseInt(a.sceneTitle.replace(/\D/g, ""), 10) || 0;
                const nb = parseInt(b.sceneTitle.replace(/\D/g, ""), 10) || 0;
                return na - nb;
            });
        });
        return groups;
    }, [sections, contentType]);

    // ── Extract act/scene for PlayDialogueUI header ───────────────────────────
    const { actTitle, sceneTitle } = useMemo(() => {
        if (contentType !== "play") return { actTitle: undefined, sceneTitle: currentSection.title };
        const { act, scene } = parseActScene(currentSection.title);
        return {
            actTitle: act || undefined,
            sceneTitle: scene || currentSection.title,
        };
    }, [currentSection.title, contentType]);

    // ── Loading state ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <DashboardLayout role="student">
                <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="font-bold text-muted-foreground uppercase tracking-widest text-xs">
                        Preparing your adaptive lesson...
                    </p>
                </div>
            </DashboardLayout>
        );
    }

    // ── RL action badge colour ─────────────────────────────────────────────────
    const actionInfo = RL_ACTIONS[adaptation.actionId];

    return (
        <DashboardLayout role="student">
            {/* ── Story So Far Recap Modal ── */}
            <AnimatePresence>
                {showRecap && recapText && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        onClick={() => setShowRecap(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92 }}
                            className="bg-card border border-border rounded-3xl p-8 max-w-md w-full shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <BookOpen className="w-6 h-6 text-primary" />
                                <h2 className="font-black text-lg">Welcome back!</h2>
                            </div>
                            <p className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-widest">
                                Story so far...
                            </p>
                            <p className="text-base leading-relaxed mb-6">{recapText}</p>
                            <Button className="w-full" onClick={() => setShowRecap(false)}>
                                Continue reading
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Struggle Zone Pre-Teaching Card ── */}
            <AnimatePresence>
                {showStrugglePrep && struggleVocab.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92 }}
                            className="bg-card border border-amber-400/40 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <AlertCircle className="w-5 h-5 text-amber-500" />
                                <h2 className="font-black text-base">Heads up!</h2>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                The next section has some tricky vocabulary. Let's preview the key words first.
                            </p>
                            <div className="space-y-3 mb-6">
                                {struggleVocab.map((v: any, i: number) => (
                                    <div key={i} className="bg-secondary/40 rounded-xl p-3">
                                        <span className="font-black text-primary">{v.word}</span>
                                        {v.archaic && v.modern_meaning && (
                                            <span className="text-muted-foreground text-sm ml-2">
                                                → "{v.modern_meaning}"
                                            </span>
                                        )}
                                        {v.contexts?.[0] && (
                                            <p className="text-xs text-muted-foreground mt-1 italic">
                                                "{v.contexts[0].slice(0, 80)}..."
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <Button className="w-full" onClick={() => setShowStrugglePrep(false)}>
                                I'm ready — let's read!
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── ADHD Breathing Break (Phase 3) ── */}
            <AnimatePresence>
                {breathingBreak && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-sky-900/90 to-indigo-900/90 p-4"
                    >
                        <div className="flex flex-col items-center gap-8 text-white text-center max-w-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                Time for a quick break
                            </p>

                            {/* Breathing circle */}
                            <motion.div
                                className="w-40 h-40 rounded-full border-4 border-white/40 flex items-center justify-center"
                                animate={{
                                    scale: breathPhase === "inhale" ? 1.35 : breathPhase === "hold" ? 1.35 : 0.85,
                                    borderColor: breathPhase === "inhale" ? "rgba(255,255,255,0.8)" : breathPhase === "hold" ? "rgba(253,224,71,0.8)" : "rgba(255,255,255,0.3)",
                                }}
                                transition={{ duration: breathPhase === "hold" ? 0.2 : 4, ease: "easeInOut" }}
                            >
                                <motion.div
                                    className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center"
                                    animate={{ scale: breathPhase === "inhale" ? 1.2 : breathPhase === "hold" ? 1.2 : 0.8 }}
                                    transition={{ duration: breathPhase === "hold" ? 0.2 : 4, ease: "easeInOut" }}
                                >
                                    <span className="text-4xl">
                                        {breathPhase === "inhale" ? "🌬️" : breathPhase === "hold" ? "⏸️" : "💨"}
                                    </span>
                                </motion.div>
                            </motion.div>

                            <div>
                                <p className="text-2xl font-black capitalize mb-1">{breathPhase}</p>
                                <p className="text-sm opacity-70">
                                    {breathPhase === "inhale" ? "Breathe in slowly…" : breathPhase === "hold" ? "Hold it…" : "Breathe out gently…"}
                                </p>
                            </div>

                            {/* Cliffhanger teaser */}
                            {cliffhangerTeaser && (
                                <div className="bg-white/10 rounded-2xl px-5 py-4 max-w-xs">
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Coming up next…</p>
                                    <p className="text-sm font-medium italic opacity-80">"{cliffhangerTeaser}"</p>
                                </div>
                            )}

                            <button
                                className="text-xs font-bold text-white/50 underline mt-2"
                                onClick={() => {
                                    if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
                                    setBreathingBreak(false);
                                }}
                            >
                                Skip break
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── ADHD Inline Comprehension Micro-Check (D3) ── */}
            <AnimatePresence>
                {microCheck && !microCheckAnswer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92 }}
                            className="bg-card border border-primary/30 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <BrainCircuit className="w-5 h-5 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                                    Quick Check — 10 seconds
                                </span>
                            </div>
                            <p className="font-bold text-base mb-5">{microCheck.question}</p>
                            <div className="space-y-3">
                                {microCheck.options.map((opt, i) => (
                                    <button
                                        key={i}
                                        className="w-full text-left px-4 py-3 rounded-2xl border border-border font-medium text-sm hover:border-primary/50 hover:bg-primary/5 transition-all"
                                        onClick={() => {
                                            setMicroCheckAnswer(opt);
                                            setTimeout(() => setMicroCheck(null), 1200);
                                        }}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                            <button
                                className="mt-4 text-xs text-muted-foreground font-medium underline"
                                onClick={() => setMicroCheck(null)}
                            >
                                Skip
                            </button>
                        </motion.div>
                    </motion.div>
                )}
                {microCheck && microCheckAnswer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.92 }}
                            animate={{ scale: 1 }}
                            className="bg-card border border-emerald-400/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
                        >
                            <p className="text-3xl mb-3">
                                {microCheckAnswer === microCheck.answer ? "✓" : "→"}
                            </p>
                            <p className="font-black text-base mb-1">
                                {microCheckAnswer === microCheck.answer ? "Great recall!" : "Keep reading!"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {microCheckAnswer === microCheck.answer
                                    ? "You're following the story well."
                                    : "Don't worry — the key idea will come again."}
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Scene Summary Card (Phase 2 — Play "What just happened?") ── */}
            <AnimatePresence>
                {sceneSummary && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 24 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-card border border-primary/20 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">
                                Scene Complete — What just happened?
                            </p>
                            <div className="space-y-4 text-sm">
                                {sceneSummary.setting && (
                                    <div className="flex gap-3 items-start">
                                        <span className="text-xl">📍</span>
                                        <div>
                                            <p className="font-black text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Setting</p>
                                            <p className="font-medium">{sceneSummary.setting}</p>
                                        </div>
                                    </div>
                                )}
                                {sceneSummary.emotion !== "neutral" && (
                                    <div className="flex gap-3 items-start">
                                        <span className="text-xl">
                                            {sceneSummary.emotion === "joy" ? "😄" : sceneSummary.emotion === "anger" ? "😠" : sceneSummary.emotion === "fear" ? "😨" : sceneSummary.emotion === "sadness" ? "😢" : sceneSummary.emotion === "tension" ? "⚡" : "🎭"}
                                        </span>
                                        <div>
                                            <p className="font-black text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Mood of this scene</p>
                                            <p className="font-medium capitalize">{sceneSummary.emotion}</p>
                                        </div>
                                    </div>
                                )}
                                {sceneSummary.characters.length > 0 && (
                                    <div className="flex gap-3 items-start">
                                        <span className="text-xl">👥</span>
                                        <div>
                                            <p className="font-black text-xs uppercase tracking-wide text-muted-foreground mb-1">Characters in this scene</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {sceneSummary.characters.map(c => (
                                                    <span key={c} className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">{c}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {sceneSummary.archiPhrases.length > 0 && (
                                    <div className="flex gap-3 items-start">
                                        <span className="text-xl">📖</span>
                                        <div>
                                            <p className="font-black text-xs uppercase tracking-wide text-muted-foreground mb-1">Old English phrases you saw</p>
                                            <div className="space-y-1">
                                                {sceneSummary.archiPhrases.slice(0, 3).map(p => (
                                                    <p key={p.word} className="text-xs"><span className="font-bold italic">"{p.word}"</span> → {p.modern_meaning}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button
                                className="mt-6 w-full py-3 rounded-2xl bg-primary text-primary-foreground font-black text-sm hover:bg-primary/90 transition-colors"
                                onClick={() => { setSceneSummary(null); handleNextSection(); }}
                            >
                                Continue to next scene →
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                className={`max-w-4xl mx-auto transition-all duration-500 pb-24 ${focusMode ? "pt-0" : "pt-4"}`}
                style={{ lineHeight: adaptation.lineSpacing, fontSize: `${adaptation.fontSize}em`, fontFamily: dyslexicMode ? "OpenDyslexic, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" : "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
            >
                <AnimatePresence>
                    {!focusMode && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            className="flex items-center justify-between mb-8 flex-wrap gap-3"
                        >
                            <Button variant="ghost" size="sm" className="gap-2 font-bold" onClick={() => navigate("/student/lessons")}>
                                <ArrowLeft className="w-4 h-4" /> {t("reader.exitReader")}
                            </Button>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* RL Engine badge */}
                                <div className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 flex items-center gap-2">
                                    <BrainCircuit className="w-3 h-3" />
                                    {rlLoading ? t("reader.analysing") : t("reader.adaptiveEngineActive")}
                                </div>
                                {/* Attention score */}
                                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-2">
                                    <Zap className="w-3 h-3" />
                                    Attention {Math.round(attentionState.attentionScore * 100)}%
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── RL Action Toast notification ── */}
                <AnimatePresence>
                    {showRLBadge && adaptation.actionId !== 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/20 bg-primary/5"
                        >
                            <span className="text-xl">{actionInfo.icon}</span>
                            <div>
                                <p className="text-xs font-black text-primary uppercase tracking-widest">
                                    RL Adaptation Applied
                                </p>
                                <p className="text-sm font-bold">{actionInfo.label}</p>
                            </div>
                            <Badge variant="secondary" className="ml-auto text-[10px] font-bold">
                                {adaptation.model === "ppo" ? "PPO Model" : "Rule-Based"}
                            </Badge>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Chapter Navigation Bar ── */}
                {!focusMode && totalSections > 1 && (
                    <div className="mb-6 p-4 bg-secondary/20 rounded-[24px] border border-border/50 overflow-x-auto scrollbar-none">
                        {sectionGroups ? (
                            /* Play: grouped Act → Scene navigation */
                            <div className="flex flex-col gap-3">
                                {sectionGroups.map((group) => (
                                    <div key={group.actTitle} className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/70 shrink-0 min-w-[48px]">
                                            {group.actTitle}
                                        </span>
                                        <div className="w-px h-4 bg-border/60 shrink-0" />
                                        {group.scenes.map(({ idx, sceneTitle: st }) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setCurrentSectionIndex(idx);
                                                    saveProgress(idx);
                                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                                }}
                                                className={`shrink-0 rounded-xl px-3 py-1.5 font-bold text-xs transition-all whitespace-nowrap
                                                    ${currentSectionIndex === idx
                                                        ? "bg-primary text-primary-foreground shadow-lg"
                                                        : "bg-background border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                                                    }`}
                                            >
                                                {st}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* Novel / Generic: flat chapter navigation */
                            <div className="flex items-center gap-3 flex-wrap">
                                <BookOpen className="w-4 h-4 text-primary shrink-0" />
                                {sections.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setCurrentSectionIndex(idx);
                                            saveProgress(idx);
                                            window.scrollTo({ top: 0, behavior: "smooth" });
                                        }}
                                        className={`shrink-0 rounded-xl px-4 py-2 font-bold text-xs transition-all whitespace-nowrap
                                            ${currentSectionIndex === idx
                                                ? "bg-primary text-primary-foreground shadow-lg"
                                                : "bg-background border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                                            }`}
                                    >
                                        {`Chapter ${idx + 1}`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Introduction Modal ── */}
                <AnimatePresence>
                    {showIntro && intro && !focusMode && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ type: "spring", damping: 20 }}
                            className="mb-6 p-6 rounded-3xl bg-gradient-to-br from-primary/5 to-accent/5 border-2 border-primary/20 shadow-lg"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-2">About This Book</h3>
                                    <p className="text-base font-medium text-foreground/80 leading-relaxed">
                                        {intro}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => setShowIntro(false)}
                                >
                                    <span className="text-lg">×</span>
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Overall Progress ── */}
                {!focusMode && totalSections > 1 && (
                    <div className="mb-6 flex items-center gap-4 px-1">
                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground shrink-0">
                            {currentSectionIndex + 1} / {totalSections}
                        </span>
                        <Progress value={((currentSectionIndex + 1) / totalSections) * 100} className="h-1.5 flex-1 rounded-full bg-secondary" />
                        <span className="text-xs font-black uppercase tracking-widest text-primary shrink-0">
                            {Math.round(((currentSectionIndex + 1) / totalSections) * 100)}%
                        </span>
                    </div>
                )}

                {/* ── ADHD micro-break prompt + gamification counter ── */}
                <AnimatePresence>
                    {adaptation.isChunked && !focusMode && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="mb-4 flex items-center gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700"
                        >
                            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-black text-rose-600 uppercase tracking-widest">
                                    {t("reader.attentionSupportActive")}
                                </p>
                                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                                    {t("reader.contentChunked")}
                                </p>
                            </div>
                            {/* Gamification: show how many sections to next quiz checkpoint */}
                            {totalSections > 1 && (() => {
                                const CHECKPOINT_EVERY = 3; // quiz every 3 sections
                                const nextCheckpoint = (Math.floor(currentSectionIndex / CHECKPOINT_EVERY) + 1) * CHECKPOINT_EVERY;
                                const remaining = Math.max(1, nextCheckpoint - currentSectionIndex);
                                return (
                                    <div className="shrink-0 text-right">
                                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                                            {t("reader.toCheckpoint")}
                                        </p>
                                        <p className="text-xl font-black text-rose-600">{remaining}</p>
                                        <p className="text-[10px] text-rose-400 font-bold">
                                            {remaining === 1 ? t("reader.section") : t("reader.sections")}
                                        </p>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Reader Card ── */}
                <Card className={`rounded-[40px] border-2 border-border shadow-2xl transition-all duration-500 overflow-hidden ${focusMode ? "bg-secondary/20 border-primary/20" : "bg-card"}`}>

                    {/* Internal Header */}
                    <div className="p-8 border-b border-border/50 flex items-center justify-between bg-secondary/10 flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{lesson?.title}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-muted-foreground font-medium">{lesson?.author}</p>
                                {totalSections > 1 && (
                                    <>
                                        <span className="text-muted-foreground">·</span>
                                        <span className="text-sm font-bold text-primary">
                                            {`Chapter ${currentSectionIndex + 1}`}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {bookBrain?.characters?.length > 0 && (
                                <Button
                                    variant={showCharacterMap ? "default" : "secondary"}
                                    size="sm"
                                    className="rounded-xl h-10 px-4 font-bold gap-2"
                                    onClick={() => setShowCharacterMap(v => !v)}
                                >
                                    <Users className="w-4 h-4" />
                                    {t("reader.characters")}
                                </Button>
                            )}
                            <Button
                                variant={focusMode ? "default" : "secondary"}
                                size="sm"
                                className="rounded-xl h-10 px-4 font-bold gap-2"
                                onClick={() => setFocusMode(!focusMode)}
                            >
                                {focusMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                {focusMode ? t("reader.focusModeOn") : t("reader.focusMode")}
                            </Button>
                        </div>
                    </div>

                    {/* Reading Content */}
                    <CardContent className="p-8 md:p-12 select-text">
                        {contentType === "poem" ? (
                            /* Poem mode — centered verse with emotion gradients + rhyme scheme (Phase 2) */
                            <PoemRenderer
                                text={currentSection.content || ""}
                                title={lesson?.title || sceneTitle || ""}
                                author={lesson?.author}
                                language={lesson?.language?.startsWith("fr") ? "fr" : "en"}
                                dyslexicFont={dyslexiaSettings.openDyslexicFont}
                                aiUrl={AI_URL}
                                onLineHighlight={(line) => {
                                    // Let student use Highlight-to-Understand on any line
                                    if (window.getSelection) window.getSelection()?.removeAllRanges();
                                }}
                            />
                        ) : contentType === "play" && dialogueLines.length > 0 ? (
                            /* Play with parsed dialogue lines → animated bubbles */
                            <PlayDialogueUI
                                lines={dialogueLines}
                                actTitle={actTitle}
                                sceneTitle={sceneTitle}
                                dyslexicFont={dyslexiaSettings.openDyslexicFont}
                                autoAdvance={adaptation.isTTSEnabled}
                                charactersOnStage={currentSection.characters_present}
                                characterFactions={
                                    currentSection.faction
                                        ? Object.fromEntries(
                                            (currentSection.characters_present || []).map(c => [c.toUpperCase(), currentSection.faction!])
                                        )
                                        : undefined
                                }
                                onComplete={() => {
                                    // Show "What just happened?" summary before advancing (Phase 2)
                                    if (currentSection.characters_present?.length || currentSection.emotion) {
                                        setSceneSummary({
                                            emotion: currentSection.emotion || "neutral",
                                            setting: currentSection.setting || "",
                                            characters: currentSection.characters_present || [],
                                            archiPhrases: currentSection.archaic_phrases || [],
                                        });
                                    } else {
                                        handleNextSection();
                                    }
                                }}
                            />
                        ) : displayText.trim().length > 0 ? (
                            /* All prose (generic/novel/play-without-dialogue) → DyslexiaText renderer.
                               DyslexiaText handles bionic reading, syllable colors, reading ruler,
                               spacing and font — all driven by the RL-derived dyslexiaSettings.
                               Word-highlight overlay is applied on top for TTS sync. */
                            <div className="relative">
                                {/* Novel mode: characters in this section chip strip (Phase 2) */}
                                {contentType === "novel" && (currentSection.characters_present?.length ?? 0) > 0 && (
                                    <div className="flex items-center gap-2 flex-wrap mb-4 pb-3 border-b border-border/40">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">In this section:</span>
                                        {(currentSection.characters_present ?? []).map((name: string) => (
                                            <CharacterTooltip
                                                key={name}
                                                text={name}
                                                characters={bookBrain?.characters || []}
                                                familiarityScores={lesson?.comprehensionScores}
                                                className="inline"
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* TTS word-highlight overlay (generic mode) */}
                                {contentType === "generic" && isPlaying && !adaptation.isTTSEnabled && (
                                    <div
                                        className="reading-area absolute inset-0 pointer-events-none"
                                        style={{
                                            lineHeight: dyslexiaSettings.lineHeight,
                                            fontSize: `${dyslexiaSettings.fontSize}rem`,
                                            letterSpacing: `${dyslexiaSettings.letterSpacing}px`,
                                            wordSpacing: `${dyslexiaSettings.wordSpacing}px`,
                                            whiteSpace: "pre-wrap",
                                            fontFamily: dyslexiaSettings.openDyslexicFont ? "'OpenDyslexic', sans-serif" : "inherit"
                                        }}
                                        aria-hidden="true"
                                    >
                                        {displayWords.map((word: string, idx: number) => (
                                            <motion.span
                                                key={idx}
                                                animate={{
                                                    backgroundColor: activeWordIndex === idx
                                                        ? "rgba(253, 224, 71, 0.8)"
                                                        : "transparent",
                                                    scale: activeWordIndex === idx ? 1.05 : 1,
                                                    color: activeWordIndex === idx ? "#000" : "inherit",
                                                }}
                                                className="inline-block px-0.5 rounded"
                                            >
                                                {word}{" "}
                                            </motion.span>
                                        ))}
                                    </div>
                                )}
                                <DyslexiaText
                                    text={displayText}
                                    settings={dyslexiaSettings}
                                    className="text-xl md:text-2xl"
                                />
                            </div>
                        ) : (
                            /* Empty section — use Next to continue */
                            <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
                                <BookOpen className="w-12 h-12 opacity-30" />
                                <p className="text-sm font-bold uppercase tracking-widest opacity-50">
                                    {actTitle && sceneTitle ? `${actTitle} · ${sceneTitle}` : "Transition"}
                                </p>
                                <p className="text-base font-medium opacity-40">Press Next to continue reading</p>
                            </div>
                        )}
                    </CardContent>

                    {/* Player Controls */}
                    <div className="p-8 bg-secondary/30 border-t border-border/50">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex items-center gap-4">
                                <Button
                                    size="icon"
                                    className="w-14 h-14 rounded-full shadow-lg glow-lime transition-transform hover:scale-110 active:scale-95"
                                    onClick={() => setIsPlaying(!isPlaying)}
                                >
                                    {isPlaying
                                        ? <Pause className="w-6 h-6" />
                                        : adaptation.isTTSEnabled
                                            ? <Volume2 className="w-6 h-6" />
                                            : <Play className="w-6 h-6 ml-1" />
                                    }
                                </Button>
                                <Button
                                    variant="ghost" size="icon" className="w-10 h-10 rounded-full"
                                    onClick={() => { setCurrentTime(0); setActiveWordIndex(-1); setIsPlaying(false); window.speechSynthesis?.cancel(); }}
                                >
                                    <RotateCcw className="w-5 h-5" />
                                </Button>
                            </div>
                            <div className="flex-1 w-full space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                                    <span>
                                        {adaptation.isTTSEnabled ? "🔊 TTS Active" : "Voice Activity"}
                                    </span>
                                    <span>Attention {Math.round(attentionState.attentionScore * 100)}%</span>
                                </div>
                                <Progress value={attentionState.attentionScore * 100} className="h-2 rounded-full bg-background" />
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3 text-muted-foreground group">
                                    <Type className="w-5 h-5 group-hover:text-primary transition-colors" />
                                    <div className="w-20">
                                        <Slider defaultValue={[100]} max={150} min={80} step={1} />
                                    </div>
                                </div>
                                <div className="h-8 w-px bg-border" />
                                <Button
                                    className="rounded-xl font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={() => navigate(`/student/quiz/${id}`)}
                                >
                                    <BrainCircuit className="w-4 h-4" /> Quiz
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Chapter Navigation Controls */}
                    {totalSections > 1 && (
                        <div className="p-6 bg-background/50 border-t border-border flex items-center justify-between gap-4">
                            <Button
                                variant="outline" className="rounded-xl px-6 font-bold gap-2"
                                onClick={handlePrevSection} disabled={currentSectionIndex === 0}
                            >
                                <ChevronLeft className="w-4 h-4" /> {t("reader.previous")}
                            </Button>
                            <div className="text-center">
                                <p className="text-sm font-black text-muted-foreground">
                                    {`Chapter ${currentSectionIndex + 1} of ${totalSections}`}
                                </p>
                            </div>
                            <Button
                                className="rounded-xl px-6 font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={handleNextSection}
                            >
                                {currentSectionIndex < totalSections - 1 ? t("reader.next") : t("reader.finish")} <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </Card>

                {/* Quiz Engagement Prompt */}
                <AnimatePresence>
                    {showQuizPrompt && !focusMode && (
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.9 }}
                            className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[400px] p-6 rounded-[32px] bg-accent text-accent-foreground shadow-2xl z-50 border-4 border-white dark:border-primary-foreground/20"
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                                    <BrainCircuit className="w-7 h-7" />
                                </div>
                                <div>
                                    <h4 className="font-black text-sm uppercase tracking-widest mb-1 leading-none">Checkpoint!</h4>
                                    <p className="text-md font-bold leading-tight">Ready for a quick knowledge check? Earn +200 XP!</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Button className="rounded-xl font-black h-12 bg-white text-accent hover:bg-white/90 shadow-lg" onClick={() => navigate(`/student/quiz/${id}`)}>Let's Go!</Button>
                                <Button variant="ghost" className="rounded-xl font-bold h-12 text-white hover:bg-white/10" onClick={() => setShowQuizPrompt(false)}>Later</Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* ── Comprehension Mini-Panel ─────────────────────────────────────
                Shows the student their live comprehension graph for this book:
                characters recognised, vocabulary progress, chapter scores. */}
            {!focusMode && user && id && (
                <ComprehensionMiniPanel
                    studentId={user.uid}
                    bookId={id}
                    aiUrl={AI_URL}
                />
            )}

            {/* ── Vocabulary Sidebar (Phase 2 — Novel/Generic mode) ─────────────
                Fixed slide-in panel showing difficult words for this section.
                Only shown for non-play content types. */}
            {contentType !== "play" && !focusMode && bookBrain?.vocabulary && (
                <VocabSidebar
                    sectionContent={currentSection.content || ""}
                    bookVocabulary={bookBrain.vocabulary}
                    archiPhrases={currentSection.archaic_phrases}
                    onWordLookup={(word) => {
                        // Record vocab lookup in comprehension graph
                        if (user && id) {
                            fetch(`${AI_URL}/comprehension/vocab`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ student_id: user.uid, book_id: id, word }),
                            }).catch(() => { });
                        }
                    }}
                    language={lesson?.language}
                />
            )}

            {/* ── Character Map Panel (Phase 5) ────────────────────────────────
                Fixed right-side drawer showing character relationship graph.
                Toggled by the "Characters" button in the reader header.
                Only shown when bookBrain has character data. */}
            <AnimatePresence>
                {showCharacterMap && bookBrain?.characters?.length > 0 && (
                    <motion.div
                        initial={{ x: "100%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed right-0 top-0 h-full w-80 z-40 bg-card border-l border-border shadow-2xl overflow-y-auto"
                    >
                        <CharacterMapPanel
                            characters={bookBrain.characters}
                            currentSectionIndex={currentSectionIndex}
                            familiarityScores={lesson?.comprehensionScores ?? {}}
                            onClose={() => setShowCharacterMap(false)}
                            language={lesson?.language}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Click-outside overlay for character map */}
            {showCharacterMap && (
                <div
                    className="fixed inset-0 z-30 bg-black/20"
                    onClick={() => setShowCharacterMap(false)}
                />
            )}

            {/* ── Highlight-to-Understand popup (Deliverable 2) ─────────────────
                Listens globally for text selection anywhere on the page.
                Sends highlighted text to /simplify and shows a floating card
                with: simplified version, author intent, vocabulary, Kinyarwanda bridge. */}
            <HighlightToUnderstand
                bookTitle={lesson?.title || ""}
                author={lesson?.author || ""}
                docType={contentType}
                language={lesson?.language?.startsWith("fr") ? "fr" : "en"}
                studentId={user?.uid}
                bookId={id}
                chapterContext={currentSection.content?.slice(0, 300) || ""}
                archiPhrases={currentSection.archaic_phrases}
                bookVocabulary={bookBrain?.vocabulary}
                onVocabSave={(word) => {
                    // Record the vocab lookup in the comprehension graph
                    if (user && id) {
                        fetch(`${AI_URL}/comprehension/vocab`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ student_id: user.uid, book_id: id, word }),
                        }).catch(() => { });
                    }
                }}
                onTTSPlay={(text) => {
                    if (window.speechSynthesis) {
                        window.speechSynthesis.cancel();
                        const u = new SpeechSynthesisUtterance(text);
                        u.rate = 0.85;
                        window.speechSynthesis.speak(u);
                    }
                }}
                onHighlightCategorized={(text, category) => {
                    // Phase 4: apply targeted EMA update to learner embedding
                    if (user) {
                        fetch(`${AI_URL}/learner/highlight-feedback`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                student_id: user.uid,
                                category,
                                highlighted_text: text.slice(0, 200),
                                difficulty_estimate: attentionState.scrollHesitation,
                            }),
                        }).catch(() => { });
                    }
                }}
            />
        </DashboardLayout>
    );
};

export default AdaptiveReader;
