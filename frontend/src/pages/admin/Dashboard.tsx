import { motion } from "framer-motion";
import { Users, UserCheck, ShieldCheck, GraduationCap, School } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const AdminDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ totalStudents: 0, totalTeachers: 0, pendingTeachers: 0 });
    const [loading, setLoading] = useState(true);
    const [school, setSchool] = useState<any>(null);

    useEffect(() => {
        const fetchAdminData = async () => {
            try {
                const idToken = await user?.getIdToken();
                const [statsRes, schoolRes] = await Promise.all([
                    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/admin/stats`, {
                        headers: { "Authorization": `Bearer ${idToken}` }
                    }),
                    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/schools/mine`, {
                        headers: { "Authorization": `Bearer ${idToken}` }
                    })
                ]);

                if (statsRes.ok) setStats(await statsRes.json());
                if (schoolRes.ok) setSchool(await schoolRes.json());
            } catch (err) {
                console.error("Failed to fetch admin stats:", err);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchAdminData();
    }, [user]);

    const cards = [
        { title: "Total Students", value: stats.totalStudents, icon: GraduationCap, color: "bg-blue-500" },
        { title: "Active Teachers", value: stats.totalTeachers, icon: UserCheck, color: "bg-green-500" },
        { title: "Pending Approval", value: stats.pendingTeachers, icon: ShieldCheck, color: stats.pendingTeachers > 0 ? "bg-amber-500" : "bg-slate-400" },
    ];

    return (
        <DashboardLayout role="admin">
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-black mb-2">School Administration</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <School className="w-4 h-4" />
                        <span className="font-bold">{school?.name || "Loading School..."}</span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">
                            Code: {school?.code}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {cards.map((card, i) => (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all group overflow-hidden">
                                <div className={`absolute top-0 right-0 w-24 h-24 ${card.color} opacity-5 -mr-8 -mt-8 rounded-full group-hover:scale-110 transition-transform`} />
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                        {card.title}
                                    </CardTitle>
                                    <card.icon className={`w-4 h-4 ${card.color.replace('bg-', 'text-')}`} />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-4xl font-black">{loading ? "..." : card.value}</div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {stats.pendingTeachers > 0 && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black">Teacher Approvals Needed</h3>
                                <p className="text-sm text-muted-foreground">There are {stats.pendingTeachers} teachers waiting for activation.</p>
                            </div>
                        </div>
                        <a href="/admin/users?role=teacher&status=pending_approval">
                            <Button variant="default" className="bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl h-11 px-6">
                                Review Now
                            </Button>
                        </a>
                    </motion.div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default AdminDashboard;
