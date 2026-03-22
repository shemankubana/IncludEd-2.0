import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Play, CheckCircle, AlertCircle, RefreshCw, X, Award, BarChart3, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

const AI_URL = import.meta.env.VITE_AI_URL || "http://localhost:8000";

interface AssessmentResults {
    accuracy: number;
    wpm: number;
    total_words: number;
    correct_words: number;
    missed_words: string[];
    mispronounced_words: Array<{ expected: string; spoken: string }>;
    fluency_score: number;
    feedback: string;
}

interface ReadingAssessmentProps {
    expectedText: string;
    studentId?: string;
    bookId?: string;
    sessionId?: string | null;
    idToken?: string | null;
    onClose: () => void;
}

const ReadingAssessment: React.FC<ReadingAssessmentProps> = ({
    expectedText,
    studentId,
    bookId,
    sessionId,
    idToken,
    onClose,
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<AssessmentResults | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);

    // Initialize Web Speech API
    useEffect(() => {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (!SpeechRecognition) {
            setError("Your browser does not support Speech Recognition. Please try Chrome.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US"; // Default, could be dynamic

        recognition.onresult = (event: any) => {
            let currentTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                currentTranscript += event.results[i][0].transcript;
            }
            setTranscript(currentTranscript);
        };

        recognition.onend = () => {
            if (isRecording) {
                recognition.start(); // Keep going if it times out
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech Recognition Error:", event.error);
            if (event.error === 'not-allowed') {
                setError("Microphone access denied.");
                setIsRecording(false);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const toggleRecording = () => {
        if (!recognitionRef.current) return;

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            setTranscript("");
            setResults(null);
            setError(null);
            startTimeRef.current = Date.now();
            recognitionRef.current.start();
            setIsRecording(true);
        }
    };

    const assessReading = async () => {
        if (!transcript || transcript.split(/\s+/).length < 2) {
            setError("Please read at least a few words.");
            return;
        }

        setLoading(true);
        setIsRecording(false);
        if (recognitionRef.current) recognitionRef.current.stop();

        const duration = (Date.now() - startTimeRef.current) / 1000;

        try {
            const response = await fetch(`${AI_URL}/stt/assess`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    expected_text: expectedText,
                    spoken_text: transcript,
                    duration_seconds: duration,
                    student_id: studentId,
                    book_id: bookId,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setResults(data);

                // Report to Node.js backend if we have a session
                if (sessionId) {
                    try {
                        await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/sessions/${sessionId}`, {
                            method: "PATCH",
                            headers: { 
                                "Content-Type": "application/json",
                                ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
                            },
                            body: JSON.stringify({
                                readingAccuracy: data.accuracy,
                                readingScore: data.fluency_score,
                                status: 'active' // Keep session active
                            }),
                        });
                    } catch (e) {
                        console.error("Failed to report reading score to backend", e);
                    }
                }
            } else {
                setError("Failed to analyze reading. Please try again.");
            }
        } catch (err) {
            setError("Connection error. Check if the AI service is running.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-2xl bg-card border-2 border-primary/20 rounded-[40px] shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/20 rounded-xl">
                            <Mic className="text-primary w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black tracking-tight">Reading Assessment</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-8 space-y-6">
                    {!results ? (
                        <>
                            {/* Text to Read */}
                            <div className="space-y-3">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                                    Read this aloud:
                                </p>
                                <div className="p-6 bg-secondary/20 rounded-3xl border-2 border-border/50 leading-relaxed text-lg font-bold">
                                    {expectedText}
                                </div>
                            </div>

                            {/* Transcription Box */}
                            <div className="space-y-3">
                                <p className="text-xs font-black uppercase tracking-widest text-primary ml-1">
                                    {isRecording ? "Listening..." : "Transcript will appear here:"}
                                </p>
                                <div className={`p-6 rounded-3xl border-2 transition-all min-h-[120px] ${isRecording ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-dashed border-border/50 bg-secondary/5'}`}>
                                    {transcript || <span className="text-muted-foreground/50 italic">Press the mic to start reading...</span>}
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex flex-col items-center gap-4 pt-4">
                                <Button
                                    size="lg"
                                    onClick={toggleRecording}
                                    className={`h-20 w-20 rounded-full shadow-xl transition-all ${isRecording ? 'bg-rose-500 hover:bg-rose-600 animate-pulse' : 'bg-primary hover:bg-primary/90'}`}
                                >
                                    {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                                </Button>
                                
                                {transcript && !isRecording && (
                                    <Button 
                                        onClick={assessReading} 
                                        disabled={loading}
                                        className="rounded-2xl h-12 px-8 font-black gap-2 shadow-lg"
                                    >
                                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                        Analyze Reading
                                    </Button>
                                )}
                            </div>
                        </>
                    ) : (
                        <AnimatePresence>
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                {/* Feedback Banner */}
                                <div className="p-6 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-3xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Award className="text-emerald-600 w-6 h-6" />
                                        <h3 className="text-lg font-black text-emerald-800 tracking-tight">Well Done!</h3>
                                    </div>
                                    <p className="text-emerald-700/80 font-bold leading-relaxed italic">
                                        "{results.feedback}"
                                    </p>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-3 gap-4">
                                    <Card className="rounded-3xl border-border/50 bg-blue-50/50 shadow-none">
                                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                            <CheckCircle className="w-5 h-5 text-blue-500 mb-1" />
                                            <p className="text-2xl font-black text-blue-700">{results.accuracy}%</p>
                                            <p className="text-[10px] font-black uppercase tracking-tight text-blue-500">Accuracy</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="rounded-3xl border-border/50 bg-amber-50/50 shadow-none">
                                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                            <Clock className="w-5 h-5 text-amber-500 mb-1" />
                                            <p className="text-2xl font-black text-amber-700">{results.wpm}</p>
                                            <p className="text-[10px] font-black uppercase tracking-tight text-amber-500">WPM</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="rounded-3xl border-border/50 bg-purple-50/50 shadow-none">
                                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                            <BarChart3 className="w-5 h-5 text-purple-500 mb-1" />
                                            <p className="text-2xl font-black text-purple-700">{results.fluency_score}</p>
                                            <p className="text-[10px] font-black uppercase tracking-tight text-purple-500">Fluency</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Tricky Words */}
                                {results.mispronounced_words.length > 0 && (
                                    <div className="space-y-3">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                                            Practice these tricky words:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {results.mispronounced_words.map((w, i) => (
                                                <span key={i} className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-sm font-bold">
                                                    {w.expected}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-center pt-4">
                                    <Button onClick={() => setResults(null)} variant="secondary" className="rounded-2xl h-12 px-8 font-black gap-2">
                                        <RefreshCw className="w-4 h-4" /> Try Again
                                    </Button>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    )}

                    {error && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3"
                        >
                            <AlertCircle className="text-rose-500 w-5 h-5 shrink-0" />
                            <p className="text-sm font-bold text-rose-600">{error}</p>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default ReadingAssessment;
