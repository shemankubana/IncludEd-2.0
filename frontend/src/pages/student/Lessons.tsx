import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Filter, BookOpen, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const LessonLibrary = () => {
    const categories = ["All", "Literature", "Science", "Math", "History"];

    const lessons = [
        {
            id: 1,
            title: "The Old Man and the Sea",
            subject: "Literature",
            duration: "45m",
            difficulty: "Advanced",
            rating: 4.8,
            image: "bg-amber/10 text-amber",
            xp: 500
        },
        {
            id: 2,
            title: "Introduction to Photosynthesis",
            subject: "Science",
            duration: "30m",
            difficulty: "Beginner",
            rating: 4.5,
            image: "bg-cyan/10 text-cyan",
            xp: 350
        },
        {
            id: 3,
            title: "Fractions & Decimals Part 1",
            subject: "Math",
            duration: "25m",
            difficulty: "Intermediate",
            rating: 4.2,
            image: "bg-primary/10 text-primary",
            xp: 400
        },
        {
            id: 4,
            title: "Rwanda's Geography",
            subject: "History",
            duration: "35m",
            difficulty: "Beginner",
            rating: 4.9,
            image: "bg-rose/10 text-rose",
            xp: 450
        },
        {
            id: 5,
            title: "The Great Gatsby: Chapter 1",
            subject: "Literature",
            duration: "50m",
            difficulty: "Advanced",
            rating: 4.7,
            image: "bg-amber/10 text-amber",
            xp: 600
        },
        {
            id: 6,
            title: "Solar System Explorers",
            subject: "Science",
            duration: "20m",
            difficulty: "Beginner",
            rating: 4.6,
            image: "bg-cyan/10 text-cyan",
            xp: 300
        },
    ];

    return (
        <DashboardLayout role="student">
            <div className="max-w-6xl mx-auto space-y-8 pb-20">

                {/* Header & Search */}
                <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-secondary/30 p-8 rounded-[40px] border border-border/50">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Lesson Library</h1>
                        <p className="text-muted-foreground font-medium">Explore over 200 interactive and adaptive lessons.</p>
                    </div>

                    <div className="relative w-full md:w-96 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
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
                            variant={cat === "All" ? "default" : "secondary"}
                            className={`rounded-xl h-10 px-6 font-bold text-xs transition-all ${cat === "All" ? "shadow-lg glow-lime" : "bg-background border border-border"}`}
                        >
                            {cat}
                        </Button>
                    ))}
                </section>

                {/* Lesson Grid */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lessons.map((lesson, idx) => (
                        <motion.div
                            key={lesson.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <Card className="rounded-[32px] border border-border overflow-hidden h-full flex flex-col group hover:scale-[1.02] transition-all cursor-pointer shadow-none hover:shadow-2xl hover:border-primary/20 bg-card/50 backdrop-blur-sm">
                                <div className={`aspect-[4/3] w-full flex items-center justify-center p-8 transition-colors ${lesson.image}`}>
                                    <BookOpen className="w-20 h-20 opacity-40 group-hover:scale-110 transition-transform duration-500" />
                                </div>

                                <CardHeader className="flex-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <Badge variant="secondary" className="rounded-lg font-black text-[10px] uppercase tracking-wider px-2.5 py-1">
                                            {lesson.subject}
                                        </Badge>
                                        <div className="flex items-center gap-1 text-amber text-xs font-bold">
                                            <Star className="w-3.5 h-3.5 fill-current" /> {lesson.rating}
                                        </div>
                                    </div>
                                    <CardTitle className="text-xl font-bold leading-snug group-hover:text-primary transition-colors">
                                        {lesson.title}
                                    </CardTitle>
                                </CardHeader>

                                <CardContent>
                                    <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold">
                                                <Clock className="w-3.5 h-3.5" /> {lesson.duration}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold">
                                                <Star className="w-3.5 h-3.5" /> {lesson.difficulty}
                                            </div>
                                        </div>
                                        <div className="text-sm font-black text-primary">
                                            +{lesson.xp} XP
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </section>

            </div>
        </DashboardLayout>
    );
};

export default LessonLibrary;
