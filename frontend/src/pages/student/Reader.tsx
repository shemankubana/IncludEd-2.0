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
    ArrowLeft, CheckCircle2, BrainCircuit, Loader2,
    BookOpen, ChevronLeft, ChevronRight, Volume2, Zap,
    AlertCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import PlayDialogueUI, { type DialogueLine } from "@/components/play/PlayDialogueUI";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useRLAdaptation, RL_ACTIONS } from "@/hooks/useRLAdaptation";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Section {
    title: string;
    content: string;
    dialogue?: DialogueLine[];
    wordCount?: number;
}

// ── IndexedDB helpers for offline progress ────────────────────────────────────

const IDB_DB    = "included_reader";
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
            get.onerror   = () => resolve(null);
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

// ── Syllabify helper (client-side, no library needed) ────────────────────────

function syllabify(text: string): string {
    return text
        .split(/\s+/)
        .map((word) => {
            const clean = word.replace(/[.,!?;:()]/g, "");
            if (clean.length <= 5) return word;
            // Insert soft hyphen every 3 chars on long words
            const parts: string[] = [];
            for (let i = 0; i < clean.length; i += 3) parts.push(clean.slice(i, i + 3));
            const suffix = word.slice(clean.length);
            return parts.join("\u00B7") + suffix;
        })
        .join(" ");
}

// ── Main Component ─────────────────────────────────────────────────────────────

