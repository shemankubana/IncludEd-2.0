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
    CheckCircle2,
    AlertCircle,
    BrainCircuit,
    Loader2
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

const AdaptiveReader = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();
    const [isPlaying, setIsPlaying] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const [loading, setLoading] = useState(true);
    const [lesson, setLesson] = useState<any>(null);
    const [showQuizPrompt, setShowQuizPrompt] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Fetch real content
    useEffect(() => {
        const fetchLesson = async () => {
            if (!user || !id) return;
            try {
                const idToken = await user.getIdToken();
                const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/literature/${id}`, {
                    headers: {
                        "Authorization": `Bearer ${idToken}`
                    }
                });
                const data = await response.json();
                setLesson({
                    title: data.title,
                    author: data.author,
                    content: data.adaptedContent || data.originalContent,
                    difficulty: "Adaptive"
                });
            } catch (error) {
                console.error("Failed to fetch lesson:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLesson();
    }, [id, user]);

    // Mock timestamps for the demo (in real app, these would come from the backend or TTS engine)
    const timestamps = [
        { word: "He", start: 0, duration: 0.3 },
        { word: "was", start: 0.3, duration: 0.2 },
        { word: "an", start: 0.5, duration: 0.2 },
        { word: "old", start: 0.7, duration: 0.3 },
        { word: "man", start: 1.0, duration: 0.3 },
        { word: "who", start: 1.3, duration: 0.2 },
        { word: "fished", start: 1.5, duration: 0.4 },
        { word: "alone", start: 1.9, duration: 0.4 },
        { word: "in", start: 2.3, duration: 0.2 },
        { word: "a", start: 2.5, duration: 0.1 },
    ];

    const words = lesson?.content?.split(" ") || [];

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying && lesson) {
            interval = setInterval(() => {
                setCurrentTime((prev) => {
                    const nextTime = prev + 0.1;

                    // Trigger quiz prompt at ~80% mock progress or specific point
                    if (nextTime > 4 && !showQuizPrompt) {
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
    }, [isPlaying, lesson, showQuizPrompt]);

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
            <div className={`max-w-4xl mx-auto transition-all duration-500 ${focusMode ? 'pt-0' : 'pt-4'}`}>

                {/* Top Controls */}
                <AnimatePresence>
                    {!focusMode && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex items-center justify-between mb-8"
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2 font-bold"
                                onClick={() => navigate("/student/lessons")}
                            >
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

                {/* Reader Area */}
                <Card className={`rounded-[40px] border-2 border-border shadow-2xl transition-all duration-500 overflow-hidden ${focusMode ? 'bg-secondary/20 border-primary/20' : 'bg-card'}`}>

                    {/* Internal Header */}
                    <div className="p-8 border-b border-border/50 flex items-center justify-between bg-secondary/10">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>
                            <p className="text-sm text-muted-foreground font-medium">{lesson.author}</p>
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

                    <CardContent className="p-12 md:p-20">
                        <div className="reading-area leading-[2.5] text-2xl md:text-3xl font-medium tracking-tight text-foreground/90 select-none">
                            {words.map((word: string, idx: number) => (
                                <motion.span
                                    key={idx}
                                    animate={{
                                        backgroundColor: activeWordIndex === idx ? "rgba(253, 224, 71, 0.8)" : "transparent",
                                        scale: activeWordIndex === idx ? 1.05 : 1,
                                        color: activeWordIndex === idx ? "#000" : "inherit"
                                    }}
                                    className={`inline-block px-1 rounded-lg transition-colors cursor-default`}
                                >
                                    {word}{" "}
                                </motion.span>
                            ))}
                        </div>
                    </CardContent>

                    {/* Player controls */}
                    <div className="p-8 bg-secondary/30 border-t border-border/50">
                        <div className="flex flex-col md:flex-row items-center gap-8">

                            <div className="flex items-center gap-4">
                                <Button
                                    size="icon"
                                    className="w-14 h-14 rounded-full shadow-lg glow-lime transition-transform hover:scale-110 active:scale-95"
                                    onClick={() => setIsPlaying(!isPlaying)}
                                >
                                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full" onClick={() => setCurrentTime(0)}>
                                    <RotateCcw className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="flex-1 w-full space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                                    <span>Voice Activity</span>
                                    <span>{Math.round((currentTime / 5) * 100)}% Reading Progress</span>
                                </div>
                                <Progress value={(currentTime / 5) * 100} className="h-2 rounded-full bg-background" />
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3 text-muted-foreground group">
                                    <Type className="w-5 h-5 group-hover:text-primary transition-colors" />
                                    <div className="w-24">
                                        <Slider defaultValue={[100]} max={150} min={80} step={1} />
                                    </div>
                                </div>
                                <div className="h-8 w-px bg-border" />
                                <Button
                                    className="rounded-xl font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={() => navigate(`/student/quiz/${id}`)}
                                >
                                    <BrainCircuit className="w-4 h-4" /> Take Quiz
                                </Button>
                            </div>

                        </div>
                    </div>
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
                                    <p className="text-md font-bold leading-tight">Ready for a quick knowledge check? You can earn +200 XP!</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    className="rounded-xl font-black h-12 bg-white text-accent hover:bg-white/90 shadow-lg"
                                    onClick={() => navigate(`/student/quiz/${id}`)}
                                >
                                    Let's Go!
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="rounded-xl font-bold h-12 text-white hover:bg-white/10"
                                    onClick={() => setShowQuizPrompt(false)}
                                >
                                    Later
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </DashboardLayout>
    );
};

export default AdaptiveReader;
