/**
 * ReadingAssessment.tsx
 * =====================
 * STT-based reading assessment component.
 *
 * Uses the Web Speech API (SpeechRecognition) to capture student's
 * reading aloud, then sends it to the AI service for assessment.
 *
 * Features:
 *   - Record student reading aloud
 *   - Compare spoken text with expected text
 *   - Show accuracy, WPM, and fluency score
 *   - Highlight missed and mispronounced words
 *   - Provide encouraging feedback
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Play, Square, RotateCcw, Award, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { auth } from "@/lib/firebase";

// Extend Window for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface ReadingAssessmentProps {
    expectedText: string;
    bookId?: string;
    onComplete?: (result: AssessmentResult) => void;
    language?: string;
}

interface AssessmentResult {
    accuracy: number;
    wpm: number;
    total_words: number;
    correct_words: number;
    missed_words: string[];
    mispronounced_words: Array<{ expected: string; spoken: string }>;
    fluency_score: number;
    feedback: string;
}

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8082";

const ReadingAssessment: React.FC<ReadingAssessmentProps> = ({
    expectedText,
    bookId,
    onComplete,
    language = "en",
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [spokenText, setSpokenText] = useState("");
    const [interimText, setInterimText] = useState("");
    const [result, setResult] = useState<AssessmentResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [supported, setSupported] = useState(true);

    const recognitionRef = useRef<any>(null);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval>>();

    useEffect(() => {
        // Check browser support
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSupported(false);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startRecording = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError("Speech recognition is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language === "fr" ? "fr-FR" : "en-US";

        let finalTranscript = "";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + " ";
                } else {
                    interim += transcript;
                }
            }
            setSpokenText(finalTranscript.trim());
            setInterimText(interim);
        };

        recognition.onerror = (event: any) => {
            if (event.error !== "aborted") {
                setError(`Speech recognition error: ${event.error}`);
            }
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        startTimeRef.current = Date.now();
        setIsRecording(true);
        setError(null);
        setResult(null);

        // Timer for duration display
        timerRef.current = setInterval(() => {
            setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
    }, [language]);

    const stopRecording = useCallback(async () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        setIsRecording(false);

        const durationSeconds = (Date.now() - startTimeRef.current) / 1000;
        setDuration(Math.floor(durationSeconds));

        // Send to AI service for assessment
        if (spokenText.trim()) {
            setLoading(true);
            try {
                const studentId = auth.currentUser?.uid;
                const response = await fetch(`${AI_SERVICE_URL}/stt/assess`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        expected_text: expectedText,
                        spoken_text: spokenText,
                        duration_seconds: durationSeconds,
                        student_id: studentId,
                        book_id: bookId,
                    }),
                });

                if (response.ok) {
                    const data: AssessmentResult = await response.json();
                    setResult(data);
                    onComplete?.(data);
                } else {
                    setError("Failed to assess reading. Please try again.");
                }
            } catch (err) {
                setError("Could not connect to assessment service.");
            } finally {
                setLoading(false);
            }
        }
    }, [spokenText, expectedText, bookId, onComplete]);

    const reset = () => {
        setSpokenText("");
        setInterimText("");
        setResult(null);
        setError(null);
        setDuration(0);
    };

    if (!supported) {
        return (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Speech recognition is not available in this browser. Try Chrome or Edge.</span>
                </div>
            </div>
        );
    }

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <div className="space-y-4">
            {/* Recording controls */}
            <div className="flex items-center gap-3">
                {!isRecording ? (
                    <Button
                        onClick={startRecording}
                        className="gap-2"
                        variant="default"
                        disabled={loading}
                    >
                        <Mic className="w-4 h-4" />
                        Read Aloud
                    </Button>
                ) : (
                    <Button
                        onClick={stopRecording}
                        className="gap-2"
                        variant="destructive"
                    >
                        <Square className="w-4 h-4" />
                        Stop ({formatTime(duration)})
                    </Button>
                )}

                {(spokenText || result) && (
                    <Button onClick={reset} variant="outline" size="sm" className="gap-1">
                        <RotateCcw className="w-3 h-3" />
                        Try Again
                    </Button>
                )}

                {isRecording && (
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-3 h-3 rounded-full bg-red-500"
                    />
                )}
            </div>

            {/* Live transcript */}
            {(isRecording || spokenText) && !result && (
                <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-1">What you said:</p>
                    <p className="text-sm text-foreground">
                        {spokenText}
                        {interimText && <span className="text-muted-foreground italic"> {interimText}</span>}
                    </p>
                </div>
            )}

            {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {loading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                    />
                    <span className="text-sm">Analyzing your reading...</span>
                </div>
            )}

            {/* Results */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        {/* Score cards */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 rounded-xl bg-card border border-border text-center">
                                <p className="text-2xl font-black text-primary">{result.accuracy}%</p>
                                <p className="text-[10px] font-medium text-muted-foreground uppercase">Accuracy</p>
                            </div>
                            <div className="p-3 rounded-xl bg-card border border-border text-center">
                                <p className="text-2xl font-black text-primary">{result.wpm}</p>
                                <p className="text-[10px] font-medium text-muted-foreground uppercase">Words/min</p>
                            </div>
                            <div className="p-3 rounded-xl bg-card border border-border text-center">
                                <p className="text-2xl font-black text-primary">{result.fluency_score}</p>
                                <p className="text-[10px] font-medium text-muted-foreground uppercase">Fluency</p>
                            </div>
                        </div>

                        {/* Fluency progress */}
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium">Fluency Score</span>
                                <span className="text-muted-foreground">{result.fluency_score}/100</span>
                            </div>
                            <Progress value={result.fluency_score} className="h-2" />
                        </div>

                        {/* Feedback */}
                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                            <div className="flex items-start gap-2">
                                <Award className="w-4 h-4 text-primary mt-0.5" />
                                <p className="text-sm text-foreground leading-relaxed">{result.feedback}</p>
                            </div>
                        </div>

                        {/* Missed words */}
                        {result.missed_words.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Words to practice:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {result.missed_words.map((word, i) => (
                                        <span key={i} className="px-2 py-0.5 text-xs rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                                            {word}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Mispronounced words */}
                        {result.mispronounced_words.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Pronunciation tips:</p>
                                <div className="space-y-1">
                                    {result.mispronounced_words.map((mp, i) => (
                                        <div key={i} className="text-xs flex gap-2 items-center">
                                            <span className="text-red-600 line-through">{mp.spoken}</span>
                                            <span className="text-muted-foreground">should be</span>
                                            <span className="font-bold text-primary">{mp.expected}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReadingAssessment;
