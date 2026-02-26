import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, Trophy, Zap, Clock, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const StudentDashboard = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [studentData, setStudentData] = useState<any>(null);
    const [recentLessons, setRecentLessons] = useState<any[]>([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user) return;
            try {
                const idToken = await user.getIdToken();
                const headers = { "Authorization": `Bearer ${idToken}` };
                const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

                // Fetch student stats
                const profileRes = await fetch(`${baseUrl}/api/auth/me`, { headers });
                const profileData = await profileRes.json();

                // Fetch recent sessions
                const sessionsRes = await fetch(`${baseUrl}/api/sessions/my`, { headers });
                const sessionsData = await sessionsRes.json();

                setStudentData({
                    name: profileData.firstName || "Explorer",
                    xp: profileData.xp || 0,
                    nextLevelXp: 3000,
                    streak: profileData.streak || 0,
                    lessonsCompleted: profileData.totalSessions || 0,
                    timeSpent: "2h 45m", // Placeholder for derived calc if not in backend
                });

                setRecentLessons(sessionsData.map((s: any) => ({
                    id: s.Literature?.id || s.id,
                    title: s.Literature?.title || "Unknown Lesson",
                    progress: Math.round(s.quizScore * 100 || 0),
                    subject: s.Literature?.subject || "General",
                    color: "bg-primary"
                })));

            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    if (loading) {
        return (
            <DashboardLayout role="student">
                <div className="h-[60vh] flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    const student = studentData || {
        name: "Explorer",
        xp: 0,
        nextLevelXp: 3000,
        streak: 0,
        lessonsCompleted: 0,
        timeSpent: "0m",
    };

    return (
        <DashboardLayout role="student">
            <div className="max-w-6xl mx-auto space-y-10 pb-20">

                {/* Welcome Section */}
                <section>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
                    >
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight mb-2">Hello, {student.name}! 👋</h1>
                            <p className="text-muted-foreground font-medium">Ready to continue your learning journey today?</p>
                        </div>

                        <div className="flex gap-4">
                            <div className="p-4 rounded-3xl bg-secondary/50 border border-border flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber/20 flex items-center justify-center text-amber">
                                    <Zap className="w-5 h-5 fill-current" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">Current Streak</p>
                                    <p className="text-xl font-bold">{student.streak} Days</p>
                                </div>
                            </div>
                            <div className="p-4 rounded-3xl bg-secondary/50 border border-border flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                                    <Trophy className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">Level 8</p>
                                    <p className="text-xl font-bold">Explorer</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Content: Progress & Lessons */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* XP Progress Card */}
                        <Card className="rounded-[32px] border-2 border-primary/10 overflow-hidden relative group transition-all hover:border-primary/30 shadow-sm">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-primary/10 transition-colors" />
                            <CardHeader className="pb-2 relative z-10">
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    Next Level: Master Reader
                                </CardTitle>
                                <CardDescription>You are only {student.nextLevelXp - student.xp} XP away from the next title!</CardDescription>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm font-bold">
                                        <span>{student.xp} XP</span>
                                        <span className="text-muted-foreground">{student.nextLevelXp} XP</span>
                                    </div>
                                    <Progress value={(student.xp / student.nextLevelXp) * 100} className="h-4 rounded-full bg-secondary" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Continue Reading */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold tracking-tight px-1">Continue Learning</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {recentLessons.map((lesson) => (
                                    <Card key={lesson.id} className="rounded-3xl border border-border overflow-hidden group hover:scale-[1.02] transition-all cursor-pointer shadow-none hover:shadow-lg">
                                        <CardHeader className="pb-2">
                                            <span className={`w-fit px-2 py-0.5 rounded-full ${lesson.color} text-[10px] font-bold text-white uppercase`}>
                                                {lesson.subject}
                                            </span>
                                            <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors mt-2">{lesson.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                                                    <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 15m left</div>
                                                    <div>{lesson.progress}% done</div>
                                                </div>
                                                <Progress value={lesson.progress} className="h-2 rounded-full bg-secondary" />
                                                <Button className="w-full rounded-2xl gap-2 font-bold h-10">
                                                    Resume Session <ArrowRight className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Area: Stats & Achievements */}
                    <div className="space-y-8">
                        <Card className="rounded-[32px] border border-border overflow-hidden bg-secondary/30 shadow-none border-dashed p-2">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Session Stats</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-background border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-cyan/10 flex items-center justify-center text-cyan">
                                            <BookOpen className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold">Lessons</span>
                                    </div>
                                    <span className="text-lg font-black">{student.lessonsCompleted}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-background border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-rose/10 flex items-center justify-center text-rose">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold">Reading Time</span>
                                    </div>
                                    <span className="text-lg font-black">{student.timeSpent}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Daily Challenge */}
                        <div className="p-6 rounded-[32px] bg-primary text-primary-foreground relative overflow-hidden shadow-xl">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                <Zap className="w-5 h-5 fill-current" /> Daily Challenge
                            </h3>
                            <p className="text-sm opacity-90 mb-6 font-medium">Read for 20 minutes to earn a 2x XP booster!</p>
                            <Button variant="secondary" className="w-full rounded-2xl font-black text-xs uppercase h-10 tracking-widest">
                                Open Lesson
                            </Button>
                        </div>
                    </div>

                </div>

            </div>
        </DashboardLayout>
    );
};

export default StudentDashboard;
