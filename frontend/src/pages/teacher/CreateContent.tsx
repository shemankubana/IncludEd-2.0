import { useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Upload,
    FileText,
    Video,
    Sparkles,
    CheckCircle2,
    Loader2,
    Type,
    Music
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";

const CreateContent = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [activeTab, setActiveTab] = useState<"text" | "video">("text");

    // Form state
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [subject, setSubject] = useState("Literature");
    const [file, setFile] = useState<File | null>(null);
    const [image, setImage] = useState<File | null>(null);
    const [simplifyText, setSimplifyText] = useState(true);
    const [generateAudio, setGenerateAudio] = useState(false);
    const [difficulty, setDifficulty] = useState("beginner");
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [vttContent, setVttContent] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    const handleProcess = async () => {
        if (!title) {
            toast({ title: "Missing Title", description: "Please enter a title for the lesson.", variant: "destructive" });
            return;
        }

        if (activeTab === "text" && !content && !file) {
            toast({ title: "No Content", description: "Please enter text or upload a PDF.", variant: "destructive" });
            return;
        }

        setIsProcessing(true);
        setUploadProgress(10);

        try {
            const idToken = await user?.getIdToken();
            const formData = new FormData();

            if (activeTab === "video") {
                if (!videoFile) return;
                formData.append("file", videoFile);

                const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/video/transcribe`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${idToken}` },
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    setVttContent(data.vtt);
                    setUploadProgress(100);
                    toast({ title: "Transcription Complete", description: "Your video captions are ready." });
                } else {
                    throw new Error("Video transcription failed");
                }
            } else {
                formData.append("title", title);
                formData.append("subject", subject);
                formData.append("language", "english");

                if (file) {
                    formData.append("file", file);
                } else {
                    formData.append("content", content);
                }

                if (image) {
                    formData.append("image", image);
                }

                formData.append("simplifyText", String(simplifyText));
                formData.append("generateAudio", String(generateAudio));
                formData.append("difficulty", difficulty);

                setUploadProgress(40);

                const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/literature/upload`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${idToken}` },
                    body: formData
                });

                setUploadProgress(80);

                if (response.ok) {
                    setUploadProgress(100);
                    toast({ title: "Success!", description: "Lesson generated and added to library." });
                    setTitle("");
                    setContent("");
                    setFile(null);
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to upload content");
                }
            }
        } catch (error: any) {
            toast({ title: "Process Failed", description: error.message, variant: "destructive" });
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
                setUploadProgress(0);
            }, 1000);
        }
    };

    return (
        <DashboardLayout role="teacher">
            <div className="max-w-5xl mx-auto space-y-10 pb-20">

                {/* Header */}
                <section className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tight">AI Content Studio</h1>
                    <p className="text-muted-foreground font-medium">Transform any material into an adaptive, inclusive lesson in seconds.</p>
                </section>

                {/* Studio Selection */}
                <div className="flex gap-4 p-1.5 bg-secondary/50 rounded-2xl w-fit border border-border">
                    <Button
                        variant={activeTab === "text" ? "default" : "ghost"}
                        className="rounded-xl font-bold h-11 px-8 data-[state=active]:shadow-md"
                        onClick={() => setActiveTab("text")}
                    >
                        <FileText className="w-4 h-4 mr-2" /> Lesson Generator
                    </Button>
                    <Button
                        variant={activeTab === "video" ? "default" : "ghost"}
                        className="rounded-xl font-bold h-11 px-8"
                        onClick={() => setActiveTab("video")}
                    >
                        <Video className="w-4 h-4 mr-2" /> Video Studio
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Input Area */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="rounded-[40px] border-2 border-border shadow-xl overflow-hidden">
                            <CardHeader className="p-8 bg-secondary/20 border-b border-border/50">
                                <CardTitle className="text-xl font-bold">
                                    {activeTab === "text" ? "Create Adaptive Lesson" : "Transcribe Video Content"}
                                </CardTitle>
                                <CardDescription>
                                    {activeTab === "text"
                                        ? "Paste text or upload a PDF to generate a multi-level lesson."
                                        : "Upload a video file to generate captions and audio descriptions."}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="p-8 space-y-6">
                                {activeTab === "text" ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Lesson Title</label>
                                                <Input
                                                    value={title}
                                                    onChange={(e) => setTitle(e.target.value)}
                                                    placeholder="e.g. Introduction to Rwandan History"
                                                    className="h-12 rounded-xl border-2"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Subject Category</label>
                                                <select
                                                    value={subject}
                                                    onChange={(e) => setSubject(e.target.value)}
                                                    className="w-full h-12 rounded-xl border-2 px-3 bg-background font-medium focus:border-primary outline-none"
                                                >
                                                    <option>Literature</option>
                                                    <option>Math</option>
                                                    <option>Science</option>
                                                    <option>History</option>
                                                    <option>General</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Difficulty Level */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Content Difficulty</label>
                                            <div className="grid grid-cols-3 gap-3">
                                                {["beginner", "intermediate", "advanced"].map((level) => (
                                                    <button
                                                        key={level}
                                                        type="button"
                                                        onClick={() => setDifficulty(level)}
                                                        className={`h-11 rounded-xl border-2 font-bold text-xs uppercase tracking-wider transition-all capitalize ${difficulty === level ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}
                                                    >
                                                        {level === "beginner" ? "🌱 Beginner" : level === "intermediate" ? "🔥 Intermediate" : "⚡ Advanced"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Source Content</label>
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                                >
                                                    <Upload className="w-3 h-3" /> {file ? file.name : "Or upload PDF"}
                                                </button>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                                    className="hidden"
                                                    accept=".pdf"
                                                />
                                            </div>
                                            <Textarea
                                                value={content}
                                                onChange={(e) => setContent(e.target.value)}
                                                placeholder="Paste your source material here..."
                                                className="min-h-[250px] rounded-2xl border-2 p-6 leading-relaxed"
                                                disabled={!!file}
                                            />
                                            {file && (
                                                <p className="text-xs font-medium text-muted-foreground">
                                                    PDF selected: <span className="text-primary">{file.name}</span>. Content field disabled.
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2 pt-4 border-t border-border/50">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cover Image (Optional)</label>
                                            <div
                                                onClick={() => imageInputRef.current?.click()}
                                                className="h-24 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-center gap-3 overflow-hidden"
                                            >
                                                {image ? (
                                                    <div className="flex items-center gap-3 p-4 w-full">
                                                        <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                                                            <Upload className="w-6 h-6 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold truncate">{image.name}</p>
                                                            <p className="text-[10px] text-muted-foreground uppercase font-black">Click to change cover</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center">
                                                        <p className="font-bold text-sm">Select Lesson Cover</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-black">JPG, PNG, WebP</p>
                                                    </div>
                                                )}
                                                <input
                                                    type="file"
                                                    ref={imageInputRef}
                                                    onChange={(e) => setImage(e.target.files?.[0] || null)}
                                                    className="hidden"
                                                    accept="image/*"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div
                                            onClick={() => videoInputRef.current?.click()}
                                            className="border-4 border-dashed border-border rounded-[32px] p-16 flex flex-col items-center justify-center text-center space-y-4 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
                                        >
                                            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:scale-110 group-hover:text-primary transition-all">
                                                <Video className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-lg">{videoFile ? videoFile.name : "Drop your video here"}</p>
                                                <p className="text-sm text-muted-foreground">MP4, MOV up to 100MB</p>
                                            </div>
                                            <Button variant="outline" className="rounded-xl font-bold h-10 px-6">Select File</Button>
                                            <input
                                                type="file"
                                                ref={videoInputRef}
                                                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                                                className="hidden"
                                                accept="video/*,audio/*"
                                            />
                                        </div>

                                        {vttContent && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Generated Captions (WebVTT)</label>
                                                <Textarea
                                                    value={vttContent}
                                                    readOnly
                                                    className="min-h-[200px] rounded-2xl border-2 p-6 font-mono text-xs leading-relaxed bg-secondary/20"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isProcessing && (
                                    <div className="space-y-4 pt-4">
                                        <div className="flex justify-between text-xs font-black uppercase tracking-widest text-primary">
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                {activeTab === "text" ? "Adapting Text..." : "Transcribing Video..."}
                                            </span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <Progress value={uploadProgress} className="h-2 rounded-full bg-secondary" />
                                    </div>
                                )}

                                {!isProcessing && (
                                    <Button
                                        className="w-full rounded-2xl h-14 text-lg font-black gap-2 shadow-xl glow-lime"
                                        onClick={handleProcess}
                                    >
                                        <Sparkles className="w-5 h-5 fill-current" />
                                        {activeTab === "text" ? "Generate Adaptive Lesson" : "Start Transcription"}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar Options */}
                    <div className="space-y-6">
                        <Card className="rounded-[32px] border border-border bg-secondary/30 p-2 shadow-none h-fit">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">AI Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div
                                    className={`p-4 rounded-2xl bg-background border flex items-center justify-between group cursor-pointer transition-colors ${simplifyText ? 'border-primary' : 'border-border hover:border-primary/50'}`}
                                    onClick={() => setSimplifyText(!simplifyText)}
                                >
                                    <div className="flex items-center gap-3">
                                        <Type className={`w-4 h-4 ${simplifyText ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                                        <span className={`text-sm font-bold ${simplifyText ? 'text-foreground' : 'text-muted-foreground'}`}>Simplify Text</span>
                                    </div>
                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${simplifyText ? 'bg-primary' : 'bg-primary/20'}`}>
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${simplifyText ? 'right-0.5' : 'left-0.5'}`} />
                                    </div>
                                </div>
                                <div
                                    className={`p-4 rounded-2xl bg-background border flex items-center justify-between group cursor-pointer transition-colors ${generateAudio ? 'border-primary' : 'border-border hover:border-primary/50'}`}
                                    onClick={() => setGenerateAudio(!generateAudio)}
                                >
                                    <div className="flex items-center gap-3">
                                        <Music className={`w-4 h-4 ${generateAudio ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                                        <span className={`text-sm font-bold ${generateAudio ? 'text-foreground' : 'text-muted-foreground'}`}>Generate Audio</span>
                                    </div>
                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${generateAudio ? 'bg-primary' : 'bg-primary/20'}`}>
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${generateAudio ? 'right-0.5' : 'left-0.5'}`} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="p-8 rounded-[32px] bg-accent text-accent-foreground relative overflow-hidden">
                            <h4 className="font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Pro Tip
                            </h4>
                            <p className="text-sm font-medium leading-relaxed opacity-90">
                                Our AI automatically generates 3 difficulty levels for every text you upload.
                                Students will start at Level 1 and advance as the RL engine learns their pace.
                            </p>
                        </div>
                    </div>

                </div>

            </div>
        </DashboardLayout>
    );
};

export default CreateContent;
