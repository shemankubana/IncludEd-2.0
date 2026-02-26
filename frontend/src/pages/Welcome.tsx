import { motion } from "framer-motion";
import { BookOpen, Sparkles, ArrowRight, ShieldCheck, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Welcome = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            // Fetch profile to redirect to correct dashboard
            const fetchRoleAndRedirect = async () => {
                const idToken = await user.getIdToken();
                const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/auth/me`, {
                    headers: { "Authorization": `Bearer ${idToken}` }
                });
                if (response.ok) {
                    const userData = await response.json();
                    if (userData.role === "teacher") navigate("/teacher/dashboard");
                    else navigate("/student/dashboard");
                }
            };
            fetchRoleAndRedirect();
        }
    }, [user, navigate]);

    const steps = [
        {
            icon: <Sparkles className="w-6 h-6 text-lime" />,
            title: "AI Adaptation",
            description: "Lessons that breathe and change based on how you read.",
        },
        {
            icon: <ShieldCheck className="w-6 h-6 text-cyan" />,
            title: "Focus Support",
            description: "Smart tools to help you stay on track and feel confident.",
        },
        {
            icon: <Heart className="w-6 h-6 text-rose" />,
            title: "Every Learner",
            description: "Designed specifically for students with unique learning paths.",
        },
    ];

    return (
        <div className="min-h-screen bg-background bg-grid flex flex-col overflow-hidden">
            {/* Header */}
            <header className="container mx-auto px-6 h-20 flex items-center justify-between z-10">
                <div className="flex items-center">
                    <img src="/logo.png" alt="IncludEd Logo" className="h-10 w-auto" />
                </div>
                <ThemeToggle />
            </header>

            {/* Main Hero */}
            <main className="flex-1 container mx-auto px-6 flex flex-col items-center justify-center relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl -z-10" />

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-center max-w-3xl mb-12"
                >
                    <span className="inline-block py-1 px-3 rounded-full bg-primary/10 text-primary text-xs font-bold mb-6 tracking-wider uppercase">
                        Welcome to the future of learning
                    </span>
                    <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight">
                        Learning that <span className="text-gradient-lime">understands</span> you.
                    </h1>
                    <p className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-xl mx-auto">
                        IncludEd uses smart AI to help every student in Rwanda read, learn, and grow at their own perfect pace.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button
                            size="lg"
                            className="rounded-2xl h-14 px-8 text-lg font-bold gap-2 shadow-lg glow-lime transition-all hover:scale-[1.02]"
                            onClick={() => navigate("/auth")}
                        >
                            Start My Journey <ArrowRight className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            className="rounded-2xl h-14 px-8 text-lg font-bold border-2"
                            onClick={() => {
                                document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                        >
                            Learn More
                        </Button>
                    </div>
                </motion.div>

                {/* Dynamic Steps */}
                <div id="about" className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-12 pb-20">
                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + index * 0.1 }}
                            className="p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                {step.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </main>

            <footer className="py-8 border-t border-border/50">
                <div className="container mx-auto px-6 text-center text-xs text-muted-foreground">
                    © 2026 IncludEd. Helping every mind shine.
                </div>
            </footer>
        </div>
    );
};

export default Welcome;
