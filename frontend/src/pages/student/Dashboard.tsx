import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, Trophy, Zap, Clock, ArrowRight, Loader2, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/api";
import { useNavigate } from "react-router-dom"; // Added for navigate function
import { useTranslation } from "@/i18n";
import { useContentNavigation } from "@/hooks/useContentNavigation";

const Leaderboard = ({ users }: { users: any[] }) => {
    const { t } = useTranslation();
    return (
    <Card className="rounded-[32px] border border-border overflow-hidden bg-card/50 shadow-none">
        <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber" /> {t("student_dashboard.leaderboard")}
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
};

const StudentDashboard = () => {
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [recentLessons, setRecentLessons] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [myStats, setMyStats] = useState<any>(null);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { openContent, mismatchModal, isChecking } = useContentNavigation();

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user) return;
            try {
                const idToken = await user.getIdToken();
                const headers = { "Authorization": `Bearer ${idToken}` };
                const baseUrl = API_BASE;

                // Fetch progress, leaderboard, and own stats in parallel
                const [progressRes, leaderboardRes, myStatsRes] = await Promise.all([
                    fetch(`${baseUrl}/api/progress`, { headers }),
                    fetch(`${baseUrl}/api/stats/leaderboard`, { headers }),
                    fetch(`${baseUrl}/api/stats/me`, { headers })
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
                    const lbData = await leaderboardRes.json();
                    setLeaderboard(lbData);
                    // Find the current student's own stats in the leaderboard
                    const mine = lbData.find((entry: any) => entry.userId === user.uid);
                    if (mine) setMyStats(mine);
                }

                // Prefer the dedicated /stats/me endpoint for own XP data
                if (myStatsRes?.ok) {
                    setMyStats(await myStatsRes.json());
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
        // Prefer real stats from StudentStats table, fall back to profile
        xp: myStats?.xp ?? profile?.stats?.xp ?? 0,
        level: myStats?.level ?? profile?.stats?.level ?? 1,
        nextLevelXp: (myStats?.level ?? profile?.stats?.level ?? 1) * 500,
        streak: myStats?.streak ?? profile?.stats?.streak ?? 0,
        lessonsCompleted: myStats?.completedLessons ?? profile?.stats?.completedLessons ?? 0,
        timeSpent: `${myStats?.totalReadingTime ?? profile?.stats?.totalReadingTime ?? 0}m`,
        badges: myStats?.badges ?? profile?.stats?.badges ?? []
    };

    return (
        <DashboardLayout role="student">
            <div className="max-w-6xl mx-auto space-y-10 pb-20">
                {mismatchModal}
                
                {/* Welcome Section */}
                <section>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
                    >
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight mb-2">{t("student_dashboard.hello", { name: student.name })}</h1>
                            <p className="text-muted-foreground font-medium">{t("student_dashboard.ready_message")}</p>
                        </div>

                        <div className="flex gap-4">
                            <div className="p-4 rounded-3xl bg-secondary/50 border border-border flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600">
                                    <Zap className="w-5 h-5 fill-current" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">{t("student_dashboard.current_streak")}</p>
                                    <p className="text-xl font-bold">{student.streak} {t("student_dashboard.days")}</p>
                                </div>
                            </div>
                            <div className="p-4 rounded-3xl bg-secondary/50 border border-border flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                                    <Trophy className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">{t("student_dashboard.level", { level: student.level })}</p>
                                    <p className="text-xl font-bold">{t("student_dashboard.explorer")}</p>
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
                                    {t("student_dashboard.next_level_progress")}
                                </CardTitle>
                                <CardDescription>{t("student_dashboard.xp_away", { xp: student.nextLevelXp - student.xp, next_level: student.level + 1 })}</CardDescription>
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
                                {t("student_dashboard.continue_learning")}
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
                                                        <div className="flex items-center gap-1.5 font-black uppercase tracking-widest"><Clock className="w-3.5 h-3.5" /> {t("student_dashboard.in_progress")}</div>
                                                        <div className="font-black">{lesson.progress}%</div>
                                                    </div>
                                                    <Progress value={lesson.progress} className="h-2 rounded-full bg-secondary" />
                                                    <Button
                                                        onClick={() => openContent(lesson)}
                                                        disabled={isChecking}
                                                        className="w-full rounded-2xl gap-2 font-black uppercase text-xs h-10 tracking-widest"
                                                    >
                                                        {lesson.status === 'completed' ? t("student_dashboard.review") : t("student_dashboard.resume")} <ArrowRight className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="md:col-span-2 flex flex-col items-center justify-center py-12 text-center gap-3 text-muted-foreground border-2 border-dashed border-border rounded-3xl">
                                        <BookOpen className="w-10 h-10 opacity-30" />
                                        <p className="font-bold text-sm">{t("student_dashboard.no_lessons_title")}</p>
                                        <p className="text-xs">{t("student_dashboard.no_lessons_desc")}</p>
                                        <Button variant="outline" className="mt-2 rounded-xl font-bold" onClick={() => navigate('/student/lessons')}>{t("student_dashboard.browse_lessons")}</Button>
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
                                <CardTitle className="text-lg font-bold">{t("student_dashboard.quick_stats")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-600">
                                            <BookOpen className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold">{t("student_dashboard.lessons_count")}</span>
                                    </div>
                                    <span className="text-lg font-black">{student.lessonsCompleted}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold">{t("student_dashboard.time_spent")}</span>
                                    </div>
                                    <span className="text-lg font-black">{student.timeSpent}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Badges Section */}
                        <Card className="rounded-[32px] border border-border overflow-hidden bg-card/50 shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-primary" /> {t("student_dashboard.your_badges")}
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
                                        <p className="text-xs text-muted-foreground italic">{t("student_dashboard.no_badges")}</p>
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
