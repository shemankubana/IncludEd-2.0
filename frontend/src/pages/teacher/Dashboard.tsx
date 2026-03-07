import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Users,
    TrendingUp,
    AlertCircle,
    FileText,
    ArrowUpRight,
    MoreVertical,
    Search,
    Filter,
    Loader2,
    Mail,
    Link as LinkIcon,
    Trash2,
    BookOpen,
    Plus,
    Brain,
    ShieldAlert,
    CheckCircle2,
    Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/api";
import { motion } from "framer-motion";
import AnalyticsCharts from "@/components/teacher/AnalyticsCharts";

const TeacherDashboard = () => {
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [content, setContent] = useState<any[]>([]);
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [inviteEmail, setInviteEmail] = useState("");
    const [isInviting, setIsInviting] = useState(false);
    const [expandedRec, setExpandedRec] = useState<number | null>(null);
    const [intelligenceData, setIntelligenceData] = useState<{
        summaries: any[];
        alerts: any[];
        recommendations: Record<string, any[]>;
        loading: boolean;
    }>({ summaries: [], alerts: [], recommendations: {}, loading: false });
    const { toast } = useToast();

    const AI_URL = import.meta.env.VITE_AI_URL || "http://localhost:8000";

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!user) return;
            try {
                const idToken = await user.getIdToken();
                const headers = { "Authorization": `Bearer ${idToken}` };
                const baseUrl = API_BASE;

                const response = await fetch(`${baseUrl}/api/analytics/class`, { headers });
                const data = await response.json();

                // Store full analytics data for charts
                setAnalyticsData(data);

                setStats([
                    { label: "Active Students", value: data.overview?.totalStudents || "0", icon: <Users className="w-5 h-5" />, trend: "Total enrolled" },
                    { label: "Average Progress", value: `${Math.round(data.overview?.avgQuizScore * 100 || 0)}%`, icon: <TrendingUp className="w-5 h-5" />, trend: "Quiz mastery" },
                    { label: "Attention Level", value: `${Math.round(data.overview?.avgAttention * 100 || 0)}%`, icon: <AlertCircle className="w-5 h-5" />, trend: "Engagement" },
                    { label: "Lessons Used", value: data.overview?.totalLessons || "0", icon: <FileText className="w-5 h-5" />, trend: "Activity" },
                ]);

                // Fetching student roster from the backend response
                if (data.recentSessions) {
                    setStudents(data.recentSessions.map((s: any) => ({
                        name: s.student ? `${s.student.firstName} ${s.student.lastName}` : "Unknown Student",
                        lastActive: s.endedAt ? "Completed" : "Active",
                        progress: Math.round(s.quizScore * 100 || 0),
                        status: s.quizScore > 0.7 ? "Mastered" : "On Track",
                        color: "bg-primary"
                    })));
                }

                const contentRes = await fetch(`${baseUrl}/api/literature/my-content`, { headers });
                const contentData = await contentRes.json();
                setContent(Array.isArray(contentData) ? contentData : []);

            } catch (error) {
                console.error("Failed to fetch analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [user]);

    // ── Fetch Teacher Intelligence (NL summaries + alerts) ─────────────────────
    const fetchIntelligence = useCallback(async () => {
        if (!user || students.length === 0) return;
        setIntelligenceData(prev => ({ ...prev, loading: true }));
        try {
            const idToken = await user.getIdToken();
            const headers = { "Authorization": `Bearer ${idToken}` };
            const baseUrl = API_BASE;

            // Get all content to find the most recent book
            const contentRes = await fetch(`${baseUrl}/api/literature/my-content`, { headers });
            const contentData = await contentRes.json();
            const latestBook = Array.isArray(contentData) && contentData.length > 0 ? contentData[0] : null;
            const bookTitle = latestBook?.title || "";
            const bookId = latestBook?.id || "";

            // Generate summaries for each student using AI service
            const summaryPromises = students.slice(0, 10).map(async (student: any) => {
                // Build a minimal comprehension data from what we have
                const compData = {
                    chapters_read: Math.max(1, Math.floor(student.progress / 10)),
                    average_comprehension: student.progress / 100,
                    vocabulary_progress: student.progress / 100,
                    characters_understood: {},
                    literary_devices_seen: {},
                    chapters_needing_revisit: student.progress < 50 ? [{ title: "Recent chapter", score: student.progress / 100 }] : [],
                    total_highlights: 0,
                    total_time_minutes: 0,
                };
                const profileData = {
                    persistence: student.progress > 60 ? 0.7 : 0.4,
                    frustration_level: student.progress < 40 ? 0.6 : 0.3,
                    preferred_adaptations: [],
                    best_time_of_day: "9am-noon",
                };

                try {
                    const res = await fetch(`${AI_URL}/teacher/student-summary`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            student_name: student.name,
                            student_id: student.name.replace(/\s+/g, "_").toLowerCase(),
                            book_id: bookId,
                            class_average_chapter: Math.floor(
                                students.reduce((a: number, s: any) => a + Math.floor(s.progress / 10), 0) / Math.max(students.length, 1)
                            ),
                        }),
                    });
                    if (res.ok) return await res.json();
                } catch { /* use fallback */ }

                // Fallback: construct summary locally
                return {
                    student_name: student.name,
                    summary: `${student.name} has completed ${student.progress}% of the assigned reading.`,
                    strengths: student.progress > 70 ? ["strong comprehension"] : [],
                    areas_for_growth: student.progress < 50 ? ["pacing", "comprehension"] : [],
                    recommendation: student.progress < 50
                        ? `Recommended: Check in with ${student.name} and offer additional support.`
                        : `${student.name} is on track. Continue current approach.`,
                    risk_level: student.progress < 40 ? "high" : student.progress < 65 ? "medium" : "low",
                    chapters_behind: 0,
                };
            });

            const summaries = await Promise.all(summaryPromises);

            // Generate class-wide alerts
            let alerts: any[] = [];
            try {
                const alertsRes = await fetch(`${AI_URL}/teacher/class-alerts`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        student_summaries: summaries,
                        book_title: bookTitle,
                    }),
                });
                if (alertsRes.ok) {
                    const alertsData = await alertsRes.json();
                    alerts = alertsData.alerts || [];
                }
            } catch { /* alerts optional */ }

            // Fetch per-student highlights and detect common passages (D6)
            try {
                const allHighlights: any[] = [];
                await Promise.all(
                    students.slice(0, 10).map(async (student: any) => {
                        const studentId = student.name.replace(/\s+/g, "_").toLowerCase();
                        const compRes = await fetch(
                            `${AI_URL}/comprehension/summary?student_id=${encodeURIComponent(studentId)}&book_id=${encodeURIComponent(bookId)}`
                        ).catch(() => null);
                        if (!compRes?.ok) return;
                        const compData = await compRes.json();
                        // comprehension summary doesn't expose raw highlights, so we use
                        // the student name + highlight count as a proxy signal — the full
                        // highlight list would need a dedicated backend endpoint per student.
                        // For now we attach whatever the summary exposes.
                        (compData.recent_highlights || []).forEach((h: any) => {
                            allHighlights.push({ ...h, student_name: student.name });
                        });
                    })
                );
                if (allHighlights.length > 0) {
                    const hlRes = await fetch(`${AI_URL}/teacher/common-highlights`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ highlights: allHighlights, book_title: bookTitle }),
                    });
                    if (hlRes.ok) {
                        const hlData = await hlRes.json();
                        alerts = [...alerts, ...(hlData.alerts || [])];
                    }
                }
            } catch { /* common-highlight alerts optional */ }

            setIntelligenceData({ summaries, alerts, loading: false });

            // ── Fetch per-student recommendations (D6 actionable intelligence) ──
            const recMap: Record<string, any[]> = {};
            await Promise.all(
                summaries.slice(0, 10).map(async (s: any, idx: number) => {
                    const student = students[idx];
                    if (!student) return;
                    const studentId = student.name.replace(/\s+/g, "_").toLowerCase();
                    try {
                        const recRes = await fetch(`${AI_URL}/teacher/recommendations/student`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                student_id: studentId,
                                student_name: s.student_name,
                                student_profile: {
                                    attention_score: student.progress / 100,
                                    frustration_level: s.risk_level === "high" ? 0.7 : 0.3,
                                    best_time_of_day: "9am-noon",
                                    persistence: student.progress > 60 ? 0.7 : 0.4,
                                },
                                recent_sessions: [{
                                    quiz_score: student.progress / 100,
                                    attention_score: student.progress / 100,
                                }],
                            }),
                        });
                        if (recRes.ok) {
                            const recData = await recRes.json();
                            recMap[s.student_name] = recData.recommendations || [];
                        }
                    } catch { /* optional */ }
                })
            );
            setIntelligenceData(prev => ({ ...prev, recommendations: recMap }));
        } catch (err) {
            console.error("Intelligence fetch failed:", err);
            setIntelligenceData(prev => ({ ...prev, loading: false }));
        }
    }, [user, students, AI_URL]);

    const handleInvite = async () => {
        if (!inviteEmail) return;
        setIsInviting(true);
        try {
            const idToken = await user?.getIdToken();
            const res = await fetch(`${API_BASE}/api/schools/invite`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${idToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email: inviteEmail })
            });
            const data = await res.json();
            if (res.ok) {
                toast({
                    title: "Invitation Sent!",
                    description: `An invite link has been generated for ${inviteEmail}. Link: ${data.link}`
                });
                setInviteEmail("");
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            toast({ title: "Invite Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsInviting(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout role="teacher">
                <div className="h-[60vh] flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-7xl mx-auto space-y-10 pb-20">

                {/* Welcome Header */}
                <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black tracking-tight">Teacher Overview</h1>
                        <p className="text-muted-foreground font-medium">
                            {profile?.school?.name || "School"} — {profile?.classLevel || "General"} {profile?.term ? `(${profile.term})` : ''}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <div className="flex gap-2 bg-secondary/30 p-1 rounded-xl border border-border">
                            <Input
                                placeholder="Student Email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="h-9 w-48 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm font-medium"
                            />
                            <Button
                                size="sm"
                                className="rounded-lg font-bold h-9 px-4 gap-2"
                                onClick={handleInvite}
                                disabled={isInviting || !inviteEmail}
                            >
                                {isInviting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                Invite
                            </Button>
                        </div>
                        <Button variant="outline" className="rounded-xl font-bold h-11 px-6">Export</Button>
                        <Button
                            className="rounded-xl font-bold h-11 px-6 shadow-lg glow-lime"
                            onClick={() => window.location.href = '/teacher/create'}
                        >
                            Generate Content
                        </Button>
                    </div>
                </section>

                {/* Stats Grid */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            <Card className="rounded-[32px] border-2 border-border/50 hover:border-primary/20 transition-all group cursor-default shadow-none">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        {stat.icon}
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                                    <h4 className="text-3xl font-black mt-1">{stat.value}</h4>
                                    <p className="text-[10px] font-bold mt-2 text-primary opacity-80">{stat.trend}</p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </section>

                {/* Detailed View Tabs */}
                <Tabs defaultValue="students" className="space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <TabsList className="bg-secondary/50 p-1.5 rounded-2xl h-14 w-fit border border-border">
                            <TabsTrigger value="students" className="rounded-xl font-black text-sm px-6 data-[state=active]:bg-background data-[state=active]:shadow-lg">Student Roster</TabsTrigger>
                            <TabsTrigger value="analytics" className="rounded-xl font-black text-sm px-6 data-[state=active]:bg-background data-[state=active]:shadow-lg">Class Analytics</TabsTrigger>
                            <TabsTrigger
                                value="intelligence"
                                className="rounded-xl font-black text-sm px-6 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2 flex items-center"
                                onClick={() => { if (intelligenceData.summaries.length === 0) fetchIntelligence(); }}
                            >
                                <Brain className="w-3.5 h-3.5" />
                                AI Insights
                                {Object.values(intelligenceData.recommendations).flat().some((r: any) => r.priority === "high") && (
                                    <span className="ml-0.5 rounded-full bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 min-w-[16px] text-center">
                                        {Object.values(intelligenceData.recommendations).flat().filter((r: any) => r.priority === "high").length}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="content" className="rounded-xl font-black text-sm px-6 data-[state=active]:bg-background data-[state=active]:shadow-lg">My Content</TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-3">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input placeholder="Search students..." className="pl-10 h-12 rounded-xl w-64 border-2 border-border focus:border-primary transition-all shadow-none" />
                            </div>
                            <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-2">
                                <Filter className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    <TabsContent value="students">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {students.map((student, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                >
                                    <Card className="rounded-[40px] border border-border hover:shadow-xl transition-all group p-1">
                                        <CardContent className="p-6 flex items-center gap-6">
                                            <div className={`w-14 h-14 rounded-full ${student.color}/20 flex items-center justify-center text-2xl font-black text-foreground`}>
                                                {student.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <h4 className="font-bold text-lg group-hover:text-primary transition-colors">{student.name}</h4>
                                                <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                                                    Last active: <span className="font-bold">{student.lastActive}</span>
                                                </p>
                                            </div>
                                            <div className="text-right space-y-1.5">
                                                <Badge variant={student.status === "Needs Support" ? "destructive" : "secondary"} className="rounded-lg font-black text-[10px] uppercase">
                                                    {student.status}
                                                </Badge>
                                                <p className="text-xl font-black">{student.progress}%</p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
                                                <MoreVertical className="w-5 h-5" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="analytics">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-black tracking-tight">Class Analytics</h3>
                                    <p className="text-sm text-muted-foreground font-medium">
                                        RL reward trends, attention scores, and comprehension improvement across your class.
                                    </p>
                                </div>
                            </div>
                            <AnalyticsCharts
                                classData={analyticsData}
                                loading={loading}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="intelligence">
                        {intelligenceData.loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                <span className="ml-3 font-bold text-muted-foreground">Analysing student data...</span>
                            </div>
                        ) : intelligenceData.summaries.length === 0 ? (
                            <div className="text-center py-20 space-y-4">
                                <Brain className="w-12 h-12 text-muted-foreground mx-auto" />
                                <p className="text-muted-foreground font-medium">No intelligence data yet.</p>
                                <p className="text-sm text-muted-foreground">Add students to your class roster to generate AI-powered insights.</p>
                                <button
                                    className="mt-4 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
                                    onClick={fetchIntelligence}
                                >
                                    Generate Insights
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* Class-wide alerts */}
                                {intelligenceData.alerts.length > 0 && (
                                    <section>
                                        <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                                            <ShieldAlert className="w-5 h-5 text-amber-500" />
                                            Class Alerts
                                        </h3>
                                        <div className="space-y-3">
                                            {intelligenceData.alerts.map((alert: any, i: number) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.1 }}
                                                    className={`rounded-2xl border p-4 flex gap-4 ${alert.severity === "urgent"
                                                        ? "border-red-400/40 bg-red-500/5"
                                                        : alert.severity === "warning"
                                                            ? "border-amber-400/40 bg-amber-500/5"
                                                            : "border-blue-400/40 bg-blue-500/5"
                                                        }`}
                                                >
                                                    {alert.severity === "urgent" ? (
                                                        <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                                    ) : alert.severity === "warning" ? (
                                                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                                    ) : (
                                                        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="font-bold text-sm">{alert.message}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">{alert.suggested_action}</p>
                                                        {alert.affected_students?.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                {alert.affected_students.map((name: string, j: number) => (
                                                                    <span key={j} className="text-[10px] font-bold px-2 py-0.5 bg-background rounded-lg border border-border">
                                                                        {name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Per-student NL summaries */}
                                <section>
                                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-primary" />
                                        Student Summaries
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {intelligenceData.summaries.map((s: any, i: number) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.08 }}
                                            >
                                                <Card className={`rounded-[28px] border-2 ${s.risk_level === "high"
                                                    ? "border-red-400/40"
                                                    : s.risk_level === "medium"
                                                        ? "border-amber-400/40"
                                                        : "border-green-400/40"
                                                    }`}>
                                                    <CardContent className="p-5 space-y-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black ${s.risk_level === "high"
                                                                ? "bg-red-500/10 text-red-600"
                                                                : s.risk_level === "medium"
                                                                    ? "bg-amber-500/10 text-amber-600"
                                                                    : "bg-green-500/10 text-green-600"
                                                                }`}>
                                                                {s.student_name?.charAt(0) || "?"}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-black text-sm">{s.student_name}</h4>
                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${s.risk_level === "high"
                                                                    ? "bg-red-500/10 text-red-600"
                                                                    : s.risk_level === "medium"
                                                                        ? "bg-amber-500/10 text-amber-600"
                                                                        : "bg-green-500/10 text-green-600"
                                                                    }`}>
                                                                    {s.risk_level} risk
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <p className="text-sm text-muted-foreground leading-relaxed">{s.summary}</p>

                                                        {/* Actionable Recommendations (D6) */}
                                                        {(intelligenceData.recommendations[s.student_name]?.length ?? 0) > 0 && (
                                                            <div>
                                                                <button
                                                                    className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline w-full text-left"
                                                                    onClick={() => setExpandedRec(expandedRec === i ? null : i)}
                                                                    aria-expanded={expandedRec === i}
                                                                >
                                                                    <Brain className="w-3 h-3" />
                                                                    Recommended Actions ({intelligenceData.recommendations[s.student_name].length})
                                                                    <span className="ml-auto font-black">{expandedRec === i ? "▲" : "▼"}</span>
                                                                </button>
                                                                {expandedRec === i && (
                                                                    <div className="mt-2 space-y-2">
                                                                        {intelligenceData.recommendations[s.student_name].map((rec: any, rIdx: number) => (
                                                                            <div
                                                                                key={rIdx}
                                                                                className={`rounded-xl p-3 border text-xs ${rec.priority === "high"
                                                                                    ? "border-red-400/30 bg-red-500/5"
                                                                                    : rec.priority === "medium"
                                                                                        ? "border-amber-400/30 bg-amber-500/5"
                                                                                        : "border-green-400/30 bg-green-500/5"
                                                                                    }`}
                                                                            >
                                                                                <div className="flex items-start gap-1.5">
                                                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md flex-shrink-0 ${rec.priority === "high" ? "bg-red-500/15 text-red-600" :
                                                                                        rec.priority === "medium" ? "bg-amber-500/15 text-amber-600" :
                                                                                            "bg-green-500/15 text-green-600"
                                                                                        }`}>{rec.priority}</span>
                                                                                    <p className="font-bold leading-snug">{rec.action}</p>
                                                                                </div>
                                                                                {rec.rationale && (
                                                                                    <p className="text-muted-foreground mt-1 leading-relaxed">{rec.rationale}</p>
                                                                                )}
                                                                                {rec.expected_impact && (
                                                                                    <p className="mt-1 text-primary font-semibold">📈 {rec.expected_impact}</p>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {s.recommendation && (
                                                            <div className="bg-secondary/40 rounded-xl p-3">
                                                                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Recommended action</p>
                                                                <p className="text-xs leading-relaxed">{s.recommendation}</p>
                                                            </div>
                                                        )}

                                                        {s.strengths?.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {s.strengths.slice(0, 3).map((str: string, j: number) => (
                                                                    <span key={j} className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-700 rounded-lg">
                                                                        <CheckCircle2 className="w-2.5 h-2.5 inline mr-1" />
                                                                        {str}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        ))}
                                    </div>
                                </section>

                                <div className="text-center">
                                    <button
                                        className="text-xs font-bold text-muted-foreground underline"
                                        onClick={fetchIntelligence}
                                    >
                                        Refresh insights
                                    </button>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="content">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {content.map((item, i) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.1 }}
                                >
                                    <Card className="rounded-[32px] border border-border overflow-hidden group">
                                        <div className="h-32 bg-secondary/50 relative overflow-hidden">
                                            {item.imageUrl && (
                                                <img
                                                    src={`${API_BASE}${item.imageUrl}`}
                                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all"
                                                    alt={item.title}
                                                />
                                            )}
                                            <div className="absolute top-3 left-3">
                                                <Badge className="rounded-lg font-black text-[10px] uppercase bg-background/80 backdrop-blur-md text-foreground border-none">
                                                    {item.subject}
                                                </Badge>
                                            </div>
                                        </div>
                                        <CardContent className="p-5 space-y-3">
                                            <h4 className="font-bold line-clamp-1">{item.title}</h4>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground">
                                                    {new Date(item.createdAt).toLocaleDateString()}
                                                </span>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                                                        onClick={async () => {
                                                            if (!window.confirm("Delete this lesson?")) return;
                                                            try {
                                                                const idToken = await user?.getIdToken();
                                                                await fetch(`${API_BASE}/api/literature/${item.id}`, {
                                                                    method: "DELETE",
                                                                    headers: { "Authorization": `Bearer ${idToken}` }
                                                                });
                                                                setContent(prev => prev.filter(c => c.id !== item.id));
                                                                toast({ title: "Deleted", description: "Lesson removed." });
                                                            } catch (err) {
                                                                toast({ title: "Delete Failed", variant: "destructive" });
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="h-8 rounded-xl font-bold text-xs"
                                                        onClick={() => window.location.href = `/student/reader/${item.id}`}
                                                    >
                                                        Preview
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                            <button
                                onClick={() => window.location.href = '/teacher/create'}
                                className="rounded-[32px] border-2 border-dashed border-border h-[200px] flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary"
                            >
                                <Plus className="w-8 h-8" />
                                <span className="font-bold text-sm">Upload New</span>
                            </button>
                        </div>
                    </TabsContent>
                </Tabs>

            </div>
        </DashboardLayout>
    );
};

export default TeacherDashboard;
