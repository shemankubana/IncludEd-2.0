/**
 * AdaptiveReader.tsx
 * ==================
 * The core student reading experience. Designed for Dyslexia and ADHD users.
 *
 * Features:
 *   - ML-analyzed content displayed in accessible layout
 *   - Chat-bubble dialogue for plays via LiteratureViewer
 *   - TTS with word-level highlighting (calls /tts/generate)
 *   - Dyslexia mode: OpenDyslexic font, extra spacing
 *   - ADHD mode: shorter sections, progress prompts
 *   - Bionic reading toggle (bold first syllables)
 *   - Focus mode (dimmed surroundings)
 *   - Section navigation with progress tracking
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Play,
    Pause,
    RotateCcw,
    Type,
    Eye,
    EyeOff,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Loader2,
    BookOpen,
    Volume2,
    VolumeX,
    Settings2,
    BrainCircuit,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

const AI_SERVICE_URL =
    (import.meta.env.VITE_AI_SERVICE_URL as string | undefined) ??
    "http://localhost:8082";

import { API_BASE } from "@/lib/api";

const API_URL = API_BASE;

interface Section {
    title: string;
    content: string;
    blocks?: any[];
    dialogue?: any[];
}

// ── Bionic Reading Helper ────────────────────────────────────────────────────
// Bolds the first portion of each word to create a visual anchor for the eye.

function bionicWord(word: string): React.ReactNode {
    if (word.length <= 1) return <span className="bionic-word__bold">{word}</span>;
    const boldLen = Math.max(1, Math.ceil(word.length * 0.4));
    return (
        <span>
            <span className="bionic-word__bold">{word.slice(0, boldLen)}</span>
            <span className="bionic-word__rest">{word.slice(boldLen)}</span>
        </span>
    );
}

// ── Component ────────────────────────────────────────────────────────────────

const AdaptiveReader = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user, profile } = useAuth();

    // Core state
    const [loading, setLoading] = useState(true);
    const [lesson, setLesson] = useState<any>(null);
    const [sections, setSections] = useState<Section[]>([]);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [contentType, setContentType] = useState<"play" | "novel" | "generic">("generic");

    // Accessibility modes
    const [dyslexicFont, setDyslexicFont] = useState(false);
    const [bionicReading, setBionicReading] = useState(false);
    const [focusMode, setFocusMode] = useState(false);

    // TTS state
    const [isTTSPlaying, setIsTTSPlaying] = useState(false);
    const [ttsLoading, setTtsLoading] = useState(false);
    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const [ttsTimestamps, setTtsTimestamps] = useState<{ word: string; start: number; duration: number }[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ttsIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch lesson content
    useEffect(() => {
        const fetchLesson = async () => {
            if (!user || !id) return;
            try {
                const idToken = await user.getIdToken();
                const response = await fetch(`${API_URL}/api/literature/${id}`, {
                    headers: { Authorization: `Bearer ${idToken}` },
                });
                const data = await response.json();

                setLesson({ title: data.title, author: data.author, difficulty: data.difficulty });
                if (data.contentType) setContentType(data.contentType);

                if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
                    setSections(data.sections);
                } else {
                    const rawContent = data.adaptedContent || data.originalContent || "";
                    const words = rawContent.split(/\s+/);
                    const chunkSize = 400;
                    const chunks: Section[] = [];
                    for (let i = 0; i < words.length; i += chunkSize) {
                        chunks.push({
                            title: `Page ${Math.floor(i / chunkSize) + 1}`,
                            content: words.slice(i, i + chunkSize).join(" "),
                        });
                    }
                    setSections(chunks.length > 0 ? chunks : [{ title: "Content", content: rawContent }]);
                }

                // Load progress
                const progressRes = await fetch(`${API_URL}/api/progress/${id}`, {
                    headers: { Authorization: `Bearer ${idToken}` },
                });
                if (progressRes.ok) {
                    const progressData = await progressRes.json();
                    if (progressData?.currentSection !== undefined) {
                        setCurrentSectionIndex(progressData.currentSection);
                    } else {
                        await fetch(`${API_URL}/api/progress/${id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                            body: JSON.stringify({ currentSection: 0, status: "in_progress", schoolId: null }),
                        });
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

    // Detect dyslexia/ADHD from profile and auto-enable modes
    useEffect(() => {
        if (profile) {
            const disabilities = (profile as any).disabilityType || "";
            if (disabilities.includes("dyslexia") || disabilities === "both") {
                setDyslexicFont(true);
            }
        }
    }, [profile]);

    const currentSection = sections[currentSectionIndex] || { title: "", content: "" };
    const safeContent = currentSection.content || "";
    const words = safeContent.split(/\s+/).filter(Boolean);
    const totalSections = sections.length;

    // ── TTS Functions ────────────────────────────────────────────────────────

    const stopTTS = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (ttsIntervalRef.current) {
            clearInterval(ttsIntervalRef.current);
            ttsIntervalRef.current = null;
        }
        setIsTTSPlaying(false);
        setActiveWordIndex(-1);
        setTtsTimestamps([]);
    }, []);

    const playTTS = useCallback(async () => {
        if (isTTSPlaying) {
            stopTTS();
            return;
        }

        const textToSpeak = safeContent.slice(0, 5000); // Limit for TTS
        if (!textToSpeak.trim()) return;

        setTtsLoading(true);
        try {
            const resp = await fetch(`${AI_SERVICE_URL}/tts/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: textToSpeak, rate: "+0%" }),
            });

            if (!resp.ok) throw new Error("TTS generation failed");
            const data = await resp.json();

            const audioBlob = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0));
            const blob = new Blob([audioBlob], { type: "audio/mpeg" });
            const audioUrl = URL.createObjectURL(blob);

            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            setTtsTimestamps(data.timestamps || []);
            setIsTTSPlaying(true);

            audio.play();

            // Word-level highlight sync
            const timestamps = data.timestamps || [];
            ttsIntervalRef.current = setInterval(() => {
                if (!audioRef.current) return;
                const currentTime = audioRef.current.currentTime;
                const idx = timestamps.findIndex(
                    (t: any) => currentTime >= t.start && currentTime <= t.start + t.duration
                );
                setActiveWordIndex(idx);
            }, 50);

            audio.onended = () => {
                stopTTS();
            };
        } catch (err) {
            console.error("TTS error:", err);
        } finally {
            setTtsLoading(false);
        }
    }, [isTTSPlaying, safeContent, stopTTS]);

    // Clean up TTS on unmount or section change
    useEffect(() => {
        return () => stopTTS();
    }, [currentSectionIndex, stopTTS]);

    // ── Progress saving ──────────────────────────────────────────────────────

    const saveProgress = async (index: number, status: "in_progress" | "completed" = "in_progress") => {
        if (!user || !id) return;
        try {
            const idToken = await user.getIdToken();
            await fetch(`${API_URL}/api/progress/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ currentSection: index, status, schoolId: (profile as any)?.schoolId }),
            });
        } catch (err) {
            console.error("Failed to save progress:", err);
        }
    };

    const handleNextSection = () => {
        stopTTS();
        if (currentSectionIndex < totalSections - 1) {
            const nextIdx = currentSectionIndex + 1;
            setCurrentSectionIndex(nextIdx);
            saveProgress(nextIdx);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            saveProgress(currentSectionIndex, "completed");
            navigate(`/student/quiz/${id}`);
        }
    };

    const handlePrevSection = () => {
        stopTTS();
        if (currentSectionIndex > 0) {
            const prevIdx = currentSectionIndex - 1;
            setCurrentSectionIndex(prevIdx);
            saveProgress(prevIdx);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    // ── Render word with TTS highlight and optional bionic reading ────────────

    const renderWord = (word: string, idx: number) => {
        const isHighlighted = isTTSPlaying && activeWordIndex === idx;
        const cls = isHighlighted ? "tts-highlight" : "";

        if (bionicReading) {
            return (
                <span key={idx} className={cls}>
                    {bionicWord(word)}{" "}
                </span>
            );
        }

        return (
            <span key={idx} className={cls}>
                {word}{" "}
            </span>
        );
    };

    // ── Play content renderer (dialogue blocks) ──────────────────────────────

    const renderPlayContent = () => {
        const blocks = currentSection.blocks || currentSection.dialogue || [];
        if (blocks.length === 0) {
            // Fallback to plain text
            return renderTextContent();
        }

        // Character side tracking for chat layout
        const characterSides = new Map<string, "left" | "right">();
        let nextSide: "left" | "right" = "left";

        const colors = [
            "hsl(210, 70%, 50%)", "hsl(340, 65%, 50%)", "hsl(160, 60%, 40%)",
            "hsl(270, 55%, 55%)", "hsl(30, 70%, 50%)", "hsl(190, 60%, 45%)",
        ];

        function getColor(name: string) {
            let hash = 0;
            for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
            return colors[Math.abs(hash) % colors.length];
        }

        function getInitials(name: string) {
            if (!name) return "?";
            const w = name.trim().split(/\s+/);
            return w.length === 1 ? w[0].substring(0, 2).toUpperCase() : (w[0][0] + w[1][0]).toUpperCase();
        }

        return (
            <div className="flex flex-col gap-3">
                {blocks.map((block: any, bIdx: number) => {
                    const isSpeaker = block.type === "dialogue" || block.type === "speaker";
                    const character = block.character || block.name || "";
                    const content = block.content || (block.lines ? block.lines.join(" ") : "");
                    const isStage = block.type === "stage_direction";

                    if (isStage) {
                        return (
                            <div key={bIdx} className="flex items-center gap-3 my-2">
                                <div className="flex-1 h-px bg-border" />
                                <p className="text-sm italic text-muted-foreground px-3 py-1.5 bg-muted/50 rounded-full">
                                    {block.content || block.text}
                                </p>
                                <div className="flex-1 h-px bg-border" />
                            </div>
                        );
                    }

                    if (isSpeaker && character) {
                        const charKey = character.toUpperCase().trim();
                        if (!characterSides.has(charKey)) {
                            characterSides.set(charKey, nextSide);
                            nextSide = nextSide === "left" ? "right" : "left";
                        }
                        const side = characterSides.get(charKey)!;
                        const color = getColor(character);
                        const initials = getInitials(character);
                        const isRight = side === "right";

                        return (
                            <div
                                key={bIdx}
                                className={`flex items-start gap-3 max-w-[85%] ${isRight ? "self-end flex-row-reverse" : "self-start"}`}
                            >
                                {/* Avatar */}
                                <div
                                    className="w-11 h-11 min-w-[2.75rem] rounded-full flex items-center justify-center text-white text-xs font-extrabold shadow-md flex-shrink-0"
                                    style={{ backgroundColor: color }}
                                    title={character}
                                >
                                    {initials}
                                </div>
                                {/* Bubble */}
                                <div
                                    className={`rounded-2xl px-4 py-3 border shadow-sm ${
                                        isRight
                                            ? "rounded-tr-sm bg-primary/5 border-primary/15"
                                            : "rounded-tl-sm bg-card border-border"
                                    }`}
                                >
                                    <span
                                        className="block text-[0.65rem] font-extrabold uppercase tracking-wider mb-1"
                                        style={{ color }}
                                    >
                                        {character}
                                    </span>
                                    <p className="text-base leading-[1.9] tracking-wide m-0">
                                        {content}
                                    </p>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <p key={bIdx} className="leading-[2] text-foreground/80 text-base italic pl-4">
                            {block.content || block.text}
                        </p>
                    );
                })}
            </div>
        );
    };

    // ── Novel / generic text content ─────────────────────────────────────────

    const renderTextContent = () => (
        <div className="leading-[2.2] text-lg tracking-wide text-foreground/90 select-text">
            {words.map((word, idx) => renderWord(word, idx))}
        </div>
    );

    // ── Loading ──────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <DashboardLayout role="student">
                <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="font-bold text-muted-foreground uppercase tracking-widest text-xs">
                        Preparing your accessible lesson...
                    </p>
                </div>
            </DashboardLayout>
        );
    }

    // ── Accessibility class computation ──────────────────────────────────────

    const readingClasses = [
        dyslexicFont ? "reading-mode-dyslexia" : "",
    ].filter(Boolean).join(" ");

    return (
        <DashboardLayout role="student">
            <div className={`max-w-4xl mx-auto transition-all duration-500 pb-24 ${focusMode ? "pt-0" : "pt-4"} ${readingClasses}`}>
                {/* Top Controls */}
                <AnimatePresence>
                    {!focusMode && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex items-center justify-between mb-6"
                        >
                            <Button variant="ghost" size="sm" className="gap-2 font-bold" onClick={() => navigate("/student/lessons")}>
                                <ArrowLeft className="w-4 h-4" /> Exit Reader
                            </Button>
                            <div className="flex items-center gap-2">
                                {/* Accessibility toggles */}
                                <Button
                                    variant={dyslexicFont ? "default" : "outline"}
                                    size="sm"
                                    className="rounded-xl h-8 px-3 text-xs font-bold gap-1.5"
                                    onClick={() => setDyslexicFont(!dyslexicFont)}
                                    title="Toggle OpenDyslexic font"
                                >
                                    <Type className="w-3.5 h-3.5" />
                                    Dyslexic Font
                                </Button>
                                <Button
                                    variant={bionicReading ? "default" : "outline"}
                                    size="sm"
                                    className="rounded-xl h-8 px-3 text-xs font-bold gap-1.5"
                                    onClick={() => setBionicReading(!bionicReading)}
                                    title="Toggle bionic reading (bold word anchors)"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    Bionic
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Chapter Navigation Strip */}
                {!focusMode && totalSections > 1 && (
                    <div className="mb-5 p-3 bg-secondary/20 rounded-2xl border border-border/50 flex items-center gap-2 overflow-x-auto scrollbar-none">
                        <BookOpen className="w-4 h-4 text-primary shrink-0" />
                        {sections.map((sec, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    stopTTS();
                                    setCurrentSectionIndex(idx);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className={`shrink-0 rounded-xl px-4 py-2 font-bold text-xs transition-all whitespace-nowrap ${
                                    currentSectionIndex === idx
                                        ? "bg-primary text-primary-foreground shadow-lg"
                                        : "bg-background border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {sec.title}
                            </button>
                        ))}
                    </div>
                )}

                {/* Progress Bar */}
                {!focusMode && totalSections > 1 && (
                    <div className="mb-5 flex items-center gap-4 px-1">
                        <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground shrink-0">
                            {currentSectionIndex + 1} / {totalSections}
                        </span>
                        <Progress value={((currentSectionIndex + 1) / totalSections) * 100} className="h-1.5 flex-1 rounded-full bg-secondary" />
                        <span className="text-xs font-extrabold uppercase tracking-widest text-primary shrink-0">
                            {Math.round(((currentSectionIndex + 1) / totalSections) * 100)}%
                        </span>
                    </div>
                )}

                {/* Reader Card */}
                <Card className={`rounded-3xl border-2 border-border shadow-xl transition-all overflow-hidden ${focusMode ? "bg-secondary/20 border-primary/20" : "bg-card"}`}>
                    {/* Header */}
                    <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/10">
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">{lesson?.title}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-muted-foreground font-medium">{lesson?.author}</p>
                                {totalSections > 1 && (
                                    <>
                                        <span className="text-muted-foreground">·</span>
                                        <span className="text-sm font-bold text-primary">{currentSection.title}</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <Button
                            variant={focusMode ? "default" : "secondary"}
                            size="sm"
                            className="rounded-xl h-9 px-4 font-bold gap-2"
                            onClick={() => setFocusMode(!focusMode)}
                        >
                            {focusMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            {focusMode ? "Focus On" : "Focus"}
                        </Button>
                    </div>

                    {/* Reading Content */}
                    <CardContent className="p-6 md:p-10">
                        {contentType === "play" ? renderPlayContent() : renderTextContent()}
                    </CardContent>

                    {/* TTS & Controls Bar */}
                    <div className="p-6 bg-secondary/30 border-t border-border/50">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            {/* TTS Controls */}
                            <div className="flex items-center gap-3">
                                <Button
                                    size="icon"
                                    className="w-12 h-12 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
                                    onClick={playTTS}
                                    disabled={ttsLoading}
                                    title={isTTSPlaying ? "Stop reading aloud" : "Read aloud with TTS"}
                                >
                                    {ttsLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : isTTSPlaying ? (
                                        <Pause className="w-5 h-5" />
                                    ) : (
                                        <Volume2 className="w-5 h-5" />
                                    )}
                                </Button>
                                <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                                    {ttsLoading ? "Generating audio..." : isTTSPlaying ? "Reading aloud" : "Listen"}
                                </div>
                            </div>

                            <div className="flex-1" />

                            {/* Quiz button */}
                            <Button
                                className="rounded-xl font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => navigate(`/student/quiz/${id}`)}
                            >
                                <BrainCircuit className="w-4 h-4" /> Quiz
                            </Button>
                        </div>
                    </div>

                    {/* Section Navigation */}
                    {totalSections > 1 && (
                        <div className="p-5 bg-background/50 border-t border-border flex items-center justify-between gap-4">
                            <Button
                                variant="outline"
                                className="rounded-xl px-5 font-bold gap-2"
                                onClick={handlePrevSection}
                                disabled={currentSectionIndex === 0}
                            >
                                <ChevronLeft className="w-4 h-4" /> Previous
                            </Button>
                            <div className="text-center">
                                <p className="text-sm font-bold text-muted-foreground">{currentSection.title}</p>
                            </div>
                            <Button
                                className="rounded-xl px-5 font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={handleNextSection}
                            >
                                {currentSectionIndex < totalSections - 1 ? "Next" : "Finish & Quiz"}{" "}
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default AdaptiveReader;
