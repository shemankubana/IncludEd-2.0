import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
    Play,
    Pause,
    RotateCcw,
    Settings2,
    Type,
    Eye,
    EyeOff,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    BrainCircuit,
    Loader2,
    BookOpen,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import LiteratureViewer from "../../components/literature/LiteratureViewer";

interface DialogueLine {
    type: 'speaker' | 'stage_direction' | 'narrative';
    name?: string;
    lines?: string[];
    text?: string;
}

interface Section {
    title: string;
    content: string;
    dialogue?: DialogueLine[];
}

const AdaptiveReader = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user, profile } = useAuth();

    // Reader state
    const [isPlaying, setIsPlaying] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const [loading, setLoading] = useState(true);
    const [lesson, setLesson] = useState<any>(null);
    const [sections, setSections] = useState<Section[]>([]);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [showQuizPrompt, setShowQuizPrompt] = useState(false);
    const [contentType, setContentType] = useState<'play' | 'novel' | 'generic'>('generic');

    // Fetch real lesson content + sections from backend
    useEffect(() => {
        const fetchLesson = async () => {
            if (!user || !id) return;
            try {
                const idToken = await user.getIdToken();
                const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/literature/${id}`, {
                    headers: { "Authorization": `Bearer ${idToken}` }
                });
                const data = await response.json();

                setLesson({
                    title: data.title,
                    author: data.author,
                    difficulty: data.difficulty || "Adaptive"
                });

                // Set content type for rendering
                if (data.contentType) setContentType(data.contentType);

                // If backend has pre-computed sections, use them
                // Otherwise, fall back to splitting the content by word count
                if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
                    setSections(data.sections);
                } else {
                    // Fallback: split content into 400-word pages
                    const rawContent = data.adaptedContent || data.originalContent || "";
                    const words = rawContent.split(/\s+/);
                    const chunkSize = 400;
                    const chunks: Section[] = [];
                    for (let i = 0; i < words.length; i += chunkSize) {
                        chunks.push({
                            title: `Page ${Math.floor(i / chunkSize) + 1}`,
                            content: words.slice(i, i + chunkSize).join(" ")
                        });
                    }
                    setSections(chunks.length > 0 ? chunks : [{ title: "Content", content: rawContent }]);
                }

                // Load existing progress
                const progressRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/progress/${id}`, {
                    headers: { "Authorization": `Bearer ${idToken}` }
                });
                if (progressRes.ok) {
                    const progressData = await progressRes.json();
                    if (progressData && progressData.currentSection !== undefined) {
                        setCurrentSectionIndex(progressData.currentSection);
                    } else {
                        // First visit: create an in_progress record so the dashboard shows this lesson
                        await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/progress/${id}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${idToken}`
                            },
                            body: JSON.stringify({ currentSection: 0, status: 'in_progress', schoolId: null })
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

    const totalSections = sections.length;
    const currentSection = sections[currentSectionIndex] || { title: "", content: "" };
    const safeContent = currentSection.content || "";
    const words = safeContent.split(/\s+/).filter(Boolean);

    // Mock timestamps for audio sync visual demo
    const timestamps = [
        { word: "He", start: 0, duration: 0.3 }, { word: "was", start: 0.3, duration: 0.2 },
        { word: "an", start: 0.5, duration: 0.2 }, { word: "old", start: 0.7, duration: 0.3 },
        { word: "man", start: 1.0, duration: 0.3 }, { word: "who", start: 1.3, duration: 0.2 },
        { word: "fished", start: 1.5, duration: 0.4 }, { word: "alone", start: 1.9, duration: 0.4 },
    ];

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying && currentSection.content) {
            interval = setInterval(() => {
                setCurrentTime((prev) => {
                    const nextTime = prev + 0.1;
                    if (nextTime > 4 && !showQuizPrompt && currentSectionIndex === 0) {
                        setShowQuizPrompt(true);
                    }
                    if (nextTime > 5) {
                        setIsPlaying(false);
                        return 0;
                    }
                    const wordIndex = timestamps.findIndex(
                        (t) => nextTime >= t.start && nextTime <= t.start + t.duration
                    );
                    setActiveWordIndex(wordIndex);
                    return nextTime;
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isPlaying, currentSection, showQuizPrompt, currentSectionIndex]);

    const saveProgress = async (index: number, status: 'in_progress' | 'completed' = 'in_progress') => {
        if (!user || !id) return;
        try {
            const idToken = await user.getIdToken();
            await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/progress/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    currentSection: index,
                    status,
                    schoolId: profile?.schoolId // Correctly pass schoolId from profile
                })
            });
        } catch (err) {
            console.error("Failed to save progress:", err);
        }
    };

    const handleNextSection = () => {
        if (currentSectionIndex < totalSections - 1) {
            const nextIdx = currentSectionIndex + 1;
            setCurrentSectionIndex(nextIdx);
            saveProgress(nextIdx, 'in_progress');
            setActiveWordIndex(-1);
            setCurrentTime(0);
            setIsPlaying(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            saveProgress(currentSectionIndex, 'completed');
            navigate(`/student/quiz/${id}`);
        }
    };

    const handlePrevSection = () => {
        if (currentSectionIndex > 0) {
            const prevIdx = currentSectionIndex - 1;
            setCurrentSectionIndex(prevIdx);
            saveProgress(prevIdx, 'in_progress');
            setActiveWordIndex(-1);
            setCurrentTime(0);
            setIsPlaying(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    if (loading) {
        return (
            <DashboardLayout role="student">
                <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="font-bold text-muted-foreground uppercase tracking-widest text-xs">Preparing your adaptive lesson...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="student">
            <div className={`max-w-4xl mx-auto transition-all duration-500 pb-24 ${focusMode ? 'pt-0' : 'pt-4'}`}>

                {/* Top Controls */}
                <AnimatePresence>
                    {!focusMode && (
                        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex items-center justify-between mb-8">
                            <Button variant="ghost" size="sm" className="gap-2 font-bold" onClick={() => navigate("/student/lessons")}>
                                <ArrowLeft className="w-4 h-4" /> Exit Reader
                            </Button>
                            <div className="flex items-center gap-2">
                                <div className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 flex items-center gap-2">
                                    <CheckCircle2 className="w-3 h-3" /> Adaptive Engine Active
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Chapter Navigation Sidebar Strip */}
                {!focusMode && totalSections > 1 && (
                    <div className="mb-6 p-4 bg-secondary/20 rounded-[24px] border border-border/50 flex items-center gap-3 overflow-x-auto scrollbar-none">
                        <BookOpen className="w-4 h-4 text-primary shrink-0" />
                        {sections.map((sec, idx) => (
                            <button
                                key={idx}
                                onClick={() => { setCurrentSectionIndex(idx); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                className={`shrink-0 rounded-xl px-4 py-2 font-bold text-xs transition-all whitespace-nowrap
                                    ${currentSectionIndex === idx
                                        ? 'bg-primary text-primary-foreground shadow-lg'
                                        : 'bg-background border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {sec.title}
                            </button>
                        ))}
                    </div>
                )}

                {/* Overall Progress */}
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

                {/* Reader Card */}
                <Card className={`rounded-[40px] border-2 border-border shadow-2xl transition-all duration-500 overflow-hidden ${focusMode ? 'bg-secondary/20 border-primary/20' : 'bg-card'}`}>

                    {/* Internal Header */}
                    <div className="p-8 border-b border-border/50 flex items-center justify-between bg-secondary/10">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{lesson?.title}</h1>
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
                        <div className="flex items-center gap-2">
                            <Button variant={focusMode ? "default" : "secondary"} size="sm" className="rounded-xl h-10 px-4 font-bold gap-2" onClick={() => setFocusMode(!focusMode)}>
                                {focusMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                {focusMode ? "Focus Mode On" : "Focus Mode"}
                            </Button>
                        </div>
                    </div>

                    {/* Reading Content */}
                    <CardContent className="p-8 md:p-12">
                        {contentType === 'play' ? (
                            <LiteratureViewer
                                data={{
                                    document_type: 'play',
                                    title: lesson?.title || "Literature",
                                    confidence: 1.0,
                                    units: [],
                                    flat_units: sections
                                }}
                            />
                        ) : contentType === 'novel' ? (
                            // ── NOVEL RENDERER ─────────────────────────────────────
                            <div className="space-y-6">
                                <h2 className="text-3xl font-black tracking-tight text-center py-4 border-b border-border/30 mb-8">
                                    {currentSection.title}
                                </h2>
                                <div className="text-xl leading-[2] font-medium text-foreground/90 tracking-wide">
                                    {(currentSection.content || "").split('\n\n').map((para, i) => (
                                        <p key={i} className="mb-6 indent-8">{para.trim()}</p>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            // ── GENERIC / WORD-HIGHLIGHT RENDERER ──────────────────
                            <div className="reading-area leading-[2.2] text-xl md:text-2xl font-medium tracking-wide text-foreground/90 select-text whitespace-pre-wrap">
                                {words.map((word: string, idx: number) => (
                                    <motion.span
                                        key={idx}
                                        animate={{
                                            backgroundColor: activeWordIndex === idx && isPlaying ? "rgba(253, 224, 71, 0.8)" : "transparent",
                                            scale: activeWordIndex === idx && isPlaying ? 1.05 : 1,
                                            color: activeWordIndex === idx && isPlaying ? "#000" : "inherit"
                                        }}
                                        className="inline-block px-0.5 rounded transition-colors"
                                    >
                                        {word}{" "}
                                    </motion.span>
                                ))}
                            </div>
                        )}
                    </CardContent>

                    {/* Player Controls */}
                    <div className="p-8 bg-secondary/30 border-t border-border/50">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex items-center gap-4">
                                <Button size="icon" className="w-14 h-14 rounded-full shadow-lg glow-lime transition-transform hover:scale-110 active:scale-95" onClick={() => setIsPlaying(!isPlaying)}>
                                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full" onClick={() => { setCurrentTime(0); setActiveWordIndex(-1); }}>
                                    <RotateCcw className="w-5 h-5" />
                                </Button>
                            </div>
                            <div className="flex-1 w-full space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                                    <span>Voice Activity</span>
                                    <span>{Math.round((currentTime / 5) * 100)}% Progress</span>
                                </div>
                                <Progress value={(currentTime / 5) * 100} className="h-2 rounded-full bg-background" />
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3 text-muted-foreground group">
                                    <Type className="w-5 h-5 group-hover:text-primary transition-colors" />
                                    <div className="w-20"><Slider defaultValue={[100]} max={150} min={80} step={1} /></div>
                                </div>
                                <div className="h-8 w-px bg-border" />
                                <Button className="rounded-xl font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate(`/student/quiz/${id}`)}>
                                    <BrainCircuit className="w-4 h-4" /> Quiz
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Chapter Navigation Controls */}
                    {totalSections > 1 && (
                        <div className="p-6 bg-background/50 border-t border-border flex items-center justify-between gap-4">
                            <Button variant="outline" className="rounded-xl px-6 font-bold gap-2" onClick={handlePrevSection} disabled={currentSectionIndex === 0}>
                                <ChevronLeft className="w-4 h-4" /> Previous
                            </Button>
                            <div className="text-center">
                                <p className="text-sm font-black text-muted-foreground">{currentSection.title}</p>
                            </div>
                            <Button className="rounded-xl px-6 font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleNextSection}>
                                {currentSectionIndex < totalSections - 1 ? "Next" : "Finish & Quiz"} <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </Card>

                {/* Quiz Engagement Prompt */}
                <AnimatePresence>
                    {showQuizPrompt && !focusMode && (
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.9 }}
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
