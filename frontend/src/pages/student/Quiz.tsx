import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, ArrowRight, CheckCircle2, XCircle, Star, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/api";

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number; // index in the ORIGINAL (un-shuffled) options
    explanation: string;
    _correctText: string;  // value of the correct answer (set after we map it)
}

const BADGE_THRESHOLDS = [
    { pct: 100, badge: "quiz_perfect",  label: "Perfect Score",  emoji: "🏆" },
    { pct: 80,  badge: "quiz_master",   label: "Quiz Master",    emoji: "⭐" },
    { pct: 60,  badge: "story_reader",  label: "Story Reader",   emoji: "📖" },
];

const ComprehensionQuiz = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const chunkParam = searchParams.get("chunk");
    const { user } = useAuth();

    const [currentStep,    setCurrentStep]    = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [hasSubmitted,   setHasSubmitted]   = useState(false);
    const [score,          setScore]          = useState(0);
    const [isFinished,     setIsFinished]     = useState(false);
    const [quizData,       setQuizData]       = useState<QuizQuestion[]>([]);
    const [loading,        setLoading]        = useState(true);
    const [error,          setError]          = useState("");
    const [awardLoading,   setAwardLoading]   = useState(false);
    const [earnedBadge,    setEarnedBadge]    = useState<{ label: string; emoji: string } | null>(null);

    useEffect(() => {
        const fetchQuiz = async () => {
            if (!user || !id) return;
            try {
                const idToken = await user.getIdToken();
                const response = await fetch(`${API_BASE}/api/quiz/${id}`, {
                    headers: { Authorization: `Bearer ${idToken}` },
                });
                if (!response.ok) throw new Error("Failed to fetch questions");
                const allQuestions = await response.json();

                // Filter by chunk if parameter provided
                const filtered = chunkParam 
                    ? allQuestions.filter((q: any) => q.chunkIndex === parseInt(chunkParam) + 1)
                    : allQuestions;

                // Map questions: store the correct text BEFORE shuffling
                const prepared: QuizQuestion[] = filtered.map((q: any) => {
                    const parsedOptions: string[] =
                        typeof q.options === "string" ? JSON.parse(q.options) : [...q.options];
                    const correctText = parsedOptions[q.correctAnswer] ?? parsedOptions[0];

                    // Fisher-Yates shuffle
                    for (let i = parsedOptions.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [parsedOptions[i], parsedOptions[j]] = [parsedOptions[j], parsedOptions[i]];
                    }

                    return {
                        id:            q.id,
                        question:      q.question,
                        options:       parsedOptions,
                        correctAnswer: q.correctAnswer,
                        explanation:   q.explanation || "",
                        _correctText:  correctText,
                    };
                });

                setQuizData(prepared);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchQuiz();
    }, [id, user]);

    const currentQuestion = quizData[currentStep];
    const progress = quizData.length > 0 ? ((currentStep + 1) / quizData.length) * 100 : 0;
    const isCorrect = hasSubmitted && selectedAnswer === currentQuestion?._correctText;

    const handleSubmit = () => {
        if (!selectedAnswer || hasSubmitted) return;
        setHasSubmitted(true);
        if (selectedAnswer === currentQuestion._correctText) {
            setScore((s) => s + 1);
        }
    };

    const handleNext = async () => {
        if (currentStep < quizData.length - 1) {
            setCurrentStep((s) => s + 1);
            setSelectedAnswer(null);
            setHasSubmitted(false);
        } else {
            // Quiz finished — award XP + badges
            await finishQuiz();
        }
    };

    const finishQuiz = async () => {
        setAwardLoading(true);
        const finalScore = isCorrect ? score : score; // already updated in handleSubmit
        const pct = quizData.length > 0 ? Math.round(((isCorrect ? score : score) / quizData.length) * 100) : 0;

        // Determine badge
        const badge = BADGE_THRESHOLDS.find((t) => pct >= t.pct);
        if (badge) setEarnedBadge({ label: badge.label, emoji: badge.emoji });

        if (user && id) {
            try {
                const idToken = await user.getIdToken();
                
                if (chunkParam !== null) {
                    // Record score for this specific periodic quiz chunk
                    await fetch(`${API_BASE}/api/progress/${id}/quiz`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                        body: JSON.stringify({ 
                            chunkIndex: parseInt(chunkParam), 
                            score: finalScore, 
                            total: quizData.length,
                        }),
                    });
                } else {
                    // Whole book completion (legacy or final)
                    await fetch(`${API_BASE}/api/progress/${id}/complete`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                        body: JSON.stringify({ score: finalScore, total: quizData.length, badge: badge?.badge }),
                    });
                }
            } catch { /* non-critical */ }
        }

        setAwardLoading(false);
        setIsFinished(true);
    };

    // ── Loading ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <DashboardLayout role="student">
                <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="font-bold text-muted-foreground uppercase tracking-widest text-xs">Loading Knowledge Check...</p>
                </div>
            </DashboardLayout>
        );
    }

    if (error || quizData.length === 0) {
        return (
            <DashboardLayout role="student">
                <div className="max-w-xl mx-auto py-20 text-center space-y-6">
                    <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-8">
                        <Sparkles className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h2 className="text-3xl font-black">Hold on!</h2>
                    <p className="text-muted-foreground font-medium">My AI brain is still writing the perfect questions for this book. Try returning later!</p>
                    <Button size="lg" variant="outline" className="rounded-2xl font-bold gap-2" onClick={() => navigate(`/student/reader/${id}`)}>
                        <ArrowLeft className="w-5 h-5" /> Back to Reading
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    // ── Finished screen ───────────────────────────────────────────────────────

    if (isFinished) {
        const finalScore   = score;
        const totalQ       = quizData.length;
        const scorePct     = Math.round((finalScore / totalQ) * 100);
        const xpEarned     = finalScore * 50 + (scorePct === 100 ? 200 : 0);

        return (
            <DashboardLayout role="student">
                <div className="max-w-2xl mx-auto py-10">
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-8">
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                            <Trophy className="w-32 h-32 text-primary relative z-10 mx-auto drop-shadow-2xl" />
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute -top-4 -right-4">
                                <Sparkles className="w-12 h-12 text-lime opacity-50" />
                            </motion.div>
                        </div>

                        <div className="space-y-4">
                            <h1 className="text-5xl font-black tracking-tight">
                                {scorePct >= 80 ? "Amazing Work!" : scorePct >= 60 ? "Good Job!" : "Keep Practising!"}
                            </h1>
                            <p className="text-xl text-muted-foreground font-medium">
                                You got <span className="text-primary font-black">{finalScore} out of {totalQ}</span> questions correct.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 rounded-[32px] bg-secondary/50 border border-border">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Score</p>
                                <p className="text-3xl font-black text-primary">{scorePct}%</p>
                            </div>
                            <div className="p-6 rounded-[32px] bg-secondary/50 border border-border">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">XP Earned</p>
                                <p className="text-3xl font-black text-cyan">+{xpEarned} XP</p>
                            </div>
                        </div>

                        {earnedBadge && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.4, type: "spring" }}
                                className="p-6 rounded-[32px] bg-primary/5 border-2 border-primary/20 flex items-center justify-center gap-4"
                            >
                                <span className="text-4xl">{earnedBadge.emoji}</span>
                                <div className="text-left">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Badge Earned!</p>
                                    <p className="text-2xl font-black text-primary">{earnedBadge.label}</p>
                                    <p className="text-xs text-muted-foreground mt-1">Added to your Achievement Hall</p>
                                </div>
                            </motion.div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <Button size="lg" className="w-full rounded-2xl h-14 text-lg font-black gap-3 shadow-xl" onClick={() => navigate("/student/achievements")}>
                                View Achievements
                            </Button>
                            <Button size="lg" variant="outline" className="w-full rounded-2xl h-14 text-lg font-black gap-3" onClick={() => navigate("/student/dashboard")}>
                                Dashboard <ArrowRight className="w-5 h-5" />
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </DashboardLayout>
        );
    }

    // ── Question screen ───────────────────────────────────────────────────────

    return (
        <DashboardLayout role="student">
            <div className="max-w-3xl mx-auto space-y-8 pb-20">

                <Button variant="ghost" className="font-bold gap-2 -ml-4 mb-4" onClick={() => navigate(`/student/reader/${id}`)}>
                    <ArrowLeft className="w-4 h-4" /> Back to Reader
                </Button>

                {/* Progress Header */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Question {currentStep + 1} of {quizData.length}
                        </span>
                        <span className="text-xs font-black uppercase tracking-widest text-primary">
                            Score: {score} / {currentStep + (hasSubmitted ? 1 : 0)}
                        </span>
                    </div>
                    <Progress value={progress} className="h-3 rounded-full bg-secondary" />
                </div>

                {/* Question Card */}
                <Card className="rounded-[40px] border-2 border-border shadow-xl overflow-hidden">
                    <CardHeader className="p-10 pb-6 bg-secondary/20">
                        <CardTitle className="text-2xl md:text-3xl font-bold leading-tight tracking-tight">
                            {currentQuestion.question}
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="p-10 space-y-4">
                        {/* Answer options */}
                        <div className="grid grid-cols-1 gap-3">
                            {currentQuestion.options.map((option) => {
                                const isSelected   = selectedAnswer === option;
                                const isCorrectOpt = option === currentQuestion._correctText;

                                let borderClass = "border-border hover:border-primary/40 hover:bg-secondary/20";
                                let bgClass     = "";
                                let icon        = null;

                                if (hasSubmitted) {
                                    if (isCorrectOpt) {
                                        borderClass = "border-green-500 bg-green-50 dark:bg-green-900/20";
                                        bgClass     = "";
                                        icon        = <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />;
                                    } else if (isSelected && !isCorrectOpt) {
                                        borderClass = "border-red-400 bg-red-50 dark:bg-red-900/20";
                                        icon        = <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
                                    } else {
                                        borderClass = "border-border opacity-50";
                                    }
                                } else if (isSelected) {
                                    borderClass = "border-primary bg-primary/5 ring-1 ring-primary";
                                }

                                return (
                                    <button
                                        key={option}
                                        disabled={hasSubmitted}
                                        onClick={() => !hasSubmitted && setSelectedAnswer(option)}
                                        className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left w-full cursor-pointer ${borderClass} ${bgClass} disabled:cursor-default`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                            isSelected && !hasSubmitted ? "border-primary bg-primary" : "border-muted-foreground"
                                        }`}>
                                            {isSelected && !hasSubmitted && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                        <span className="text-base font-bold flex-1">{option}</span>
                                        {icon}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Explanation after submitting */}
                        <AnimatePresence>
                            {hasSubmitted && currentQuestion.explanation && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-4 rounded-2xl border ${isCorrect ? "bg-green-50 dark:bg-green-900/10 border-green-200" : "bg-amber-50 dark:bg-amber-900/10 border-amber-200"}`}
                                >
                                    <p className="text-sm font-black uppercase tracking-widest mb-1 text-muted-foreground">Explanation</p>
                                    <p className="text-sm font-medium">{currentQuestion.explanation}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Action buttons */}
                        <div className="pt-4 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <div className="p-2 rounded-xl bg-secondary/50">
                                    <Star className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-medium">
                                    {hasSubmitted
                                        ? isCorrect ? "Correct! Well done." : `The correct answer was: ${currentQuestion._correctText}`
                                        : "Take your time, there's no rush!"}
                                </p>
                            </div>

                            {!hasSubmitted ? (
                                <Button
                                    size="lg"
                                    disabled={!selectedAnswer}
                                    className="rounded-2xl px-10 h-14 text-lg font-black gap-2 disabled:opacity-50"
                                    onClick={handleSubmit}
                                >
                                    Check Answer
                                </Button>
                            ) : (
                                <Button
                                    size="lg"
                                    className="rounded-2xl px-10 h-14 text-lg font-black gap-2"
                                    onClick={handleNext}
                                    disabled={awardLoading}
                                >
                                    {awardLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                                    {currentStep === quizData.length - 1 ? "See Results" : "Next Question"} <ArrowRight className="w-5 h-5" />
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

            </div>
        </DashboardLayout>
    );
};

export default ComprehensionQuiz;
