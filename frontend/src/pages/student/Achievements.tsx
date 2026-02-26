import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
    Trophy,
    Award,
    Star,
    Flame,
    Zap,
    Shield,
    Anchor,
    Rocket,
    Lock,
    CheckCircle2
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const AchievementHall = () => {
    const achievements = [
        {
            id: 1,
            title: "First Steps",
            description: "Complete your first lesson.",
            icon: <Rocket className="w-8 h-8" />,
            unlocked: true,
            color: "bg-primary/20 text-primary"
        },
        {
            id: 2,
            title: "Reading Streak",
            description: "Read for 5 days in a row.",
            icon: <Flame className="w-8 h-8" />,
            unlocked: true,
            color: "bg-amber/20 text-amber"
        },
        {
            id: 3,
            title: "Sea Explorer",
            description: "Complete 'The Old Man and the Sea'.",
            icon: <Anchor className="w-8 h-8" />,
            unlocked: true,
            color: "bg-cyan/20 text-cyan"
        },
        {
            id: 4,
            title: "Quiz Master",
            description: "Get 100% on 5 quizzes.",
            icon: <Star className="w-8 h-8" />,
            unlocked: false,
            color: "bg-secondary text-muted-foreground"
        },
        {
            id: 5,
            title: "Word Smith",
            description: "Learn 50 new vocabulary words.",
            icon: <Zap className="w-8 h-8" />,
            unlocked: false,
            color: "bg-secondary text-muted-foreground"
        },
        {
            id: 6,
            title: "Focus Guard",
            description: "Use Focus Mode for 2 hours.",
            icon: <Shield className="w-8 h-8" />,
            unlocked: false,
            color: "bg-secondary text-muted-foreground"
        },
    ];

    return (
        <DashboardLayout role="student">
            <div className="max-w-6xl mx-auto space-y-12 pb-20">

                {/* Header Section */}
                <section className="text-center space-y-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-block p-4 rounded-full bg-primary/10 mb-2"
                    >
                        <Award className="w-12 h-12 text-primary" />
                    </motion.div>
                    <h1 className="text-4xl font-black tracking-tight">Achievement Hall</h1>
                    <p className="text-muted-foreground font-medium max-w-xl mx-auto">
                        Celebrate your progress! Every lesson you complete brings you closer to becoming a Master Reader.
                    </p>
                </section>

                {/* Level Progress */}
                <Card className="rounded-[40px] border-2 border-primary/10 overflow-hidden bg-primary/5 p-8">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-3xl font-black shadow-xl ring-8 ring-white dark:ring-primary-foreground/10 shrink-0">
                            8
                        </div>
                        <div className="flex-1 w-full space-y-4 text-center md:text-left">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h3 className="text-xl font-bold">Explorer Level</h3>
                                    <p className="text-sm text-muted-foreground font-medium">Next Milestone: Level 10 (Master Explorer)</p>
                                </div>
                                <span className="text-sm font-black text-primary">85% to Level 9</span>
                            </div>
                            <Progress value={85} className="h-4 rounded-full bg-white dark:bg-black/20" />
                        </div>
                    </div>
                </Card>

                {/* Badge Grid */}
                <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    <TooltipProvider>
                        {achievements.map((badge, idx) => (
                            <motion.div
                                key={badge.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Card className={`rounded-[32px] aspect-square flex flex-col items-center justify-center p-6 border-2 transition-all cursor-help relative group ${badge.unlocked
                                                ? "border-primary/20 bg-card hover:border-primary hover:shadow-2xl"
                                                : "border-dashed border-muted bg-secondary/30 grayscale"
                                            }`}>
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${badge.color}`}>
                                                {badge.unlocked ? badge.icon : <Lock className="w-8 h-8 opacity-40" />}
                                            </div>
                                            <h4 className="font-bold text-sm text-center">{badge.title}</h4>

                                            {badge.unlocked && (
                                                <div className="absolute top-3 right-3">
                                                    <CheckCircle2 className="w-5 h-5 text-primary fill-white" />
                                                </div>
                                            )}
                                        </Card>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="rounded-xl p-3 font-medium text-xs">
                                        {badge.description}
                                    </TooltipContent>
                                </Tooltip>
                            </motion.div>
                        ))}
                    </TooltipProvider>
                </section>

                {/* Statistics Row */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: "Badges Earned", value: "3 / 12", color: "text-primary" },
                        { label: "Course Mastered", value: "2", color: "text-cyan" },
                        { label: "Global Rank", value: "#42", color: "text-amber" },
                    ].map((stat, i) => (
                        <div key={i} className="p-8 rounded-[32px] bg-secondary/20 border border-border text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                            <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                        </div>
                    ))}
                </section>

            </div>
        </DashboardLayout>
    );
};

export default AchievementHall;
