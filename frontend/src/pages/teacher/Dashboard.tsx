import { motion } from "framer-motion";
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
    Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const TeacherDashboard = () => {
    const stats = [
        { label: "Active Students", value: "28", icon: <Users className="w-5 h-5" />, trend: "+2 this week" },
        { label: "Average Progress", value: "72%", icon: <TrendingUp className="w-5 h-5" />, trend: "+5% vs last month" },
        { label: "Needs Support", value: "4", icon: <AlertCircle className="w-5 h-5 text-rose-500" />, trend: "Focus on these students" },
        { label: "Lessons Created", value: "15", icon: <FileText className="w-5 h-5" />, trend: "3 awaiting review" },
    ];

    const students = [
        { name: "John Doe", lastActive: "2h ago", progress: 85, status: "Expanding", color: "bg-primary" },
        { name: "Sarah Smith", lastActive: "5h ago", progress: 40, status: "Needs Support", color: "bg-rose-500" },
        { name: "Alice Gisa", lastActive: "1d ago", progress: 92, status: "Mastered", color: "bg-accent" },
        { name: "Bob Nduu", lastActive: "3h ago", progress: 65, status: "On Track", color: "bg-primary" },
    ];

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-7xl mx-auto space-y-10 pb-20">

                {/* Welcome Header */}
                <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black tracking-tight">Teacher Overview</h1>
                        <p className="text-muted-foreground font-medium">Monitoring Primary 4 - Class A performance.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="rounded-xl font-bold h-11 px-6">Export Reports</Button>
                        <Button className="rounded-xl font-bold h-11 px-6 shadow-lg glow-lime">Generate Content</Button>
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
                </Tabs>

            </div>
        </DashboardLayout>
    );
};

export default TeacherDashboard;
