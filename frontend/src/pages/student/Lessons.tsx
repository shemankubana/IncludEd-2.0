import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Search, Filter, BookOpen, Clock, Star, Loader2, ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/api";
import { motion } from "framer-motion";

const difficultyColor: Record<string, string> = {
    beginner: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    intermediate: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    advanced: "bg-rose-500/10 text-rose-700 dark:text-rose-400"
};

const StarRating = ({ lessonId, initialRating, ratingCount, initialUserRating = 0 }: { lessonId: string, initialRating: number, ratingCount: number, initialUserRating?: number }) => {
    const { user } = useAuth();
    const [hover, setHover] = useState(0);
    const [userRating, setUserRating] = useState(initialUserRating);
    const [avg, setAvg] = useState(initialRating);
    const [count, setCount] = useState(ratingCount);
    const [submitting, setSubmitting] = useState(false);

    const submitRating = async (stars: number) => {
        if (!user || submitting) return;
        setSubmitting(true);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/progress/${lessonId}/rate`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
                body: JSON.stringify({ rating: stars })
            });
            if (res.ok) {
                const isNewRating = userRating === 0;
                const newCount = isNewRating ? count + 1 : count;
                const newAvg = isNewRating
                    ? ((avg * count) + stars) / newCount
                    : ((avg * count) - userRating + stars) / count;
                setAvg(parseFloat(newAvg.toFixed(2)));
                setCount(newCount);
                setUserRating(stars);
            }
        } catch (e) { /* silent */ }
        finally { setSubmitting(false); }
    };

    return (
        <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        onClick={(e) => { e.preventDefault(); submitRating(star); }}
                        onMouseEnter={() => setHover(star)}
                        className="transition-transform hover:scale-125 active:scale-110"
                        title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    >
                        <Star
                            className={`w-3.5 h-3.5 transition-colors ${(hover || userRating) >= star ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground"}`}
                        />
                    </button>
                ))}
            </div>
            <span className="text-[10px] font-bold text-muted-foreground">
                {avg > 0 ? `${avg.toFixed(1)} (${count})` : "Rate"}
            </span>
        </div>
    );
};

