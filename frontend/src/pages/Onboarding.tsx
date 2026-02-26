import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Check, ArrowRight, ArrowLeft, Brain, BookOpen, Layers } from "lucide-react";

const onboardingSteps = [
    {
        id: "intro",
        title: "Welcome to IncludEd! 👋",
        description: "Let's personalize your reading experience. We'll ask a few questions to understand how you learn best.",
        icon: <BookOpen className="w-12 h-12 text-primary" />,
    },
    {
        id: "dyslexia_1",
        title: "Letters & Words",
        question: "Do letters or words ever seem to move, blur, or flip while you are reading?",
        category: "dyslexia",
    },
    {
        id: "focus_1",
        title: "Staying on Track",
        question: "Do you often lose your place or skip lines even when trying to focus?",
        category: "both",
    },
    {
        id: "adhd_1",
        title: "Focus & Energy",
        question: "Do you feel restless or find it very hard to sit still while reading?",
        category: "adhd",
    },
    {
        id: "adhd_2",
        title: "Distractions",
        question: "Are you easily distracted by noises or things happening around you?",
        category: "adhd",
    },
    {
        id: "preference_1",
        title: "Reading Style",
        question: "Do you prefer listening to a story rather than reading it?",
        category: "preference",
    },
    {
        id: "finish",
        title: "All set!",
        description: "We're calculating your custom learning profile now. Ready to start?",
        icon: <Check className="w-12 h-12 text-green-500" />,
    }
];

const Onboarding = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleAnswer = (value: string) => {
        const stepId = onboardingSteps[currentStep].id;
        setAnswers(prev => ({ ...prev, [stepId]: value }));

        if (currentStep < onboardingSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const calculateProfile = () => {
        let dyslexiaScore = 0;
        let adhdScore = 0;

        if (answers["dyslexia_1"] === "yes") dyslexiaScore += 0.5;
        if (answers["dyslexia_1"] === "sometimes") dyslexiaScore += 0.25;

        if (answers["focus_1"] === "yes") {
            dyslexiaScore += 0.25;
            adhdScore += 0.25;
        }

        if (answers["adhd_1"] === "yes") adhdScore += 0.4;
        if (answers["adhd_2"] === "yes") adhdScore += 0.4;

        let disabilityType = "none";
        if (dyslexiaScore > 0.4 && adhdScore > 0.4) disabilityType = "both";
        else if (dyslexiaScore > 0.4) disabilityType = "dyslexia";
        else if (adhdScore > 0.4) disabilityType = "adhd";

        return {
            dyslexiaScore,
            adhdScore,
            disabilityType,
            preferences: {
                ttsEnabled: answers["preference_1"] === "yes",
                fontSize: 18,
                lineSpacing: 1.8
            }
        };
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const result = calculateProfile();
            const idToken = await user?.getIdToken();

            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/onboarding/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify(result)
            });

            if (response.ok) {
                toast({ title: "Profile Created!", description: "Your learning experience has been personalized." });
                navigate("/student/dashboard");
            } else {
                throw new Error("Failed to save profile");
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const step = onboardingSteps[currentStep];
    const progress = (currentStep / (onboardingSteps.length - 1)) * 100;

    return (
        <div className="min-h-screen bg-background bg-grid flex items-center justify-center p-6">
            <div className="max-w-xl w-full space-y-8">
                <div className="flex flex-col items-center text-center space-y-2">
                    <Brain className="w-12 h-12 text-primary animate-pulse" />
                    <h1 className="text-3xl font-black tracking-tight">Onboarding</h1>
                    <Progress value={progress} className="w-64 h-2 rounded-full mt-4" />
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.05, y: -10 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                    >
                        <Card className="rounded-[40px] border-2 border-primary/10 shadow-2xl overflow-hidden glassmorphism">
                            <CardContent className="p-10 space-y-8">
                                <div className="flex flex-col items-center text-center space-y-4">
                                    {step.icon && <div className="bg-secondary p-4 rounded-3xl">{step.icon}</div>}
                                    <h2 className="text-2xl font-black tracking-tight">{step.title}</h2>
                                    <p className="text-muted-foreground font-medium text-lg">
                                        {step.description || step.question}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {step.id === "intro" ? (
                                        <Button
                                            onClick={() => setCurrentStep(1)}
                                            className="h-16 rounded-2xl text-xl font-black gap-3 shadow-lg hover:shadow-primary/20"
                                        >
                                            Get Started <ArrowRight className="w-6 h-6" />
                                        </Button>
                                    ) : step.id === "finish" ? (
                                        <Button
                                            onClick={handleSubmit}
                                            disabled={loading}
                                            className="h-16 rounded-2xl text-xl font-black gap-3 shadow-lg hover:shadow-green-500/20 bg-green-500 hover:bg-green-600"
                                        >
                                            {loading ? "Saving..." : "Go to Dashboard"} <Check className="w-6 h-6" />
                                        </Button>
                                    ) : (
                                        <>
                                            <Button onClick={() => handleAnswer("yes")} variant="outline" className="h-14 rounded-2xl text-lg font-bold border-2 hover:border-primary hover:bg-primary/5 transition-all">Yes, very often</Button>
                                            <Button onClick={() => handleAnswer("sometimes")} variant="outline" className="h-14 rounded-2xl text-lg font-bold border-2 hover:border-primary hover:bg-primary/5 transition-all">Sometimes</Button>
                                            <Button onClick={() => handleAnswer("no")} variant="outline" className="h-14 rounded-2xl text-lg font-bold border-2 hover:border-primary hover:bg-primary/5 transition-all">No, not really</Button>
                                        </>
                                    )}
                                </div>

                                {currentStep > 0 && currentStep < onboardingSteps.length - 1 && (
                                    <button
                                        onClick={handleBack}
                                        className="w-full text-center text-sm font-bold text-muted-foreground hover:text-primary flex items-center justify-center gap-1 transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> Go Back
                                    </button>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Onboarding;
