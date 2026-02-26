import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Trophy, ArrowRight, CheckCircle2, Star, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ComprehensionQuiz = () => {
    const navigate = useNavigate();
    const { id } = useParams(); // literatureId
    const { user } = useAuth();

    const [currentStep, setCurrentStep] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string>("");
    const [isFinished, setIsFinished] = useState(false);

    const [quizData, setQuizData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchQuiz = async () => {
            if (!user || !id) return;
            try {
                const idToken = await user.getIdToken();
                const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/quiz/${id}`, {
                    headers: {
                        "Authorization": `Bearer ${idToken}`
                    }
                });

                if (!response.ok) throw new Error("Failed to fetch questions");

                const data = await response.json();

                // Shuffle options for each question so correct answer isn't always 'A' if returned linearly
                const shuffledData = data.map((q: any) => {
                    const parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                    // Copy array to prevent mutating string literal arrays
                    const opts = [...parsedOptions];
                    for (let i = opts.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [opts[i], opts[j]] = [opts[j], opts[i]];
                    }
                    return { ...q, options: opts };
                });

                setQuizData(shuffledData);
            } catch (err: any) {
                console.error("Quiz fetch error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchQuiz();
    }, [id, user]);

    const handleNext = () => {
        if (currentStep < quizData.length - 1) {
            setCurrentStep(currentStep + 1);
            setSelectedAnswer("");
        } else {
            setIsFinished(true);
        }
    };

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
                    <Button
                        size="lg"
                        variant="outline"
                        className="rounded-2xl font-bold gap-2"
                        onClick={() => navigate(`/student/reader/${id}`)}
                    >
                        <ArrowLeft className="w-5 h-5" /> Back to Reading
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    const currentQuestion = quizData[currentStep];
    const progress = ((currentStep + 1) / quizData.length) * 100;

    if (isFinished) {
        return (
            <DashboardLayout role="student">
                <div className="max-w-2xl mx-auto py-10">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center space-y-8"
                    >
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                            <Trophy className="w-32 h-32 text-primary relative z-10 mx-auto drop-shadow-2xl" />
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="absolute -top-4 -right-4"
                            >
                                <Sparkles className="w-12 h-12 text-lime opacity-50" />
                            </motion.div>
                        </div>

                        <div className="space-y-4">
                            <h1 className="text-5xl font-black tracking-tight">Amazing Work!</h1>
                            <p className="text-xl text-muted-foreground font-medium italic">"You understood the story perfectly."</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 rounded-[32px] bg-secondary/50 border border-border">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">XP Earned</p>
                                <p className="text-3xl font-black text-primary">+450 XP</p>
                            </div>
                            <div className="p-6 rounded-[32px] bg-secondary/50 border border-border">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">New Badge</p>
                                <p className="text-3xl font-black text-cyan">Story Master</p>
                            </div>
                        </div>

                        <Button
                            size="lg"
                            className="w-full rounded-2xl h-16 text-xl font-black gap-3 shadow-xl glow-lime"
                            onClick={() => navigate("/student/dashboard")}
                        >
                            Go to Dashboard <ArrowRight className="w-6 h-6" />
                        </Button>
                    </motion.div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="student">
            <div className="max-w-3xl mx-auto space-y-8 pb-20">

                <Button
                    variant="ghost"
                    className="font-bold gap-2 -ml-4 mb-4"
                    onClick={() => navigate(`/student/reader/${id}`)}
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Reader
                </Button>

                {/* Progress Header */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Question {currentStep + 1} of {quizData.length}
                        </span>
                        <span className="text-xs font-black uppercase tracking-widest text-primary">
                            {Math.round(progress)}% Complete
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

                    <CardContent className="p-10 space-y-8">
                        <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer} className="grid grid-cols-1 gap-4">
                            {currentQuestion.options.map((option: string) => (
                                <Label
                                    key={option}
                                    className={`flex items-center gap-4 p-6 rounded-2xl border-2 transition-all cursor-pointer hover:bg-secondary/20 ${selectedAnswer === option
                                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                                        : "border-border"
                                        }`}
                                >
                                    <RadioGroupItem value={option} className="sr-only" />
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedAnswer === option ? "border-primary bg-primary" : "border-muted-foreground"
                                        }`}>
                                        {selectedAnswer === option && <CheckCircle2 className="w-4 h-4 text-white" />}
                                    </div>
                                    <span className="text-lg font-bold">{option}</span>
                                </Label>
                            ))}
                        </RadioGroup>

                        <div className="pt-6 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <div className="p-2 rounded-xl bg-secondary/50">
                                    <Star className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-medium">Take your time, there's no rush!</p>
                            </div>

                            <Button
                                size="lg"
                                disabled={!selectedAnswer}
                                className="rounded-2xl px-12 h-14 text-lg font-black gap-2 transition-all disabled:opacity-50"
                                onClick={handleNext}
                            >
                                {currentStep === quizData.length - 1 ? "Finish Quiz" : "Next Question"} <ArrowRight className="w-5 h-5" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </DashboardLayout>
    );
};

export default ComprehensionQuiz;
