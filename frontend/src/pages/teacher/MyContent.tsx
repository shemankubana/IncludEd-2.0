import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    BookOpen,
    Trash2,
    Search,
    Plus,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
    BrainCircuit,
    ImageOff,
    FileText,
    RefreshCcw
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { API_BASE, getFileUrl } from "@/lib/api";

const subjectColors: Record<string, string> = {
    Literature: "bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800",
    Math: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
    Science: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800",
    History: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800",
    General: "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800",
};

const StatusBadge = ({ status, questionsGenerated }: { status: string; questionsGenerated: number }) => {
    if (status === "processing") {
        return (
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-500">
                <Clock className="w-3 h-3" /> Analyzing...
            </span>
        );
    }
    if (status === "draft") {
        return (
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-500">
                <FileText className="w-3 h-3" /> Draft · Ready for Review
            </span>
        );
    }
    if (status === "ready") {
        return (
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                <CheckCircle2 className="w-3 h-3" /> Published · {questionsGenerated} Questions
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rose-500">
            <AlertCircle className="w-3 h-3" /> Error
        </span>
    );
};

const MyContent = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    const [content, setContent] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [reprocessingId, setReprocessingId] = useState<string | null>(null);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [publishingId, setPublishingId] = useState<string | null>(null);

    const handleReprocess = async (id: string) => {
        if (!user) return;
        setReprocessingId(id);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/literature/${id}/reprocess`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` }
            });

            if (res.ok) {
                const data = await res.json();
                toast({
                    title: "Analysis Complete",
                    description: `Detected as ${data.contentType} with ${data.sectionCount} sections.`,
                });
                // Refresh content list
                const refreshedRes = await fetch(`${API_BASE}/api/literature/my-content`, {
                    headers: { "Authorization": `Bearer ${idToken}` }
                });
                if (refreshedRes.ok) setContent(await refreshedRes.json());
            } else {
                throw new Error("Failed to re-process");
            }
        } catch (err) {
            toast({
                title: "Analysis Failed",
                description: "Could not analyze this content. Please try again.",
                variant: "destructive"
            });
        } finally {
            setReprocessingId(null);
        }
    };

    const handleAIAnalyze = async (id: string, title: string) => {
        if (!user) return;
        setAnalyzingId(id);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/literature/${id}/analyze`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` }
            });

            if (res.ok) {
                const data = await res.json();
                toast({
                    title: "AI Analysis Complete",
                    description: `Extracted ${data.characterCount} characters and ${data.vocabCount} key terms from "${title}".`,
                });
                fetchContent();
            } else {
                throw new Error("Analysis failed");
            }
        } catch (err) {
            toast({
                title: "AI Analysis Failed",
                description: "The AI service is unavailable or the book is too short for analysis.",
                variant: "destructive"
            });
        } finally {
            setAnalyzingId(null);
        }
    };

    const API = API_BASE;

    const fetchContent = async () => {
        if (!user) return;
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`${API}/api/literature/my-content`, {
                headers: { Authorization: `Bearer ${idToken}` }
            });
            const data = await res.json();
            setContent(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to load content:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchContent(); }, [user]);

    const handleDelete = async (id: string) => {
        if (!user) return;
        setDeletingId(id);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`${API}/api/literature/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${idToken}` }
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setContent(prev => prev.filter(c => c.id !== id));
            toast({ title: "Deleted", description: "Content and its quiz questions have been removed." });
        } catch (err: any) {
            toast({ title: "Delete failed", description: err.message, variant: "destructive" });
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    };

    const handlePublish = async (id: string) => {
        if (!user) return;
        setPublishingId(id);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`${API}/api/literature/${id}/publish`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${idToken}` }
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setContent(prev => prev.map(c => c.id === id ? { ...c, status: 'ready' } : c));
            toast({ title: "Published!", description: "Students can now see this lesson in their library." });
        } catch (err: any) {
            toast({ title: "Publish failed", description: err.message, variant: "destructive" });
        } finally {
            setPublishingId(null);
        }
    };

    const filtered = content.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.author.toLowerCase().includes(search.toLowerCase()) ||
        c.subject?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">My Content</h1>
                        <p className="text-muted-foreground font-medium mt-1">
                            {content.length} lesson{content.length !== 1 ? "s" : ""} uploaded
                        </p>
                    </div>
                    <Button
                        className="rounded-2xl font-bold gap-2 h-12 px-6 shadow-lg"
                        onClick={() => navigate("/teacher/create")}
                    >
                        <Plus className="w-5 h-5" /> Upload New Content
                    </Button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by title, author, or subject..."
                        className="pl-11 h-12 rounded-2xl border-2 text-base"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {/* Content List */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="font-bold text-muted-foreground text-sm uppercase tracking-widest">Loading your content...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-secondary/50 flex items-center justify-center">
                            <FileText className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-black">
                            {search ? "No results found" : "No content uploaded yet"}
                        </h3>
                        <p className="text-muted-foreground text-sm max-w-xs">
                            {search ? "Try a different search term." : "Upload your first PDF or text lesson using the button above."}
                        </p>
                        {!search && (
                            <Button className="rounded-2xl mt-2 gap-2" onClick={() => navigate("/teacher/create")}>
                                <Plus className="w-4 h-4" /> Upload Content
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        <AnimatePresence>
                            {filtered.map((item, idx) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <Card className="rounded-[28px] border-2 border-border overflow-hidden hover:border-primary/30 hover:shadow-xl transition-all duration-300 group">
                                        {/* Cover Image */}
                                        <div className="relative h-40 bg-gradient-to-br from-secondary/80 to-secondary/30 overflow-hidden">
                                            {item.imageUrl ? (
                                                <img
                                                    src={getFileUrl(item.imageUrl)}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <BookOpen className="w-14 h-14 text-muted-foreground/30" />
                                                </div>
                                            )}
                                            {/* Subject badge overlay */}
                                            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                                                <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border w-fit ${subjectColors[item.subject] || subjectColors.General}`}>
                                                    {item.subject || "General"}
                                                </span>
                                                {item.contentType && item.contentType !== 'generic' && (
                                                    <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-black/60 text-white backdrop-blur-sm w-fit border border-white/20">
                                                        {item.contentType === 'play' ? "🎭 Play" : "📖 Novel"}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Secondary Actions Overlay */}
                                            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="rounded-xl h-8 w-8 bg-background/80 backdrop-blur-md hover:bg-background text-indigo-500 shadow-lg"
                                                    disabled={analyzingId === item.id}
                                                    onClick={(e) => { e.stopPropagation(); handleAIAnalyze(item.id, item.title); }}
                                                    title="Deep AI Analysis"
                                                >
                                                    <BrainCircuit className={`w-3.5 h-3.5 ${analyzingId === item.id ? "animate-spin" : ""}`} />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="rounded-xl h-8 w-8 bg-background/80 backdrop-blur-md hover:bg-background text-muted-foreground shadow-lg"
                                                    disabled={reprocessingId === item.id}
                                                    onClick={(e) => { e.stopPropagation(); handleReprocess(item.id); }}
                                                    title="System Reprocess"
                                                >
                                                    <RefreshCcw className={`w-3.5 h-3.5 ${reprocessingId === item.id ? "animate-spin" : ""}`} />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="rounded-xl h-8 w-8 bg-background/80 backdrop-blur-md hover:bg-rose-500 hover:text-white text-rose-500 shadow-lg"
                                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.id); }}
                                                    title="Delete Content"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>

                                        <CardContent className="p-5 space-y-3">
                                            {/* Title & Author */}
                                            <div>
                                                <h3 className="font-black text-base leading-tight line-clamp-2">{item.title}</h3>
                                                <p className="text-sm text-muted-foreground font-medium mt-0.5">{item.author}</p>
                                            </div>

                                            {/* Stats row */}
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground font-semibold">
                                                <span>{item.wordCount?.toLocaleString() || "—"} words</span>
                                                <span>·</span>
                                                <span className="capitalize">{item.language}</span>
                                                <span>·</span>
                                                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                                            </div>

                                            {/* Status */}
                                            <StatusBadge status={item.status} questionsGenerated={item.questionsGenerated} />

                                            {/* Actions */}
                                            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                                                {confirmDeleteId === item.id ? (
                                                    // Confirm delete state
                                                    <div className="flex items-center gap-2 w-full bg-destructive/10 p-2 rounded-2xl border border-destructive/20 mt-1">
                                                        <p className="text-[10px] font-black uppercase tracking-tighter text-destructive flex-1 ml-2">Delete permanently?</p>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            className="rounded-xl h-8 px-3 text-xs font-black shadow-lg shadow-destructive/20"
                                                            disabled={deletingId === item.id}
                                                            onClick={() => handleDelete(item.id)}
                                                        >
                                                            {deletingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="rounded-xl h-8 px-3 text-xs font-bold"
                                                            onClick={() => setConfirmDeleteId(null)}
                                                        >
                                                            No
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    // Normal state - Grid layout for primary buttons
                                                    <div className="flex gap-2 w-full">
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            className="rounded-2xl h-10 px-4 font-bold text-xs flex-1 border border-border/50 hover:border-primary/30 transition-all"
                                                            onClick={() => navigate(`/student/reader/${item.id}`)}
                                                            disabled={item.status === 'processing'}
                                                        >
                                                            <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Preview
                                                        </Button>
                                                        {item.status === 'draft' && (
                                                            <Button
                                                                size="sm"
                                                                className="rounded-2xl h-10 px-4 font-black text-xs flex-1 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
                                                                disabled={publishingId === item.id}
                                                                onClick={() => handlePublish(item.id)}
                                                            >
                                                                {publishingId === item.id
                                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                                                                Publish
                                                            </Button>
                                                        )}
                                                        {(item.status === 'draft' || item.status === 'ready') && (
                                                            <Button
                                                                size="sm"
                                                                className={`rounded-2xl h-10 px-4 font-black text-xs shadow-sm transition-all ${
                                                                    item.status === 'draft'
                                                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white flex-1'
                                                                }`}
                                                                onClick={() => navigate(`/teacher/review/${item.id}`)}
                                                            >
                                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                                                {item.status === 'draft' ? 'Review' : 'Questions'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

            </div>
        </DashboardLayout>
    );
};

export default MyContent;
