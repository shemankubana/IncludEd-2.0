import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, Trophy, Zap, Clock, ArrowRight, Loader2, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom"; // Added for navigate function

const Leaderboard = ({ users }: { users: any[] }) => (
    <Card className="rounded-[32px] border border-border overflow-hidden bg-card/50 shadow-none">
        <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber" /> School Leaderboard
            </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
            <div className="divide-y divide-border/30">
                {users.map((u, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 hover:bg-secondary/20 transition-colors">
                        <div className="w-6 text-xs font-black text-muted-foreground">{i + 1}</div>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs">
                            {u.User?.firstName?.[0] || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{u.User?.firstName} {u.User?.lastName}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{u.User?.classLevel}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-black text-primary">{u.xp} XP</p>
                        </div>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
);

const StudentDashboard = () => {
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [recentLessons, setRecentLessons] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]); // Added leaderboard state
    const navigate = useNavigate(); // Added useNavigate hook

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user) return;
            try {
                const idToken = await user.getIdToken();
                const headers = { "Authorization": `Bearer ${idToken}` };
                const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

                // Fetch progress and leaderboard in parallel
                const [progressRes, leaderboardRes] = await Promise.all([
                    fetch(`${baseUrl}/api/progress`, { headers }),
                    fetch(`${baseUrl}/api/stats/leaderboard`, { headers })
                ]);

                if (progressRes.ok) {
                    const progressData = await progressRes.json();
                    setRecentLessons(progressData.map((p: any) => {
                        const totalSections = p.Literature?.sections?.length || 1;
                        const completedCount = p.completedSections?.length || 0;
                        const progressPercent = p.status === 'completed' ? 100 : Math.round((completedCount / totalSections) * 100);

                        return {
                            id: p.Literature?.id,
                            title: p.Literature?.title || "Unknown Lesson",
                            progress: progressPercent,
                            subject: p.Literature?.subject || "General",
                            color: p.status === 'completed' ? "bg-accent" : "bg-primary",
                            status: p.status
                        };
                    }));
                }

                if (leaderboardRes.ok) {
                    setLeaderboard(await leaderboardRes.json());
                }

            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (profile) fetchDashboardData();
    }, [user, profile]);

    if (loading) {
        return (
            <DashboardLayout role="student">
                <div className="h-[60vh] flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    const student = {
        name: profile?.firstName || "Explorer",
        xp: profile?.stats?.xp || 0,
        nextLevelXp: (profile?.stats?.level || 1) * 500,
        streak: profile?.stats?.streak || 0,
        lessonsCompleted: profile?.stats?.completedLessons || 0,
        timeSpent: `${profile?.stats?.totalReadingTime || 0}m`,
        level: profile?.stats?.level || 1,
        badges: profile?.stats?.badges || []
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
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600">
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
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">Level {student.level}</p>
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
                                    Next Level Progress
                                </CardTitle>
                                <CardDescription>You are only {student.nextLevelXp - student.xp} XP away from Level {student.level + 1}!</CardDescription>
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
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary/60 px-1">
                                Continue Learning
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {recentLessons.length > 0 ? (
                                    recentLessons.map((lesson) => (
                                        <Card key={lesson.id} className="rounded-3xl border border-border overflow-hidden group hover:scale-[1.02] transition-all cursor-pointer shadow-none hover:shadow-lg bg-card/50">
                                            <CardHeader className="pb-2">
                                                <span className={`w-fit px-2 py-0.5 rounded-full ${lesson.color} text-[10px] font-black text-white uppercase`}>
                                                    {lesson.subject}
                                                </span>
                                                <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors mt-2">{lesson.title}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                                                        <div className="flex items-center gap-1.5 font-black uppercase tracking-widest"><Clock className="w-3.5 h-3.5" /> In progress</div>
                                                        <div className="font-black">{lesson.progress}%</div>
                                                    </div>
                                                    <Progress value={lesson.progress} className="h-2 rounded-full bg-secondary" />
                                                    <Button
                                                        onClick={() => navigate(`/student/reader/${lesson.id}`)}
                                                        className="w-full rounded-2xl gap-2 font-black uppercase text-xs h-10 tracking-widest"
                                                    >
                                                        {lesson.status === 'completed' ? 'Review' : 'Resume'} <ArrowRight className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="md:col-span-2 flex flex-col items-center justify-center py-12 text-center gap-3 text-muted-foreground border-2 border-dashed border-border rounded-3xl">
                                        <BookOpen className="w-10 h-10 opacity-30" />
                                        <p className="font-bold text-sm">No lessons started yet</p>
                                        <p className="text-xs">Head to the Lesson Library and start reading to see your progress here.</p>
                                        <Button variant="outline" className="mt-2 rounded-xl font-bold" onClick={() => navigate('/student/lessons')}>Browse Lessons</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Area: Stats & Leaderboard */}
                    <div className="space-y-8">
                        <Leaderboard users={leaderboard} />

                        {/* Session Stats */}
                        <Card className="rounded-[32px] border border-border overflow-hidden bg-secondary/20 shadow-none border-dashed p-2">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Quick Stats</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-600">
                                            <BookOpen className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold">Lessons</span>
                                    </div>
                                    <span className="text-lg font-black">{student.lessonsCompleted}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold">Time</span>
                                    </div>
                                    <span className="text-lg font-black">{student.timeSpent}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Badges Section */}
                        <Card className="rounded-[32px] border border-border overflow-hidden bg-card/50 shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-primary" /> Your Badges
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {student.badges.length > 0 ? (
                                        student.badges.map((badge: string) => (
                                            <div key={badge} className="p-2 px-3 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                                <Star className="w-3 h-3" /> {badge.replace('_', ' ')}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">No badges earned yet. Keep reading!</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                </div>

            </div>
        </DashboardLayout>
    );
};

export default StudentDashboard;