const AdaptiveReader = () => {
    const navigate  = useNavigate();
    const { id }    = useParams();
    const { user, profile, dyslexicMode } = useAuth();

    // Reader state
    const [isPlaying,          setIsPlaying]          = useState(false);
    const [focusMode,          setFocusMode]           = useState(false);
    const [loading,            setLoading]             = useState(true);
    const [lesson,             setLesson]              = useState<any>(null);
    const [intro,              setIntro]               = useState<string | null>(null);
    const [showIntro,          setShowIntro]           = useState(true);
    const [sections,           setSections]            = useState<Section[]>([]);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [showQuizPrompt,     setShowQuizPrompt]      = useState(false);
    const [contentType,        setContentType]         = useState<"play" | "novel" | "generic">("generic");
    const [sessionId,          setSessionId]           = useState<string | null>(null);
    const [idToken,            setIdToken]             = useState<string | null>(null);
    const [showRLBadge,        setShowRLBadge]         = useState(false);

    // TTS
    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const [currentTime,     setCurrentTime]     = useState(0);
    const ttsRef = useRef<SpeechSynthesisUtterance | null>(null);

    const totalSections    = sections.length;
    const currentSection   = sections[currentSectionIndex] || { title: "", content: "" };
    const safeContent      = currentSection.content || "";
    const words            = safeContent.split(/\s+/).filter(Boolean);

    // ── Disability encoding ────────────────────────────────────────────────────
    const disabilityEncoded: number = (() => {
        const dt = profile?.disabilityType || "none";
        if (dt === "adhd") return 1.0;
        if (dt === "dyslexia") return 0.5;
        if (dt === "both") return 1.0;
        return 0.0;
    })();

    // ── Telemetry ──────────────────────────────────────────────────────────────
    const { attentionState, markSectionRead, flushNow } = useTelemetry({
        sessionId,
        literatureId: id ?? null,
        idToken,
        wordCount: words.length,
    });

    // ── RL Adaptation ──────────────────────────────────────────────────────────
    const { adaptation, isLoading: rlLoading } = useRLAdaptation({
        sessionId,
        idToken,
        disabilityType: disabilityEncoded,
        textDifficulty: 0.5,
        attentionState,
        pollIntervalMs: 25_000,
    });

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
    const displayText = (() => {
        if (adaptation.isSyllabified) return syllabify(safeContent);
        if (adaptation.isChunked) {
            // Attention break: show only current 2-sentence chunk
            const sentences = safeContent.split(/(?<=[.!?])\s+/).filter(Boolean);
            const chunk = sentences.slice(0, 3).join(" ");
            return chunk || safeContent;
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
                            literatureId:   id,
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

                setLesson({ title: data.title, author: data.author, difficulty: data.difficulty || "Adaptive" });
                if (data.introduction) {
                    setIntro(data.introduction);
                    setShowIntro(true);
                }
                if (data.contentType) setContentType(data.contentType);

                if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
                    setSections(data.sections);
                } else {
                    const raw = data.adaptedContent || data.originalContent || "";
                    const w = raw.split(/\s+/);
                    const SIZE = 400;
                    const chunks: Section[] = [];
                    for (let i = 0; i < w.length; i += SIZE) {
                        chunks.push({
                            title:     `Page ${Math.floor(i / SIZE) + 1}`,
                            content:   w.slice(i, i + SIZE).join(" "),
                            wordCount: Math.min(SIZE, w.length - i),
                        });
                    }
                    setSections(chunks.length > 0 ? chunks : [{ title: "Content", content: raw }]);
                }

                // Load progress from IndexedDB first (offline-safe)
                const cachedSection = await idbGetProgress(id);
                if (cachedSection !== null) {
                    setCurrentSectionIndex(cachedSection);
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

    const handleNextSection = useCallback(() => {
        if (currentSectionIndex < totalSections - 1) {
            const next = currentSectionIndex + 1;
            setCurrentSectionIndex(next);
            saveProgress(next, "in_progress");
            markSectionRead(currentSection.wordCount ?? words.length);
            setActiveWordIndex(-1);
            setCurrentTime(0);
            setIsPlaying(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
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
                }).catch(() => {});
            }
            navigate(`/student/quiz/${id}`);
        }
    }, [
        currentSectionIndex, totalSections, saveProgress, markSectionRead,
        currentSection.wordCount, words.length, flushNow, sessionId, idToken,
        attentionState, navigate, id,
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
        const actM   = title.match(/ACT\s+(\d+|[IVX]+)/i);
        const sceneM = title.match(/SC(?:ENE)?\.?\s*(\d+|[IVX]+)/i);
        return {
            act:   actM   ? `Act ${actM[1]}`     : "Prologue",
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
            actTitle:   act   || undefined,
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
                                <ArrowLeft className="w-4 h-4" /> Exit Reader
                            </Button>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* RL Engine badge */}
                                <div className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 flex items-center gap-2">
                                    <BrainCircuit className="w-3 h-3" />
                                    {rlLoading ? "Analysing..." : "Adaptive Engine Active"}
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

                {/* ── ADHD micro-break prompt ── */}
                <AnimatePresence>
                    {adaptation.isChunked && !focusMode && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="mb-4 flex items-center gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700"
                        >
                            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                            <div>
                                <p className="text-xs font-black text-rose-600 uppercase tracking-widest">Attention Support Active</p>
                                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                                    Content chunked into smaller sections for better focus.
                                </p>
                            </div>
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
                            <Button
                                variant={focusMode ? "default" : "secondary"}
                                size="sm"
                                className="rounded-xl h-10 px-4 font-bold gap-2"
                                onClick={() => setFocusMode(!focusMode)}
                            >
                                {focusMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                {focusMode ? "Focus Mode On" : "Focus Mode"}
                            </Button>
                        </div>
                    </div>

                    {/* Reading Content */}
                    <CardContent className="p-8 md:p-12">
                        {contentType === "play" && dialogueLines.length > 0 ? (
                            /* Play with parsed dialogue lines → animated bubbles */
                            <PlayDialogueUI
                                lines={dialogueLines}
                                actTitle={actTitle}
                                sceneTitle={sceneTitle}
                                dyslexicFont={adaptation.isSyllabified}
                                autoAdvance={adaptation.isTTSEnabled}
                                onComplete={handleNextSection}
                            />
                        ) : contentType === "generic" ? (
                            /* Generic → word-highlight renderer */
                            <div
                                className="reading-area leading-[2.2] text-xl md:text-2xl font-medium tracking-wide text-foreground/90 select-text"
                                style={{ lineHeight: adaptation.lineSpacing }}
                            >
                                {displayWords.map((word: string, idx: number) => (
                                    <motion.span
                                        key={idx}
                                        animate={{
                                            backgroundColor: activeWordIndex === idx && isPlaying
                                                ? "rgba(253, 224, 71, 0.8)"
                                                : "transparent",
                                            scale: activeWordIndex === idx && isPlaying ? 1.05 : 1,
                                            color: activeWordIndex === idx && isPlaying ? "#000" : "inherit",
                                        }}
                                        className="inline-block px-0.5 rounded transition-colors"
                                    >
                                        {word}{" "}
                                    </motion.span>
                                ))}
                            </div>
                        ) : displayText.trim().length > 0 ? (
                            /* Novel / play-without-dialogue → clean dyslexia-friendly paragraphs */
                            <div className="space-y-2">
                                <div
                                    className="text-xl leading-[2] font-medium text-foreground/90 tracking-wide"
                                    style={{ lineHeight: adaptation.lineSpacing }}
                                >
                                    {displayText
                                        .replace(/\n{3,}/g, "\n\n")
                                        .split("\n\n")
                                        .filter(p => p.trim().length > 0)
                                        .map((para, i) => (
                                            <p key={i} className="mb-6 indent-8">{para.trim()}</p>
                                        ))
                                    }
                                </div>
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
                                <ChevronLeft className="w-4 h-4" /> Previous
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
                                {currentSectionIndex < totalSections - 1 ? "Next" : "Finish & Quiz"}{" "}
                                <ChevronRight className="w-4 h-4" />
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
        </DashboardLayout>
    );
};

export default AdaptiveReader;
