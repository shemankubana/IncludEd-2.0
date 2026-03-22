/**
 * AnalyticsCharts.tsx
 * ====================
 * Teacher-facing analytics visualisations built on Recharts.
 * Uses real student roster data for all charts.
 */

import React from "react";
import {
    BarChart, Bar, RadialBarChart, RadialBar,
    PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Mic, BookOpen, Users } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────────

interface StudentRosterEntry {
    id: string;
    name: string;
    progress: number;
    readingAccuracy: number;
    status: string;
    lastActive: string;
}

interface AnalyticsData {
    overview: {
        totalStudents: number;
        totalSessions: number;
        completedSessions: number;
        avgQuizScore: string;
        avgAttention: string;
        avgCompletion: string;
        avgReadingAccuracy: string;
    };
    byDisabilityType: any[];
    students?: StudentRosterEntry[];
    recentSessions: any[];
}

interface AnalyticsChartsProps {
    classData: AnalyticsData | null;
    studentData?: any | null;
    loading?: boolean;
}

// ── Colours ─────────────────────────────────────────────────────────────────────

const PALETTE = {
    primary: "#4F46E5",
    emerald: "#059669",
    amber:   "#D97706",
    rose:    "#E11D48",
    cyan:    "#0891B2",
    slate:   "#64748B",
};

const STATUS_COLOR: Record<string, string> = {
    Mastered:  PALETTE.emerald,
    "On Track": PALETTE.cyan,
    Starting:  PALETTE.amber,
    "Needs Support": PALETTE.rose,
};

// ── Custom Tooltip ───────────────────────────────────────────────────────────────

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-sm">
            <p className="font-black text-foreground mb-1">{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ color: p.color || p.fill }} className="font-bold">
                    {p.name}: {typeof p.value === "number" ? `${p.value}%` : p.value}
                </p>
            ))}
        </div>
    );
};

// ── Chart 1: Student Progress Overview ──────────────────────────────────────────

