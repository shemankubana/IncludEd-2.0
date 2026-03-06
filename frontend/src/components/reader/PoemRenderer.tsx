/**
 * PoemRenderer.tsx
 * ================
 * Full poem rendering mode for IncludEd Reader.
 *
 * Features:
 *   - Centered verse with generous line spacing
 *   - Stanza-level emotional tone gradient background
 *   - Rhyme scheme colour-coding on end words (same label = same colour)
 *   - Line-by-line audio (TTS) via SpeechSynthesis
 *   - Tap any line to "reveal meaning" (calls highlight-to-understand)
 *   - Stanza navigation (previous/next stanza)
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, ChevronDown, ChevronUp, Mic } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PoemStanza {
    stanza_index: number;
    lines: string[];
    emotion: string;
    intensity: number;
    rhyme_scheme: string;
    end_words: string[];
    color_tint: string;
}

interface PoemAnalysis {
    stanzas: PoemStanza[];
    dominant_emotion: string;
    rhyme_pattern: string;
}

interface PoemRendererProps {
    text: string;
    title: string;
    author?: string;
    language?: string;
    dyslexicFont?: boolean;
    aiUrl: string;
    onLineHighlight?: (line: string) => void;
}

// ── Rhyme colour palette (up to 8 rhyme groups) ───────────────────────────────

const RHYME_COLOURS = [
    "#4F46E5", // A — indigo
    "#DC2626", // B — red
    "#059669", // C — emerald
    "#D97706", // D — amber
    "#7C3AED", // E — violet
    "#0891B2", // F — cyan
    "#DB2777", // G — pink
    "#065F46", // H — dark green
];

const EMOTION_EMOJI: Record<string, string> = {
    joy: "☀️", anger: "🔥", fear: "🌑", sadness: "🌧️",
    surprise: "⚡", disgust: "🌿", neutral: "🌫️", tension: "⚡",
};

// ── Component ─────────────────────────────────────────────────────────────────

const PoemRenderer: React.FC<PoemRendererProps> = ({
    text,
    title,
    author,
    language = "en",
    dyslexicFont = false,
    aiUrl,
    onLineHighlight,
}) => {
    const [analysis, setAnalysis] = useState<PoemAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentStanza, setCurrentStanza] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [playingLine, setPlayingLine] = useState<number | null>(null);
    const [revealedLines, setRevealedLines] = useState<Set<number>>(new Set());

    // Fetch poem analysis from AI service
    useEffect(() => {
        if (!text?.trim()) return;
        let cancelled = false;
        setLoading(true);
        fetch(`${aiUrl}/poem/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, language }),
        })
            .then(r => r.json())
            .then(data => {
                if (!cancelled) {
                    setAnalysis(data);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    // Fallback: split into stanzas manually without emotion
                    const rawStanzas = text.trim().split(/\n\s*\n/).filter(Boolean);
                    setAnalysis({
                        stanzas: rawStanzas.map((s, i) => ({
                            stanza_index: i,
                            lines: s.split("\n").map(l => l.trim()).filter(Boolean),
                            emotion: "neutral",
                            intensity: 0.5,
                            rhyme_scheme: "free verse",
                            end_words: [],
                            color_tint: "#f1f5f9",
                        })),
                        dominant_emotion: "neutral",
                        rhyme_pattern: "free verse",
                    });
                    setLoading(false);
                }
            });
        return () => { cancelled = true; };
    }, [text, language, aiUrl]);

    const stanza = analysis?.stanzas[currentStanza] ?? null;
    const totalStanzas = analysis?.stanzas.length ?? 0;

    // Build rhyme letter → colour map for current stanza
    const rhymeColourMap = useMemo(() => {
        if (!stanza?.rhyme_scheme) return {};
        const map: Record<string, string> = {};
        for (let i = 0; i < stanza.rhyme_scheme.length; i++) {
            const letter = stanza.rhyme_scheme[i];
            if (!map[letter]) {
                map[letter] = RHYME_COLOURS[Object.keys(map).length % RHYME_COLOURS.length];
            }
        }
        return map;
    }, [stanza?.rhyme_scheme]);

    const speakLine = useCallback((line: string, lineIdx: number) => {
        if (isMuted || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        setPlayingLine(lineIdx);
        const utt = new SpeechSynthesisUtterance(line);
        utt.rate = 0.85;
        utt.onend = () => setPlayingLine(null);
        window.speechSynthesis.speak(utt);
    }, [isMuted]);

    const speakFullStanza = useCallback(() => {
        if (!stanza || isMuted) return;
        stanza.lines.forEach((line, i) => {
            setTimeout(() => speakLine(line, i), i * 2500);
        });
    }, [stanza, isMuted, speakLine]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-bold">Analysing poem…</p>
                </div>
            </div>
        );
    }

    if (!analysis || analysis.stanzas.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground font-medium">
                No poem content to display.
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">

            {/* Poem header */}
            <div className="text-center space-y-1">
                <h2 className="text-xl font-black">{title}</h2>
                {author && <p className="text-sm text-muted-foreground font-medium">{author}</p>}
                <div className="flex items-center justify-center gap-3 mt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {analysis.rhyme_pattern} · {EMOTION_EMOJI[analysis.dominant_emotion]} {analysis.dominant_emotion}
                    </span>
                    <button
                        onClick={() => { setIsMuted(m => !m); if (!isMuted) window.speechSynthesis?.cancel(); }}
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                    >
                        {isMuted ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4 text-primary" />}
                    </button>
                </div>
            </div>

            {/* Stanza navigator */}
            <div className="flex items-center gap-3">
                <button
                    disabled={currentStanza === 0}
                    onClick={() => { setCurrentStanza(s => s - 1); setRevealedLines(new Set()); }}
                    className="p-2 rounded-xl border border-border disabled:opacity-30 hover:bg-secondary transition-colors"
                >
                    <ChevronUp className="w-4 h-4" />
                </button>
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Stanza {currentStanza + 1} / {totalStanzas}
                </span>
                <button
                    disabled={currentStanza >= totalStanzas - 1}
                    onClick={() => { setCurrentStanza(s => s + 1); setRevealedLines(new Set()); }}
                    className="p-2 rounded-xl border border-border disabled:opacity-30 hover:bg-secondary transition-colors"
                >
                    <ChevronDown className="w-4 h-4" />
                </button>
            </div>

            {/* Stanza display */}
            <AnimatePresence mode="wait">
                {stanza && (
                    <motion.div
                        key={stanza.stanza_index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.35 }}
                        className="w-full rounded-3xl overflow-hidden border border-border/50"
                        style={{ background: stanza.color_tint + "40" }}
                    >
                        {/* Stanza emotion header */}
                        <div
                            className="flex items-center justify-between px-6 py-3 border-b border-border/30"
                            style={{ background: stanza.color_tint + "60" }}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-base">{EMOTION_EMOJI[stanza.emotion] ?? "🎭"}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70 capitalize">
                                    {stanza.emotion}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {stanza.rhyme_scheme !== "free verse" && (
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-white/40 text-foreground/70 font-mono">
                                        {stanza.rhyme_scheme}
                                    </span>
                                )}
                                <button
                                    onClick={speakFullStanza}
                                    className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-white/40 hover:bg-white/60 transition-colors"
                                    title="Listen to this stanza"
                                >
                                    <Mic className="w-3 h-3" /> Listen
                                </button>
                            </div>
                        </div>

                        {/* Lines */}
                        <div className="px-8 py-8 space-y-3">
                            {stanza.lines.map((line, lineIdx) => {
                                const endWord = stanza.end_words[lineIdx] ?? "";
                                const rhymeLetter = stanza.rhyme_scheme[lineIdx] ?? "";
                                const rhymeColour = rhymeColourMap[rhymeLetter] ?? "transparent";
                                const isPlaying = playingLine === lineIdx;
                                const isRevealed = revealedLines.has(lineIdx);

                                // Render line with rhyme-coloured end word
                                const words = line.split(" ");
                                const lastWordIdx = words.length - 1;

                                return (
                                    <div key={lineIdx} className="flex flex-col gap-1">
                                        <motion.div
                                            className="text-center cursor-pointer select-none"
                                            animate={{ scale: isPlaying ? 1.03 : 1 }}
                                            onClick={() => {
                                                speakLine(line, lineIdx);
                                                onLineHighlight?.(line);
                                                setRevealedLines(s => new Set([...s, lineIdx]));
                                            }}
                                        >
                                            <p
                                                className={`text-lg md:text-xl leading-relaxed font-medium ${
                                                    isPlaying ? "text-primary" : "text-foreground"
                                                } ${dyslexicFont ? "font-dyslexic" : ""}`}
                                                style={{ lineHeight: 2 }}
                                            >
                                                {words.map((word, wi) => {
                                                    const isEndWord = wi === lastWordIdx && endWord && rhymeLetter;
                                                    return (
                                                        <React.Fragment key={wi}>
                                                            {isEndWord ? (
                                                                <span
                                                                    className="font-black rounded px-0.5"
                                                                    style={{
                                                                        color: rhymeColour,
                                                                        textDecoration: "underline",
                                                                        textDecorationColor: rhymeColour + "80",
                                                                        textDecorationThickness: "2px",
                                                                    }}
                                                                    title={`Rhymes with: ${rhymeLetter}`}
                                                                >
                                                                    {word}
                                                                </span>
                                                            ) : word}{" "}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </p>
                                        </motion.div>

                                        {/* Revealed meaning hint */}
                                        {isRevealed && (
                                            <motion.p
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                className="text-center text-xs text-muted-foreground italic px-4"
                                            >
                                                Tap the highlighted text to explore this line further
                                            </motion.p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Emotion intensity bar */}
                        {stanza.intensity > 0.5 && (
                            <div className="px-6 pb-4">
                                <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full"
                                        style={{ background: stanza.color_tint.replace("40", "CC") }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${stanza.intensity * 100}%` }}
                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                    />
                                </div>
                                <p className="text-[9px] text-center mt-1 opacity-50 font-bold uppercase tracking-widest">
                                    Emotional intensity
                                </p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* All stanzas overview pills */}
            <div className="flex flex-wrap gap-1.5 justify-center">
                {analysis.stanzas.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => { setCurrentStanza(i); setRevealedLines(new Set()); }}
                        className="w-7 h-7 rounded-full text-[9px] font-black transition-all flex items-center justify-center border"
                        style={{
                            background: i === currentStanza ? s.color_tint : "transparent",
                            borderColor: s.color_tint + "80",
                            color: i === currentStanza ? "#000" : "inherit",
                            opacity: i === currentStanza ? 1 : 0.5,
                        }}
                        title={`${EMOTION_EMOJI[s.emotion]} ${s.emotion}`}
                    >
                        {i + 1}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default PoemRenderer;
