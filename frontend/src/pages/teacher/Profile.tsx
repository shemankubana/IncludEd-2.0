import { motion } from "framer-motion";
import { User, Mail, School, BookOpen, Clock, ShieldCheck, Camera, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const TeacherProfile = () => {
    const { user, profile } = useAuth();
    const [stats, setStats] = useState({ totalLessons: 0, totalQuestions: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const idToken = await user?.getIdToken();
                const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/literature/my-content`, {
                    headers: { "Authorization": `Bearer ${idToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const totalQuestions = data.reduce((acc: number, item: any) => acc + (item.questionsGenerated || 0), 0);
                    setStats({
                        totalLessons: data.length,
                        totalQuestions
                    });
                }
            } catch (err) {
                console.error("Failed to fetch teacher stats:", err);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchStats();
    }, [user]);

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-4xl mx-auto space-y-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h1 className="text-3xl font-black mb-2">Teacher Profile</h1>
                    <p className="text-muted-foreground font-medium">Manage your professional profile and view your impact.</p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Card className="md:col-span-2 rounded-[32px] border-border/50 shadow-xl overflow-hidden bg-card/50 backdrop-blur-xl">
                        <CardHeader className="bg-primary/5 border-b border-border/50 p-8">
                            <div className="flex items-center gap-6">
                                <div className="w-24 h-24 rounded-[32px] bg-white border-4 border-white shadow-2xl flex items-center justify-center overflow-hidden">
                                    {profile?.photoURL ? (
                                        <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                            <User className="w-10 h-10 text-primary" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black">{profile?.fullName || "Teacher"}</h2>
                                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mt-1">
                                        <ShieldCheck className="w-4 h-4" /> Certified Teacher
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Mail className="w-3 h-3" /> Professional Email
                                    </p>
                                    <p className="text-lg font-bold">{profile?.email || user?.email}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <School className="w-3 h-3" /> Associated School
                                    </p>
                                    <p className="text-lg font-bold">{profile?.school?.name || "Loading..."}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Clock className="w-3 h-3" /> Member Since
                                    </p>
                                    <p className="text-lg font-bold">
                                        {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="rounded-[32px] border-none bg-primary shadow-2xl p-8 text-white">
                            <h3 className="font-black text-sm uppercase tracking-widest mb-6 opacity-80">Your Impact</h3>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                            <BookOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black">{stats.totalLessons}</p>
                                            <p className="text-[10px] font-bold uppercase opacity-60">Lessons Created</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                            <Loader2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black">{stats.totalQuestions}</p>
                                            <p className="text-[10px] font-bold uppercase opacity-60">AI Questions</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <div className="p-8 rounded-[32px] border border-dashed border-border flex flex-col items-center justify-center text-center gap-4 bg-secondary/10">
                            <p className="text-xs font-black uppercase tracking-widest">Need Support?</p>
                            <p className="text-sm text-muted-foreground">Contact your school administrator for account changes.</p>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default TeacherProfile;
