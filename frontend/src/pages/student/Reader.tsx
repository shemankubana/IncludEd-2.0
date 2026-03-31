/**
 * Reader.tsx — Adaptive reading interface.
 *
 * Features:
 *  - PlayDialogueUI: animated avatar dialogue for plays
 *  - Chapter navigation with lazy loading + IndexedDB progress
 *  - BookBrain vocabulary, character map, struggle zones
 *  - ADHD micro-checks and breathing breaks
 *  - Scene summary cards for plays
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
    BookOpen, ChevronLeft, ChevronRight, Volume2,
    AlertCircle, Users, Mic, CheckCircle2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import PlayDialogueUI, { type DialogueLine } from "@/components/play/PlayDialogueUI";
import HighlightToUnderstand from "@/components/LiteratureViewer/HighlightToUnderstand";
import ReadingAssessment from "@/components/LiteratureViewer/ReadingAssessment";
import { DyslexiaText, DyslexiaControls, type DyslexiaSettings, DEFAULT_DYSLEXIA_SETTINGS } from "@/components/LiteratureViewer/DyslexiaRenderer";
import ComprehensionMiniPanel from "@/components/reader/ComprehensionMiniPanel";
import VocabSidebar from "@/components/reader/VocabSidebar";
import CharacterTooltip from "@/components/reader/CharacterTooltip";
import PoemRenderer from "@/components/reader/PoemRenderer";
import CharacterMapPanel from "@/components/reader/CharacterMapPanel";
import { useTranslation } from "@/hooks/useTranslation";
import { useTranslation as useI18n } from "@/i18n";
import ChapterNavigation from "@/components/reader/ChapterNavigation";
import PronunciationHelper from "@/components/reader/PronunciationHelper";
import { useToast } from "@/components/ui/use-toast";


// ── Types ──────────────────────────────────────────────────────────────────────

interface Section {
    title: string;
    content: string;
    simplified_content?: string;
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
    const { toast } = useToast();

    // Reader state
    const [isPlaying, setIsPlaying] = useState(false);
    const [ttsProgress, setTtsProgress] = useState(0);
    const [focusMode, setFocusMode] = useState(false);
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lesson, setLesson] = useState<any>(null);
    const [intro, setIntro] = useState<string | null>(null);
    const [showIntro, setShowIntro] = useState(true);
    const [sections, setSections] = useState<Section[]>([]);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [allQuizzes, setAllQuizzes] = useState<any[]>([]);
    const [showQuizPrompt, setShowQuizPrompt] = useState(false);
    const [timeInChapter, setTimeInChapter] = useState(0); // seconds
    const [lastSyncTime, setLastSyncTime] = useState(Date.now());
    const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
    const [contentType, setContentType] = useState<"play" | "novel" | "poem" | "generic">("generic");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [idToken, setIdToken] = useState<string | null>(null);
    const [progress, setProgress] = useState<any>(null);

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
    const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [breathingBreak, setBreathingBreak] = useState(false);
    const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
    const [cliffhangerTeaser, setCliffhangerTeaser] = useState<string | null>(null);
    const breathIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const ADHD_SECTION_BREAK_EVERY = 3; // show breathing break every N sections
    const adhdSectionCountRef = useRef(0);

    // Character Map panel state (Phase 5)
    const [showCharacterMap, setShowCharacterMap] = useState(false);

    // Phonics Helper state
    const [phonicsWord, setPhonicsWord] = useState<string | null>(null);

    // STT Reading Assessment state
    const [showSTT, setShowSTT] = useState(false);

    // Phase 3: Teacher Insights Telemetry
    const [showDifficultyModal, setShowDifficultyModal] = useState(false);
    const [pendingDifficulty, setPendingDifficulty] = useState<number | null>(null);
    const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Initial settings from profile, then user can override
    // Load persisted settings from localStorage
    const [dyslexiaSettings, setDyslexiaSettings] = useState<DyslexiaSettings>(() => {
        try {
            const saved = localStorage.getItem('included_reading_settings');
            if (saved) return { ...DEFAULT_DYSLEXIA_SETTINGS, ...JSON.parse(saved) };
        } catch { /* ignore parse errors */ }
        return DEFAULT_DYSLEXIA_SETTINGS;
    });

    const { t } = useTranslation(lesson?.language);
    const { language: uiLang, t: tI18n } = useI18n();
    const sessionStartRef = useRef<number>(Date.now());

    // Detect language mismatch between user preference and content language
    const contentLang = lesson?.language; // 'english' | 'french' | undefined
    const userLang = uiLang === "fr" ? "french" : "english";
    const hasLangMismatch = !!contentLang && contentLang !== userLang;
    const AI_URL = import.meta.env.VITE_AI_URL || "http://localhost:8082";

    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const [, setCurrentTime] = useState(0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    // Track if we are currently fetching AI audio to prevent local TTS from starting simultaneously
    const isFetchingAudioRef = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ttsRef = useRef<SpeechSynthesisUtterance | null>(null);
    const attentionPoints = useRef<number[]>([]);
    const lastHeartbeatRef = useRef<number>(Date.now());

    const totalSections = sections.length;

    // Sequential Progression Logic
    const highestUnlockedIndex = useMemo(() => {
        if (completedSections.size === 0) return 0;
        const maxCompleted = Math.max(...Array.from(completedSections));
        return Math.min(maxCompleted + 1, totalSections - 1);
    }, [completedSections, totalSections]);
    const currentSection = sections[currentSectionIndex] || { title: "", content: "" };

    // Persist reading settings to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('included_reading_settings', JSON.stringify(dyslexiaSettings));
        } catch { /* storage might be full */ }
    }, [dyslexiaSettings]);

    useEffect(() => {
        setDyslexiaSettings(prev => ({
            ...prev,
            openDyslexicFont: dyslexicMode || false,
            bionicReading: dyslexicMode ? true : prev.bionicReading
        }));
    }, [dyslexicMode]);

    const safeContent = currentSection.content || "";
    const words = safeContent.split(/\s+/).filter(Boolean);
    const displayText = safeContent;

    // ── Navigation & Utils (Moved up for hoisting) ──────────────────────────────
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

    const checkStruggleZone = useCallback((nextIdx: number) => {
        if (!bookBrain) return;
        const nextSection = sections[nextIdx];
        if (!nextSection) return;

        const diffEntry = bookBrain.difficulty_map?.find(
            (d: any) => d.section_title === nextSection.title || d.section_id === `section_${nextIdx}`
        );
        const isStruggle = diffEntry?.overall_difficulty > 0.6 ||
            bookBrain.struggle_zones?.some(
                (z: any) => z.section_title === nextSection.title || z.section_id === `section_${nextIdx}`
            );

        if (isStruggle && bookBrain.vocabulary?.length > 0) {
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

    const maybeTriggerMicroCheck = useCallback(() => {
        const isAdhd = (profile?.disabilityType === "adhd" || profile?.disabilityType === "both");
        if (!isAdhd) return false;

        const chunkQuiz = allQuizzes.find(q => q.chunkIndex === currentSectionIndex);
        if (chunkQuiz) {
            setMicroCheck({
                id: chunkQuiz.id,
                question: chunkQuiz.question,
                options: chunkQuiz.options,
                answer: chunkQuiz.correctAnswer,
            });
            setMicroCheckAnswer(null);
            return true;
        }

        const sec = sections[currentSectionIndex];
        if (!sec?.content) return false;
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
            answer: 0,
        });
        setMicroCheckAnswer(null);
        return true;
    }, [profile, allQuizzes, currentSectionIndex, sections]);

    const startBreathingBreak = useCallback(() => {
        setBreathingBreak(true);
        setBreathPhase("inhale");
        const phases: ("inhale" | "hold" | "exhale")[] = ["inhale", "hold", "exhale"];
        let phaseIdx = 0;
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
        }, 4000);
    }, []);

    const handleNextSection = useCallback(() => {
        const sectionWords = currentSection.wordCount ?? words.length;
        if (!microCheck) {
            const triggered = maybeTriggerMicroCheck();
            if (triggered) return;
        }

        if (currentSectionIndex < totalSections - 1) {
            const next = currentSectionIndex + 1;
            checkStruggleZone(next);
            if (profile?.disabilityType === "adhd" || profile?.disabilityType === "both") {
                adhdSectionCountRef.current += 1;
                if (adhdSectionCountRef.current >= ADHD_SECTION_BREAK_EVERY) {
                    adhdSectionCountRef.current = 0;
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
            if (next > highestUnlockedIndex && !completedSections.has(currentSectionIndex)) {
                toast({
                    title: "Section Locked",
                    description: "Please mark this section as complete before moving forward.",
                    variant: "destructive",
                });
                return;
            }
            setCurrentSectionIndex(next);
            saveProgress(next, "in_progress");
            setTimeInChapter(0);
            microCheckWordsRef.current += sectionWords;
            setActiveWordIndex(-1);
            setCurrentTime(0);
            setIsPlaying(false);
            setMicroCheck(null);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            saveProgress(currentSectionIndex, "completed");
            if (sessionId && idToken) {
                fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/sessions/${sessionId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                    body: JSON.stringify({
                        completionRate: 1.0,
                        avgAttentionScore: getAvgAttention(),
                        status: "completed",
                    }),
                }).catch(() => { });
            }
            navigate(`/student/quiz/${id}?sessionId=${sessionId}`);
        }
    }, [
        currentSectionIndex, totalSections, saveProgress,
        currentSection.wordCount, words.length, sessionId, idToken,
        navigate, id, checkStruggleZone, maybeTriggerMicroCheck, microCheck,
        profile, sections, startBreathingBreak, completedSections, highestUnlockedIndex,
    ]);

    const handlePrevSection = useCallback(() => {
        if (currentSectionIndex > 0) {
            const prev = currentSectionIndex - 1;
            setCurrentSectionIndex(prev);
            saveProgress(prev, "in_progress");
            setTimeInChapter(0);
            setActiveWordIndex(-1);
            setCurrentTime(0);
            setIsPlaying(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [currentSectionIndex, saveProgress]);
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

    // ── Attention Tracking ──────────────────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            // Simple visibility-based attention score
            attentionPoints.current.push(document.visibilityState === 'visible' ? 1.0 : 0.0);
        }, 10000); // Sample every 10s
        return () => clearInterval(interval);
    }, []);

    const getAvgAttention = () => {
        if (attentionPoints.current.length === 0) return 1.0;
        return attentionPoints.current.reduce((a, b) => a + b, 0) / attentionPoints.current.length;
    };

    // ── Periodic Heartbeat ──────────────────────────────────────────────────
    useEffect(() => {
        if (!sessionId || !idToken) return;

        const interval = setInterval(async () => {
            try {
                const avgAttn = getAvgAttention();
                await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/sessions/${sessionId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                    body: JSON.stringify({ 
                        avgAttentionScore: avgAttn,
                        status: 'active',
                        completionRate: currentSectionIndex / Math.max(totalSections, 1)
                    }),
                });
            } catch (e) { /* silent fail */ }
        }, 60000); // Pulse every minute

        return () => clearInterval(interval);
    }, [sessionId, idToken, currentSectionIndex, totalSections]);

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

                setLesson({ title: data.title, author: data.author, difficulty: data.difficulty || "Adaptive", language: data.language || "english" });
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

                // Load section index from IndexedDB first (offline-safe)
                const cachedSection = await idbGetProgress(id);

                // Always fetch server progress for completedSections + quizScores
                try {
                    const token2 = await user.getIdToken();
                    setIdToken(token2);
                    const progressRes = await fetch(
                        `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/progress/${id}`,
                        { headers: { Authorization: `Bearer ${token2}` } }
                    );
                    if (progressRes.ok) {
                        const pd = await progressRes.json();
                        setProgress(pd);
                        if (pd?.completedSections) {
                            setCompletedSections(new Set(pd.completedSections));
                        }
                        // Use server section if no IndexedDB cache
                        if (cachedSection === null && pd?.currentSection !== undefined) {
                            setCurrentSectionIndex(pd.currentSection);
                        }
                    }

                    // Fetch quizzes to check for gate
                    const quizRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/quiz/${id}`, {
                        headers: { Authorization: `Bearer ${token2}` }
                    });
                    if (quizRes.ok) {
                        setQuizzes(await quizRes.json());
                    }
                } catch { /* offline fallback */ }

                // Use IndexedDB cached section index (most recent)
                if (cachedSection !== null) {
                    setCurrentSectionIndex(cachedSection);
                    if (cachedSection > 0 && user) {
                        try {
                            const aiUrl = import.meta.env.VITE_AI_URL || "http://localhost:8000";
                            const recapRes = await fetch(
                                `${aiUrl}/comprehension/recap?student_id=${user.uid}&book_id=${id}`
                            );
                            if (recapRes.ok) {
                                const rd = await recapRes.json();
                                if (rd.chapters_completed && rd.chapters_completed.length > 0) {
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
                }
            } catch (error) {
                console.error("Failed to fetch lesson:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLesson();
    }, [id, user]);

    // ── AI Powered TTS (Edge-TTS) ──────────────────────────────────────────
    useEffect(() => {
        const fetchAudio = async () => {
            if (!isPlaying || currentChunkIndex !== 0) return; // Only fetch at start of section
            if (audioUrl) return; // Already fetched
            
            // Cancel any local TTS that may have started before AI audio was ready
            window.speechSynthesis?.cancel();
            isFetchingAudioRef.current = true;
            setIsSynthesizing(true);
            try {
                const response = await fetch(`${AI_URL}/tts/synthesize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: displayText,
                        language: lesson?.language || "english",
                        disability_type: profile?.disabilityType || "none"
                    })
                });
                
                if (!response.ok) throw new Error("Synthesis failed");
                const data = await response.json();
                const blob = await (await fetch(`data:audio/mp3;base64,${data.audio_base64}`)).blob();
                const url = URL.createObjectURL(blob);
                // Cancel again right before we play to ensure local TTS is stopped
                window.speechSynthesis?.cancel();
                setAudioUrl(url);
            } catch (err) {
                console.warn("AI TTS failed, falling back to local:", err);
            } finally {
                setIsSynthesizing(false);
                isFetchingAudioRef.current = false;
            }
        };

        if (isPlaying && !audioUrl && !isSynthesizing) {
            fetchAudio();
        }
    }, [isPlaying, displayText, audioUrl]);

    useEffect(() => {
        if (!isPlaying) {
            audioRef.current?.pause();
            return;
        }

        if (audioUrl) {
            if (!audioRef.current) {
                audioRef.current = new Audio(audioUrl);
                audioRef.current.onended = () => {
                    if (currentSectionIndex < totalSections - 1) {
                        handleNextSection();
                        setIsPlaying(true);
                    } else {
                        setIsPlaying(false);
                        setTtsProgress(100);
                    }
                };
                audioRef.current.ontimeupdate = () => {
                    if (audioRef.current) {
                        const prog = (audioRef.current.currentTime / audioRef.current.duration) * 100;
                        setTtsProgress(prog || 0);
                    }
                };
            } else if (audioRef.current.src !== audioUrl) {
                audioRef.current.src = audioUrl;
            }
            audioRef.current.play().catch(e => console.error("Audio play failed:", e));
        }
    }, [isPlaying, audioUrl, handleNextSection, currentSectionIndex, totalSections]);

    // Cleanup audio
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            audioRef.current?.pause();
        };
    }, [audioUrl]);

    const ttsChunks = useMemo(() => {
        if (!displayText) return [];
        // Split by sentences (dot, exclamation, question mark followed by space)
        return displayText.match(/[^\.!\?]+[\.!\?]+/g) || [displayText];
    }, [displayText]);

    // Local TTS Fallback (Chunked)
    useEffect(() => {
        // Skip local TTS if AI audio is available OR if we are currently fetching AI audio
        // This is the key guard against the double-voice race condition
        // Using ref for synchronous check
        if (audioUrl || isFetchingAudioRef.current || isSynthesizing) return;
        
        if (!isPlaying || !window.speechSynthesis || ttsChunks.length === 0) {
            window.speechSynthesis?.cancel();
            return;
        }

        if (currentChunkIndex >= ttsChunks.length) {
            setIsPlaying(false);
            setCurrentChunkIndex(0);
            return;
        }

        const utter = new SpeechSynthesisUtterance(ttsChunks[currentChunkIndex]);
        utter.rate = 0.95;
        const interval = setInterval(() => {
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
            }
        }, 10000);

        utter.onend = () => {
            clearInterval(interval);
            if (currentChunkIndex + 1 < ttsChunks.length) {
                setCurrentChunkIndex(prev => prev + 1);
                setTtsProgress(((currentChunkIndex + 1) / ttsChunks.length) * 100);
            } else {
                // Continuous reading: auto-advance to next section
                if (currentSectionIndex < totalSections - 1) {
                    handleNextSection();
                    setIsPlaying(true); // Ensure it keeps playing in next section
                } else {
                    setIsPlaying(false);
                    setTtsProgress(100);
                }
            }
        };

        utter.onboundary = (event) => {
            if (event.name === 'word') {
                const charIndex = event.charIndex;
                const chunkLen = ttsChunks[currentChunkIndex].length;
                const chunkBaseProgress = (currentChunkIndex / ttsChunks.length) * 100;
                const chunkRelativeProgress = (charIndex / chunkLen) * (100 / ttsChunks.length);
                setTtsProgress(chunkBaseProgress + chunkRelativeProgress);
            }
        };

        utter.onerror = (e) => {
            console.error("Local TTS Error:", e);
            clearInterval(interval);
            setIsPlaying(false);
        };

        ttsRef.current = utter;
        window.speechSynthesis.speak(utter);

        return () => clearInterval(interval);
    }, [isPlaying, currentChunkIndex, ttsChunks, audioUrl, isSynthesizing, handleNextSection, currentSectionIndex, totalSections]);

    // Reset when changing section
    useEffect(() => {
        setCurrentChunkIndex(0);
        setAudioUrl(null);
        setIsPlaying(false);
        setTimeInChapter(0); // Reset timer for new section
        
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        window.speechSynthesis?.cancel();
    }, [currentSectionIndex]);

    // ── Mock word highlight timer (for generic mode) ──────────────────────────
    useEffect(() => {
        if (!isPlaying || showQuizPrompt) return; // Silent if quiz prompt already up
        let interval: ReturnType<typeof setInterval>;
        interval = setInterval(() => {
            setCurrentTime((prev) => {
                const next = prev + 0.1;
                if (next > 5) { /* stop mock timer */ return 0; }
                const idx = Math.floor((next / 5) * Math.min(8, displayWords.length));
                setActiveWordIndex(idx);
                // Don't show quiz prompt if TTS is active
                if (next > 4 && !showQuizPrompt && !isPlaying) setShowQuizPrompt(true);
                return next;
            });
        }, 100);
        return () => clearInterval(interval);
    }, [isPlaying, displayWords.length, showQuizPrompt]);

    // ── Play dialogue lines extraction ────────────────────────────────────────
    const dialogueLines: DialogueLine[] = (() => {
        if (contentType !== "play") return [];
        if (currentSection.dialogue && currentSection.dialogue.length > 0) {
            return currentSection.dialogue.filter((d: DialogueLine) => {
                const c = d.content?.trim() || "";
                if (c.length <= 5) return false;
                if (/^\d+$/.test(c)) return false;
                if (/^\d{1,4}\s+\S/.test(c)) return false;
                return true;
            });
        }
        return (currentSection.content || "").split("\n").reduce<DialogueLine[]>((acc, line) => {
            const trimmed = line.trim();
            if (!trimmed || /^\d+$/.test(trimmed)) return acc;
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
                if (!existing.scenes.some(s => s.sceneTitle === sceneLabel)) {
                    existing.scenes.push({ idx, sceneTitle: sceneLabel });
                }
            } else {
                groups.push({ actTitle: act, scenes: [{ idx, sceneTitle: sceneLabel }] });
            }
        });
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
                        Preparing your lesson...
                    </p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="student">
            {/* ── Language Mismatch Banner ── */}
            {hasLangMismatch && (
                <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                        {contentLang === "english"
                            ? tI18n("language.reader_banner_en")
                            : tI18n("language.reader_banner_fr")}
                    </span>
                </div>
            )}
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
                            <p className="text-base leading-relaxed mb-6">
                                {recapText.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                                    part.startsWith('**') && part.endsWith('**')
                                        ? <strong key={i}>{part.slice(2, -2)}</strong>
                                        : part
                                )}
                            </p>
                            <Button className="w-full" onClick={() => setShowRecap(false)}>
                                Continue reading
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Pronunciation Helper Popover ── */}
            <AnimatePresence>
                {phonicsWord && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
                        <div className="pointer-events-auto">
                            <PronunciationHelper 
                                word={phonicsWord} 
                                onClose={() => setPhonicsWord(null)}
                                language={lesson?.language?.startsWith("fr") ? "fr" : "en"}
                            />
                        </div>
                    </div>
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
            <div className={`max-w-4xl mx-auto transition-all duration-500 pb-24 px-4 ${focusMode ? "pt-0" : "pt-4"}`}>
                    <AnimatePresence>
                        {!focusMode && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                                className="flex items-center justify-between mb-8 flex-wrap gap-3"
                            >
                                <Button variant="ghost" size="sm" className="gap-2 font-black uppercase tracking-widest text-xs" onClick={() => navigate("/student/lessons")}>
                                    <ArrowLeft className="w-5 h-5" /> {t("reader.exitReader")}
                                </Button>

                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant={showSettings ? "default" : "secondary"} 
                                        size="sm" 
                                        className="rounded-2xl h-10 px-4 font-bold gap-2 shadow-sm transition-all hover:shadow-md"
                                        onClick={() => setShowSettings(!showSettings)}
                                    >
                                        <Type className="w-4 h-4" />
                                        {showSettings ? "Close Settings" : "Reading Settings"}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Dyslexia Settings Panel ── */}
                    <AnimatePresence>
                        {showSettings && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden mb-8"
                            >
                                <Card className="rounded-[32px] border-2 border-primary/20 bg-background/60 backdrop-blur-xl shadow-2xl p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-primary">Reading Preferences</h3>
                                        <Badge variant="outline" className="rounded-full border-primary/30 text-primary uppercase text-[9px] font-black">Beta Adaptive Features</Badge>
                                    </div>
                                    <DyslexiaControls 
                                        settings={dyslexiaSettings} 
                                        onChange={setDyslexiaSettings} 
                                        alwaysExpanded={true}
                                    />
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>

                {/* ── Sliding Chapter Navigation (Revamp) ── */}
                {!focusMode && totalSections > 1 && (
                    <ChapterNavigation 
                        sections={sections}
                        currentIndex={currentSectionIndex}
                        onSelect={(idx) => {
                            if (idx > highestUnlockedIndex) {
                                toast({
                                    title: "Section Locked",
                                    description: "Please complete previous sections first.",
                                });
                                return;
                            }
                            setCurrentSectionIndex(idx);
                            saveProgress(idx, "in_progress");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        highestUnlockedIndex={highestUnlockedIndex}
                    />
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
                    <div className="mt-8 mb-6 flex items-center gap-4 px-1">
                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground shrink-0">
                            {currentSectionIndex + 1} / {totalSections}
                        </span>
                        <Progress value={((currentSectionIndex + 1) / totalSections) * 100} className="h-1.5 flex-1 rounded-full bg-secondary" />
                        <span className="text-xs font-black uppercase tracking-widest text-primary shrink-0">
                            {Math.round(((currentSectionIndex + 1) / totalSections) * 100)}%
                        </span>
                    </div>
                )}

                {/* ── Reader Card ── */}
                    <Card className={`rounded-[40px] border-2 border-border shadow-2xl transition-all duration-500 overflow-hidden ${focusMode ? "bg-secondary/20 border-primary/20 scale-[1.02]" : "bg-card"}`}>

                    {/* Internal Header */}
                    <div className="p-8 border-b border-border/50 flex items-center justify-between bg-secondary/10 flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-primary">{(lesson?.title || "").replace(/\*\*/g, '')}</h1>
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
                            {bookBrain && (
                                <Button
                                    variant={showCharacterMap ? "default" : "secondary"}
                                    size="sm"
                                    className="rounded-xl h-10 px-4 font-bold gap-2"
                                    disabled={!bookBrain?.characters?.length}
                                    title={!bookBrain?.characters?.length ? "No characters detected for this content" : undefined}
                                    onClick={() => setShowCharacterMap(v => !v)}
                                >
                                    <Users className="w-4 h-4" />
                                    {t("reader.characters")}
                                    {bookBrain?.characters?.length > 0 && (
                                        <span className="ml-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-black px-1.5 py-0.5 min-w-[16px] text-center">
                                            {bookBrain.characters.length}
                                        </span>
                                    )}
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
                            /* Poem mode */
                            <PoemRenderer
                                text={currentSection.content || ""}
                                title={lesson?.title || sceneTitle || ""}
                                author={lesson?.author}
                                language={lesson?.language?.startsWith("fr") ? "fr" : "en"}
                                dyslexicFont={dyslexiaSettings.openDyslexicFont}
                                aiUrl={AI_URL}
                                onLineHighlight={() => {
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
                                autoAdvance={false}
                                charactersOnStage={currentSection.characters_present}
                                characterFactions={
                                    currentSection.faction
                                        ? Object.fromEntries(
                                            (currentSection.characters_present || []).map(c => [c.toUpperCase(), currentSection.faction!])
                                        )
                                        : undefined
                                }
                                onComplete={() => {
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
                            /* All prose (generic/novel/play-without-dialogue) → DyslexiaText renderer */
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
                                {contentType === "generic" && isPlaying && (
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
                            /* Empty section */
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
                                        : <Volume2 className="w-6 h-6" />
                                    }
                                </Button>
                                <Button
                                    variant="ghost" size="icon" className="w-10 h-10 rounded-full"
                                    onClick={() => { setCurrentTime(0); setActiveWordIndex(-1); setIsPlaying(false); window.speechSynthesis?.cancel(); }}
                                >
                                    <RotateCcw className="w-5 h-5" />
                                </Button>
                                <div className="h-8 w-px bg-border/50 mx-2" />
                                <Button
                                    variant="outline"
                                    className={`h-12 px-6 rounded-2xl font-bold gap-3 transition-all shadow-md ${showSTT ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:border-primary/50'}`}
                                    onClick={() => setShowSTT(true)}
                                    title="Read Aloud Practice"
                                >
                                    <Mic className={`w-5 h-5 ${!showSTT ? 'text-primary' : ''}`} />
                                    <span>Practice Reading</span>
                                </Button>
                            </div>
                            <div className="flex-1 w-full space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                                    <span>{isPlaying ? "🔊 TTS Active" : "Voice Activity"}</span>
                                    {isPlaying && (
                                        <span className="text-primary animate-pulse">{Math.round(ttsProgress)}%</span>
                                    )}
                                </div>
                                <Slider 
                                    value={[ttsProgress]} 
                                    max={100} 
                                    step={1} 
                                    className="h-2"
                                    onValueChange={([val]) => {
                                        if (!ttsChunks.length) return;
                                        setTtsProgress(val);
                                        const targetChunk = Math.min(
                                            Math.floor((val / 100) * ttsChunks.length),
                                            ttsChunks.length - 1
                                        );
                                        setCurrentChunkIndex(targetChunk);
                                        if (!isPlaying) setIsPlaying(true);
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Unified Navigation Button */}
                    {!focusMode && (
                        <div className="flex items-center justify-between px-8 pb-8 gap-4 min-h-[5rem]">
                            <Button
                                variant="ghost" 
                                className="rounded-full px-6 font-bold gap-2 text-muted-foreground hover:text-foreground"
                                onClick={handlePrevSection} 
                                disabled={currentSectionIndex === 0}
                            >
                                <ChevronLeft className="w-4 h-4" /> Previous
                            </Button>

                            {(() => {
                                const isCurrentSectionCompleted = completedSections.has(currentSectionIndex);
                                const isLastSection = currentSectionIndex === totalSections - 1;
                                const allSectionsCompleted = completedSections.size === totalSections;

                                if (!isCurrentSectionCompleted) {
                                    return (
                                        <Button
                                            variant="outline"
                                            className="rounded-full px-8 h-12 font-black transition-all hover:border-primary/50 gap-2 shadow-sm"
                                            onClick={async () => {
                                                const newSet = new Set(completedSections);
                                                newSet.add(currentSectionIndex);
                                                setCompletedSections(newSet);
                                                const allDone = newSet.size === totalSections;

                                                saveProgress(currentSectionIndex, allDone ? "completed" : "in_progress");

                                                if (sessionId && idToken) {
                                                    const rate = newSet.size / totalSections;
                                                    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/sessions/${sessionId}`, {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                                                        body: JSON.stringify({
                                                            completionRate: rate,
                                                            status: rate === 1 ? "completed" : "active",
                                                        }),
                                                    }).catch(() => { });
                                                }

                                                if (allDone) {
                                                    // Show feedback only once — at the very end of the entire book
                                                    setShowDifficultyModal(true);
                                                } else {
                                                    // Auto-advance to next section using local newSet (avoids stale-closure Section Locked issue)
                                                    const next = currentSectionIndex + 1;
                                                    setCurrentSectionIndex(next);
                                                    saveProgress(next, "in_progress");
                                                    setTimeInChapter(0);
                                                    setActiveWordIndex(-1);
                                                    setCurrentTime(0);
                                                    setIsPlaying(false);
                                                    setMicroCheck(null);
                                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                                }
                                            }}
                                        >
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            Mark as Complete
                                        </Button>
                                    );
                                }

                                if (!isLastSection) {
                                    const nextIdx = currentSectionIndex + 1;
                                    const nextChunk = Math.floor(nextIdx / 4);
                                    const currentChunk = Math.floor(currentSectionIndex / 4);
                                    const isCrossingBoundary = nextChunk > currentChunk;
                                    const alreadyTookQuiz = progress?.quizScores?.[currentChunk];

                                    // Mandatory quiz gate: must take quiz before crossing a chunk boundary for the first time
                                    if (isCrossingBoundary && !alreadyTookQuiz) {
                                        return (
                                            <div className="flex flex-col items-end gap-2 text-right">
                                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 shadow-sm">
                                                    Knowledge Check Required
                                                </p>
                                                <Button
                                                    className="rounded-full px-8 h-12 font-black gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg glow-primary transition-transform hover:scale-105"
                                                    onClick={() => navigate(`/student/quiz/${id}?sessionId=${sessionId}&chunk=${currentChunk}`)}
                                                >
                                                    <BrainCircuit className="w-5 h-5" />
                                                    Take Knowledge Check
                                                </Button>
                                            </div>
                                        );
                                    }

                                    return (
                                        <Button
                                            className="rounded-full px-8 h-12 font-black gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg glow-primary"
                                            onClick={handleNextSection}
                                        >
                                            Next Section <ChevronRight className="w-5 h-5" />
                                        </Button>
                                    );
                                }

                                return (
                                    <div className="flex flex-col items-end gap-2">
                                        {!allSectionsCompleted && (
                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 whitespace-nowrap shadow-sm backdrop-blur-sm">
                                                Finish all chapters to unlock quiz
                                            </p>
                                        )}
                                        <Button
                                            disabled={!allSectionsCompleted}
                                            className={`rounded-full px-8 h-12 font-black gap-2 transition-all shadow-xl ${allSectionsCompleted ? "bg-accent text-accent-foreground hover:scale-105" : "opacity-50"}`}
                                            onClick={() => {
                                                if (sessionId && idToken) {
                                                    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/sessions/${sessionId}`, {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                                                        body: JSON.stringify({
                                                            completionRate: 1.0,
                                                            avgAttentionScore: getAvgAttention(),
                                                            status: "completed",
                                                        }),
                                                    }).catch(() => { });
                                                }
                                                navigate(`/student/quiz/${id}?sessionId=${sessionId}`);
                                            }}
                                        >
                                            <BrainCircuit className="w-5 h-5" />
                                            Attempt the Quiz
                                        </Button>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </Card>

                {/* Quiz Engagement Prompt */}
                <AnimatePresence>
                    {showQuizPrompt && !focusMode && !isPlaying && (
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
                                <Button className="rounded-xl font-black h-12 bg-white text-accent hover:bg-white/90 shadow-lg" onClick={() => {
                                    const chunk = Math.floor(currentSectionIndex / 4);
                                    navigate(`/student/quiz/${id}?chunk=${chunk}`);
                                }}>Let's Go!</Button>
                                <Button variant="ghost" className="rounded-xl font-bold h-12 text-white hover:bg-white/10" onClick={() => setShowQuizPrompt(false)}>Later</Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            {/* ── Comprehension Mini-Panel ── */}
            {!focusMode && user && id && (
                <ComprehensionMiniPanel
                    studentId={user.uid}
                    bookId={id}
                    aiUrl={AI_URL}
                />
            )}

            {/* ── Vocabulary Sidebar (Phase 2 — Novel/Generic mode) ── */}
            {contentType !== "play" && !focusMode && bookBrain?.vocabulary && (
                <VocabSidebar
                    sectionContent={currentSection.content || ""}
                    bookVocabulary={bookBrain.vocabulary}
                    archiPhrases={currentSection.archaic_phrases}
                    onWordLookup={(word) => {
                        if (user && id) {
                            fetch(`${AI_URL}/comprehension/vocab`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ 
                                    student_id: user.uid, 
                                    book_id: id, 
                                    word,
                                    source: "click" // Explicitly mark as click
                                }),
                            }).catch(() => { });
                        }
                    }}
                    language={lesson?.language}
                />
            )}

            {/* ── Character Map Panel (Phase 5) ── */}
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

            {/* ── Highlight-to-Understand popup (Deliverable 2) ── */}
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
                    if (user && id) {
                        fetch(`${AI_URL}/comprehension/vocab`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                                student_id: user.uid, 
                                book_id: id, 
                                word,
                                source: "highlight" // Explicitly mark as highlight
                            }),
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
                onHighlightCategorized={(_text, _category) => {
                    // console.log("Categorized:", _text, _category);
                }}
                onPhonics={(word) => setPhonicsWord(word)}
            />

            {/* ── Reading Assessment Modal (SST) ── */}
            {showSTT && (
                <ReadingAssessment
                    expectedText={currentSection.content?.slice(0, 1000) || ""}
                    studentId={user?.uid}
                    bookId={id}
                    sessionId={sessionId}
                    idToken={idToken}
                    onClose={() => setShowSTT(false)}
                />
            )}

            {/* Phase 3: Difficulty Rating Modal */}
            <AnimatePresence>
                {showDifficultyModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl p-8 text-center"
                        >
                            <h3 className="text-2xl font-black mb-2">How was this chapter?</h3>
                            <p className="text-muted-foreground mb-8">Your feedback helps your teacher support you better.</p>
                            
                            <div className="flex justify-center gap-4 mb-8">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setPendingDifficulty(star)}
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold transition-all ${
                                            pendingDifficulty === star 
                                            ? "bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/25" 
                                            : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                        }`}
                                    >
                                        {star}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button 
                                    disabled={!pendingDifficulty || isSubmittingProgress}
                                    className="h-14 rounded-2xl text-lg font-black bg-primary hover:bg-primary/90"
                                    onClick={async () => {
                                        if (!pendingDifficulty) return;
                                        setIsSubmittingProgress(true);
                                        
                                        const wordCount = displayWords.length;
                                        // Calc WPM: wordCount / (seconds / 60)
                                        const wpm = (timeInChapter > 5) ? (wordCount / (timeInChapter / 60)) : 0;

                                        try {
                                            await fetch(`${AI_URL}/comprehension/record`, {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    student_id: user?.uid,
                                                    book_id: id,
                                                    section_id: String(currentSectionIndex),
                                                    section_title: sections[currentSectionIndex]?.title || `Chapter ${currentSectionIndex + 1}`,
                                                    time_spent_s: timeInChapter,
                                                    section_text: displayText.slice(0, 2000),
                                                    subjective_difficulty: pendingDifficulty,
                                                    reading_speed_wpm: Math.round(wpm * 10) / 10
                                                }),
                                            });
                                            toast({
                                                title: "Goal Reached!",
                                                description: "Your progress and feedback have been saved.",
                                            });
                                        } catch (err) {
                                            console.error("Failed to record progress:", err);
                                        } finally {
                                            setIsSubmittingProgress(false);
                                            setShowDifficultyModal(false);
                                            setPendingDifficulty(null);
                                        }
                                    }}
                                >
                                    {isSubmittingProgress ? "Saving..." : "Submit Feedback"}
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    className="h-12 rounded-2xl font-bold text-muted-foreground"
                                    onClick={() => setShowDifficultyModal(false)}
                                >
                                    Skip for now
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            </div>
        </DashboardLayout>
    );
};

export default AdaptiveReader;
