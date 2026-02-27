import { useState, useEffect } from "react";
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
    Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";

const TeacherDashboard = () => {
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [content, setContent] = useState<any[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [isInviting, setIsInviting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!user) return;
            try {
                const idToken = await user.getIdToken();
                const headers = { "Authorization": `Bearer ${idToken}` };
                const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

                const response = await fetch(`${baseUrl}/api/analytics/class`, { headers });
                const data = await response.json();

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

    const handleInvite = async () => {
        if (!inviteEmail) return;
        setIsInviting(true);
        try {
            const idToken = await user?.getIdToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/schools/invite`, {
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
                            <TabsTrigger value="students" className="rounded-xl font-black text-sm px-8 data-[state=active]:bg-background data-[state=active]:shadow-lg">Student Roster</TabsTrigger>
                            <TabsTrigger value="analytics" className="rounded-xl font-black text-sm px-8 data-[state=active]:bg-background data-[state=active]:shadow-lg">Class Analytics</TabsTrigger>
                            <TabsTrigger value="content" className="rounded-xl font-black text-sm px-8 data-[state=active]:bg-background data-[state=active]:shadow-lg">My Content</TabsTrigger>
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
                        <Card className="rounded-[48px] border-2 border-dashed border-border p-20 bg-secondary/10 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-20 h-20 rounded-3xl bg-background border border-border flex items-center justify-center shadow-xl mb-4">
                                <TrendingUp className="w-10 h-10 text-primary" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black tracking-tight">Performance Deep-Dive</h3>
                                <p className="text-muted-foreground font-medium max-w-sm">
                                    We're calibrating the RL Engine visuals. Charts showing student mastery over time will appear here.
                                </p>
                            </div>
                            <Button className="rounded-2xl font-bold h-12 px-8">Upgrade Analytics View</Button>
                        </Card>
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
                                                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${item.imageUrl}`}
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
                                                                await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/literature/${item.id}`, {
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
