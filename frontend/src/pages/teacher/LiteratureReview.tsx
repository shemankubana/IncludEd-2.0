import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
    ChevronLeft, 
    Save, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    Trash2, 
    Plus, 
    BrainCircuit,
    Sparkles,
    FileText,
    Users,
    Zap
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/lib/api";

const LiteratureReview = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    const [literature, setLiterature] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [publishing, setPublishing] = useState(false);

    const fetchData = async () => {
        if (!user || !id) return;
        try {
            const idToken = await user.getIdToken();
            const [litRes, quizRes] = await Promise.all([
                fetch(`${API_BASE}/api/literature/${id}`, {
                    headers: { Authorization: `Bearer ${idToken}` }
                }),
                fetch(`${API_BASE}/api/quiz/${id}`, {
                    headers: { Authorization: `Bearer ${idToken}` }
                })
            ]);

            if (litRes.ok) setLiterature(await litRes.json());
            if (quizRes.ok) setQuestions(await quizRes.json());
        } catch (err) {
            console.error("Failed to fetch data:", err);
            toast({ title: "Error", description: "Failed to load content for review.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [user, id]);

    const handleUpdateQuestion = async (qId: string, updatedFields: any) => {
        if (!user) return;
        setSaving(qId);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/quiz/${qId}`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}` 
                },
                body: JSON.stringify(updatedFields)
            });

            if (res.ok) {
                setQuestions(prev => prev.map(q => q.id === qId ? { ...q, ...updatedFields } : q));
                toast({ title: "Changes Saved", description: "Question updated successfully." });
            }
        } catch (err) {
            toast({ title: "Save Failed", description: "Could not save changes.", variant: "destructive" });
        } finally {
            setSaving(null);
        }
    };

    const handlePublish = async () => {
        if (!user || !id) return;
        setPublishing(true);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/literature/${id}/publish`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${idToken}` }
            });

            if (res.ok) {
                toast({ title: "Published! 🚀", description: "This lesson is now available to students." });
                navigate("/teacher/my-content");
            }
        } catch (err) {
            toast({ title: "Publish Failed", description: "Could not publish content.", variant: "destructive" });
        } finally {
            setPublishing(false);
        }
    };

    const handleAddQuestion = async () => {
        if (!user || !id) return;
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/quiz/${id}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${idToken}` }
            });

            if (res.ok) {
                const newQuestion = await res.json();
                setQuestions(prev => [...prev, newQuestion]);
                setLiterature(prev => ({
                    ...prev,
                    questionsGenerated: (prev.questionsGenerated || 0) + 1
                }));
                toast({ title: "Question Added", description: "A new question has been created." });
            }
        } catch (err) {
            toast({ title: "Add Failed", description: "Could not add a new question.", variant: "destructive" });
        }
    };

    const handleDeleteQuestion = async (qId: string) => {
        if (!user) return;
        if (!confirm("Are you sure you want to delete this question?")) return;
        
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/quiz/${qId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${idToken}` }
            });

            if (res.ok) {
                setQuestions(prev => prev.filter(q => q.id !== qId));
                setLiterature(prev => ({
                    ...prev,
                    questionsGenerated: Math.max(0, (prev.questionsGenerated || 0) - 1)
                }));
                toast({ title: "Question Deleted", description: "The question has been removed." });
            }
        } catch (err) {
            toast({ title: "Delete Failed", description: "Could not delete the question.", variant: "destructive" });
        }
    };

    if (loading) {
        return (
            <DashboardLayout role="teacher">
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="font-black text-muted-foreground uppercase tracking-widest">Gathering AI Analysis...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-5xl mx-auto space-y-8 pb-32">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <button 
                            onClick={() => navigate("/teacher/my-content")}
                            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back to My Content
                        </button>
                        <h1 className="text-4xl font-black tracking-tight">{literature?.title}</h1>
                        <p className="text-lg text-muted-foreground font-medium">Review AI analysis and fine-tune questions.</p>
                    </div>
                    
                    <Card className="rounded-full border-2 border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-2 pl-6 flex items-center gap-6 shadow-sm">
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Status</p>
                            <p className="font-bold text-sm text-emerald-950 dark:text-emerald-100">Reviewing Analysis</p>
                        </div>
                        <Button 
                            onClick={handlePublish}
                            disabled={publishing}
                            className="rounded-full h-12 px-8 font-black gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-transform hover:scale-105"
                        >
                            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish Now"}
                        </Button>
                    </Card>
                </div>

                {/* Analysis Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="rounded-3xl border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
                        <CardContent className="p-6 space-y-2">
                            <div className="flex items-center gap-2 text-primary">
                                <BrainCircuit className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-widest">Complexity</span>
                            </div>
                            <p className="text-3xl font-black capitalize">{literature?.difficulty || "Medium"}</p>
                            <p className="text-xs text-muted-foreground font-bold">Based on 14 structural metrics</p>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-2 border-violet-500/10 bg-gradient-to-br from-violet-500/5 to-transparent">
                        <CardContent className="p-6 space-y-2">
                            <div className="flex items-center gap-2 text-violet-600">
                                <Sparkles className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-widest">Vocabulary</span>
                            </div>
                            <p className="text-3xl font-black">{literature?.bookBrain?.vocabulary?.length || 0} Terms</p>
                            <p className="text-xs text-muted-foreground font-bold">Identified for simplification</p>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-2 border-blue-500/10 bg-gradient-to-br from-blue-500/5 to-transparent">
                        <CardContent className="p-6 space-y-2">
                            <div className="flex items-center gap-2 text-blue-600">
                                <Users className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-widest">Characters</span>
                            </div>
                            <p className="text-3xl font-black">{literature?.bookBrain?.characters?.length || 0} Entities</p>
                            <p className="text-xs text-muted-foreground font-bold">Mapped relations & origins</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Questions Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b pb-4">
                        <h2 className="text-2xl font-black flex items-center gap-3">
                            <FileText className="w-7 h-7 text-primary" />
                            Quiz Questions
                            <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-xs font-black">
                                {questions.length} TOTAL
                            </Badge>
                        </h2>
                        <Button 
                            variant="outline" 
                            className="rounded-2xl font-bold gap-2"
                            onClick={handleAddQuestion}
                        >
                            <Plus className="w-4 h-4" /> Add Question
                        </Button>
                    </div>

                    <div className="space-y-8">
                        {questions.map((q, idx) => (
                            <motion.div
                                key={q.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                            >
                                <Card className="rounded-[40px] border-2 border-border/60 overflow-hidden hover:border-primary/20 transition-all shadow-sm">
                                    <div className="p-8 space-y-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                    Question {idx + 1} · {q.chapterTitle || "General"}
                                                </span>
                                                <Input 
                                                    className="text-xl font-black border-none px-0 h-auto focus-visible:ring-0 bg-transparent"
                                                    value={q.question}
                                                    onChange={(e) => setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, question: e.target.value } : item))}
                                                    onBlur={() => handleUpdateQuestion(q.id, { question: q.question })}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {saving === q.id && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="rounded-full text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDeleteQuestion(q.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Options Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {q.options.map((opt: string, optIdx: number) => (
                                                <div 
                                                    key={optIdx} 
                                                    className={`relative flex items-center p-4 rounded-3xl border-2 transition-all ${
                                                        Number(q.correctAnswer) === optIdx 
                                                        ? "border-emerald-500/50 bg-emerald-50/50 text-emerald-900" 
                                                        : "border-border/50 bg-secondary/20"
                                                    }`}
                                                >
                                                    <button 
                                                        onClick={() => handleUpdateQuestion(q.id, { correctAnswer: optIdx })}
                                                        className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center transition-all ${
                                                            Number(q.correctAnswer) === optIdx 
                                                            ? "bg-emerald-500 border-emerald-500" 
                                                            : "border-muted-foreground/30 hover:border-primary"
                                                        }`}
                                                    >
                                                        {Number(q.correctAnswer) === optIdx && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                    </button>
                                                    <Input 
                                                        className="border-none p-0 h-auto bg-transparent focus-visible:ring-0 font-bold"
                                                        value={opt}
                                                        onChange={(e) => {
                                                            const newOpts = [...q.options];
                                                            newOpts[optIdx] = e.target.value;
                                                            setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, options: newOpts } : item));
                                                        }}
                                                        onBlur={() => handleUpdateQuestion(q.id, { options: q.options })}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* Explanation */}
                                        <div className="pt-4 border-t border-border/50 flex flex-col gap-2">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                <AlertCircle className="w-3 h-3" /> AI Explanation
                                            </div>
                                            <Textarea 
                                                className="bg-secondary/10 border-none min-h-[80px] rounded-2xl font-medium focus-visible:ring-0 leading-relaxed"
                                                value={q.explanation}
                                                onChange={(e) => setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, explanation: e.target.value } : item))}
                                                onBlur={() => handleUpdateQuestion(q.id, { explanation: q.explanation })}
                                            />
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>

            </div>
        </DashboardLayout>
    );
};

export default LiteratureReview;