const StudentProgressChart: React.FC<{ students: StudentRosterEntry[] }> = ({ students }) => {
    const data = students.slice(0, 12).map(s => ({
        name: s.name.split(" ")[0], // first name only for space
        progress: s.progress,
        fill: STATUS_COLOR[s.status] || PALETTE.slate,
    }));

    return (
        <Card className="rounded-[24px] border-border/50">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm font-black">Student Progress</CardTitle>
                </div>
                <CardDescription className="text-xs">Reading completion % per student</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="progress" name="Progress" radius={[6, 6, 0, 0]}>
                            {data.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(STATUS_COLOR).map(([status, color]) => (
                        <div key={status} className="flex items-center gap-1 text-[10px] font-bold">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                            {status}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

// ── Chart 2: Reading Accuracy Distribution ───────────────────────────────────────

const ReadingAccuracyChart: React.FC<{ students: StudentRosterEntry[] }> = ({ students }) => {
    // Bucket students into accuracy ranges
    const withAccuracy = students.filter(s => s.readingAccuracy > 0);

    const buckets = [
        { range: "0–40%", min: 0, max: 40, color: PALETTE.rose },
        { range: "41–60%", min: 41, max: 60, color: PALETTE.amber },
        { range: "61–80%", min: 61, max: 80, color: PALETTE.cyan },
        { range: "81–100%", min: 81, max: 100, color: PALETTE.emerald },
    ];

    const data = buckets.map(b => ({
        range: b.range,
        count: withAccuracy.filter(s => s.readingAccuracy >= b.min && s.readingAccuracy <= b.max).length,
        fill: b.color,
    }));

    const neverPracticed = students.length - withAccuracy.length;

    return (
        <Card className="rounded-[24px] border-border/50">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-emerald-500" />
                    <CardTitle className="text-sm font-black">Reading Accuracy Distribution</CardTitle>
                </div>
                <CardDescription className="text-xs">Students grouped by STT accuracy score</CardDescription>
            </CardHeader>
            <CardContent>
                {withAccuracy.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                        <Mic className="w-10 h-10 opacity-30" />
                        <p className="text-xs font-bold text-center">
                            No reading practice data yet.<br />Students haven't used the microphone feature.
                        </p>
                    </div>
                ) : (
                    <>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} label={{ value: "Students", angle: -90, position: "insideLeft", fontSize: 9, offset: 15 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]}>
                                    {data.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        {neverPracticed > 0 && (
                            <p className="text-[10px] text-muted-foreground font-bold mt-1">
                                + {neverPracticed} student{neverPracticed > 1 ? "s" : ""} haven't used reading practice yet
                            </p>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
};

// ── Chart 3: Progress vs Reading Accuracy scatter (as grouped bar) ────────────────

const ProgressVsReadingChart: React.FC<{ students: StudentRosterEntry[] }> = ({ students }) => {
    const data = students.slice(0, 10).map(s => ({
        name: s.name.split(" ")[0],
        "Content Progress": s.progress,
        "Reading Accuracy": s.readingAccuracy || 0,
    }));

    return (
        <Card className="rounded-[24px] border-border/50 md:col-span-2">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-500" />
                    <CardTitle className="text-sm font-black">Progress vs Reading Accuracy</CardTitle>
                </div>
                <CardDescription className="text-xs">
                    Comparing content completion against reading fluency per student
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                        <Bar dataKey="Content Progress" fill={PALETTE.primary}  radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Reading Accuracy" fill={PALETTE.emerald} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

// ── Chart 4: Status Distribution Pie ────────────────────────────────────────────

const StatusPieChart: React.FC<{ students: StudentRosterEntry[] }> = ({ students }) => {
    const counts: Record<string, number> = {};
    students.forEach(s => {
        counts[s.status] = (counts[s.status] || 0) + 1;
    });

    const pieData = Object.entries(counts).map(([status, count]) => ({
        name: status,
        value: count,
        fill: STATUS_COLOR[status] || PALETTE.slate,
    }));

    return (
        <Card className="rounded-[24px] border-border/50">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-500" />
                    <CardTitle className="text-sm font-black">Class Status Distribution</CardTitle>
                </div>
                <CardDescription className="text-xs">Students by progress status</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={160}>
                    <PieChart>
                        <Pie
                            data={pieData} cx="50%" cy="50%"
                            innerRadius={45} outerRadius={72}
                            paddingAngle={3} dataKey="value"
                        >
                            {pieData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2">
                    {pieData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-bold">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                            <span>{d.name}</span>
                            <Badge variant="secondary" className="ml-auto text-[9px] font-black px-1.5 py-0.5">{d.value}</Badge>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

// ── Main exported component ────────────────────────────────────────────────────

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
    classData,
    studentData,
    loading = false,
}) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!classData) {
        return (
            <div className="text-center py-12 text-muted-foreground text-sm font-bold">
                No analytics data available yet.
            </div>
        );
    }

    const students: StudentRosterEntry[] = classData.students || [];

    if (students.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground text-sm font-bold">
                No student data yet. Students need to start reading to generate analytics.
            </div>
        );
    }

    const avgProgress = Math.round(students.reduce((a, s) => a + s.progress, 0) / students.length);
    const studentsWithReading = students.filter(s => s.readingAccuracy > 0);
    const avgAccuracy = studentsWithReading.length
        ? Math.round(studentsWithReading.reduce((a, s) => a + s.readingAccuracy, 0) / studentsWithReading.length)
        : 0;

    return (
        <div className="space-y-4">
            {/* Overview summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Avg Completion", value: `${avgProgress}%`, color: "text-primary" },
                    { label: "Avg Reading Acc.", value: avgAccuracy > 0 ? `${avgAccuracy}%` : "N/A", color: "text-emerald-500" },
                    { label: "Total Sessions", value: classData.overview?.totalSessions || 0, color: "text-cyan-500" },
                    { label: "Completed", value: classData.overview?.completedSessions || 0, color: "text-amber-500" },
                ].map((stat, i) => (
                    <Card key={i} className="rounded-2xl border-border/50 p-4">
                        <p className="text-xs font-bold text-muted-foreground">{stat.label}</p>
                        <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                    </Card>
                ))}
            </div>

            {/* Charts grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StudentProgressChart students={students} />
                <StatusPieChart students={students} />
                <ReadingAccuracyChart students={students} />
                <ProgressVsReadingChart students={students} />
            </div>
        </div>
    );
};

export default AnalyticsCharts;
export { StudentProgressChart, ReadingAccuracyChart, StatusPieChart };