const LessonLibrary = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lessons, setLessons] = useState<any[]>([]);
    const [progressMap, setProgressMap] = useState<Record<string, { percent: number; status: string; userRating: number }>>({});
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const categories = ["All", "In Progress", "Literature", "Math", "Science", "History", "General"];

    useEffect(() => {
        const fetchLessons = async () => {
            if (!user) return;
            try {
                const idToken = await user.getIdToken();
                const headers = { "Authorization": `Bearer ${idToken}` };
                const baseUrl = API_BASE;

                const [litRes, progressRes] = await Promise.all([
                    fetch(`${baseUrl}/api/literature`, { headers }),
                    fetch(`${baseUrl}/api/progress`, { headers }),
                ]);

                if (litRes.ok) {
                    const data = await litRes.json();
                    if (Array.isArray(data)) {
                        setLessons(data.map((item: any) => ({
                            id: item.id,
                            title: item.title,
                            subject: item.subject || "General",
                            duration: item.estimatedMinutes ? `${item.estimatedMinutes}m` : "—",
                            difficulty: item.difficulty || "beginner",
                            rating: item.averageRating || 0,
                            ratingCount: item.ratingCount || 0,
                            image: item.imageUrl ? `${baseUrl}${item.imageUrl}` : null,
                            xp: 500,
                            totalSections: item.sections?.length || 1,
                        })));
                    }
                }

                if (progressRes.ok) {
                    const progressData = await progressRes.json();
                    const map: Record<string, { percent: number; status: string; userRating: number }> = {};
                    for (const p of progressData) {
                        const litId = p.Literature?.id || p.literatureId;
                        if (!litId) continue;
                        const totalSections = p.Literature?.sections?.length || 1;
                        const completedCount = p.completedSections?.length || 0;
                        const percent = p.status === "completed" ? 100 : Math.round((completedCount / totalSections) * 100);
                        map[litId] = { percent, status: p.status || "in_progress", userRating: p.rating || 0 };
                    }
                    setProgressMap(map);
                }

            } catch (error) {
                console.error("Failed to fetch lessons:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLessons();
    }, [user]);

    const filteredLessons = lessons.filter(l => {
        const matchesCategory =
            selectedCategory === "All" ? true :
            selectedCategory === "In Progress" ? !!progressMap[l.id] :
            l.subject === selectedCategory;
        const matchesSearch = !searchQuery || l.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    if (loading) {
        return (
            <DashboardLayout role="student">
                <div className="h-[60vh] flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="student">
            <div className="max-w-6xl mx-auto space-y-8 pb-20">

                {/* Header & Search */}
                <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-secondary/30 p-8 rounded-[40px] border border-border/50">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Lesson Library</h1>
                        <p className="text-muted-foreground font-medium">
                            {Object.keys(progressMap).length > 0
                                ? `${Object.keys(progressMap).length} course${Object.keys(progressMap).length > 1 ? "s" : ""} in progress`
                                : "Explore interactive and adaptive lessons."}
                        </p>
                    </div>

                    <div className="relative w-full md:w-96 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search for lessons, subjects..."
                            className="pl-12 h-14 rounded-2xl border-2 border-border focus:border-primary transition-all shadow-sm"
                        />
                    </div>
                </section>

                {/* Filters */}
                <section className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                    <div className="flex items-center gap-2 mr-4 text-muted-foreground font-bold text-xs uppercase tracking-widest leading-none">
                        <Filter className="w-4 h-4" /> Filters
                    </div>
                    {categories.map((cat) => (
                        <Button
                            key={cat}
                            variant={selectedCategory === cat ? "default" : "secondary"}
                            onClick={() => setSelectedCategory(cat)}
                            className={`rounded-xl h-10 px-6 font-bold text-xs transition-all ${selectedCategory === cat ? "shadow-lg glow-lime" : "bg-background border border-border"}`}
                        >
                            {cat}
                        </Button>
                    ))}
                </section>

                {/* Lesson Grid */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLessons.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
                            <BookOpen className="w-12 h-12 opacity-30" />
                            <p className="font-bold">No lessons found</p>
                        </div>
                    )}
                    {filteredLessons.map((lesson, idx) => {
                        const prog = progressMap[lesson.id];
                        const isStarted = !!prog;
                        const isCompleted = prog?.status === "completed";

                        return (
                            <motion.div
                                key={lesson.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <Card className={`rounded-[32px] border overflow-hidden h-full flex flex-col group hover:scale-[1.02] transition-all cursor-pointer shadow-none hover:shadow-2xl bg-card/50 backdrop-blur-sm ${isStarted ? "border-primary/30 hover:border-primary/60" : "border-border hover:border-primary/20"}`}>
                                    {/* Thumbnail */}
                                    <div className="aspect-[4/3] w-full flex items-center justify-center relative transition-colors bg-secondary/20 overflow-hidden">
                                        {lesson.image ? (
                                            <img src={lesson.image} alt={lesson.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        ) : (
                                            <BookOpen className="w-20 h-20 opacity-40 group-hover:scale-110 transition-transform duration-500" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-5">
                                            <span className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-1.5">
                                                {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                                                {isCompleted ? "Review" : isStarted ? "Continue" : "Start Reading"}
                                            </span>
                                        </div>
                                        {/* Difficulty badge */}
                                        <div className="absolute top-3 left-3">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${difficultyColor[lesson.difficulty] || difficultyColor.beginner}`}>
                                                {lesson.difficulty}
                                            </span>
                                        </div>
                                        {/* In-progress indicator */}
                                        {isStarted && !isCompleted && (
                                            <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                In Progress
                                            </div>
                                        )}
                                        {isCompleted && (
                                            <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                                <CheckCircle2 className="w-2.5 h-2.5" /> Done
                                            </div>
                                        )}
                                    </div>

                                    <CardHeader className="flex-1 pb-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <Badge variant="secondary" className="rounded-lg font-black text-[10px] uppercase tracking-wider px-2.5 py-1">
                                                {lesson.subject}
                                            </Badge>
                                            <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                                                <Clock className="w-3.5 h-3.5" /> {lesson.duration}
                                            </div>
                                        </div>
                                        <CardTitle className="text-xl font-bold leading-snug group-hover:text-primary transition-colors">
                                            {lesson.title}
                                        </CardTitle>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        {/* Progress bar — only if started */}
                                        {isStarted && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                    <span>{isCompleted ? "Completed" : "Progress"}</span>
                                                    <span className={isCompleted ? "text-emerald-600" : "text-primary"}>{prog.percent}%</span>
                                                </div>
                                                <Progress
                                                    value={prog.percent}
                                                    className={`h-2 rounded-full ${isCompleted ? "[&>div]:bg-emerald-500" : ""}`}
                                                />
                                            </div>
                                        )}

                                        <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-3">
                                            <StarRating lessonId={lesson.id} initialRating={lesson.rating} ratingCount={lesson.ratingCount} initialUserRating={prog?.userRating || 0} />
                                            <div className="text-sm font-black text-primary">+{lesson.xp} XP</div>
                                        </div>

                                        {/* CTA button */}
                                        <Button
                                            onClick={() => navigate(`/student/reader/${lesson.id}`)}
                                            variant={isStarted && !isCompleted ? "default" : "secondary"}
                                            className="w-full rounded-2xl gap-2 font-black uppercase text-xs h-10 tracking-widest"
                                        >
                                            {isCompleted ? (
                                                <><CheckCircle2 className="w-4 h-4" /> Review</>
                                            ) : isStarted ? (
                                                <>Continue <ArrowRight className="w-4 h-4" /></>
                                            ) : (
                                                <>Start Reading <ArrowRight className="w-4 h-4" /></>
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })}
                </section>

            </div>
        </DashboardLayout>
    );
};

export default LessonLibrary;
