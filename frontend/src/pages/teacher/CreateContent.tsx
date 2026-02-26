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

const CreateContent = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [activeTab, setActiveTab] = useState<"text" | "video">("text");

    const handleProcess = () => {
        setIsProcessing(true);
        let p = 0;
        const interval = setInterval(() => {
            p += 5;
            setUploadProgress(p);
            if (p >= 100) {
                clearInterval(interval);
                setIsProcessing(false);
            }
        }, 100);
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
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Lesson Title</label>
                                            <Input placeholder="e.g. Introduction to Rwandan History" className="h-12 rounded-xl border-2" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Source Content</label>
                                            <Textarea
                                                placeholder="Paste your source material here..."
                                                className="min-h-[250px] rounded-2xl border-2 p-6 leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border-4 border-dashed border-border rounded-[32px] p-20 flex flex-col items-center justify-center text-center space-y-4 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group">
                                        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:scale-110 group-hover:text-primary transition-all">
                                            <Upload className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-lg">Drop your video here</p>
                                            <p className="text-sm text-muted-foreground">MP4, MOV up to 100MB</p>
                                        </div>
                                        <Button variant="outline" className="rounded-xl font-bold h-10 px-6">Select File</Button>
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
                                <div className="p-4 rounded-2xl bg-background border border-border flex items-center justify-between group cursor-pointer hover:border-primary/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Type className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                                        <span className="text-sm font-bold">Simplify Text</span>
                                    </div>
                                    <div className="w-10 h-5 rounded-full bg-primary/20 relative cursor-pointer">
                                        <div className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-primary" />
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-background border border-border flex items-center justify-between group cursor-pointer hover:border-primary/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Music className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                                        <span className="text-sm font-bold">Generate Audio</span>
                                    </div>
                                    <div className="w-10 h-5 rounded-full bg-secondary relative cursor-pointer">
                                        <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-muted-foreground opacity-30" />
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
