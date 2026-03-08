/**
 * PlayDialogueUI.tsx
 * ==================
 * Animated play dialogue renderer for IncludEd v2.
 *
 * New in v2:
 *  - Emotion-driven avatar expressions (happy/sad/angry/scared/surprised/disgusted/neutral)
 *  - Emotion badge on each dialogue line
 *  - Dynamic mouth shapes, eyebrow positions, eye states per emotion
 *  - Avatar color-tint background reacts to emotion
 *  - Emotion data sourced from dialogue line (from ML pipeline on backend)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    ChevronRight,
    ChevronLeft,
    Volume2,
    VolumeX,
    Play,
    Pause,
    SkipForward,
    Type,
    Users,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type Emotion =
    | "anger" | "disgust" | "fear" | "joy"
    | "neutral" | "sadness" | "surprise";

export interface EmotionAnim {
    expression: string;
    eyebrows: string;  // raised | furrowed | drooped | neutral
    mouth: string;  // smile | frown | open | tight | closed | curled
    eyes: string;  // wide | narrowed | downcast | bright | normal | squinted
    color_tint: string;  // CSS colour for avatar background tint
}

export interface DialogueLine {
    type: "dialogue" | "stage_direction" | "paragraph" | "narrative";
    character?: string | null;
    content: string;
    // ML-enriched emotion data (from ai-service EmotionAnalyzer)
    emotion?: Emotion;
    intensity?: number;   // 0–1
    anim?: EmotionAnim;
}

interface PlayDialogueUIProps {
    lines: DialogueLine[];
    sceneTitle?: string;
    actTitle?: string;
    autoAdvance?: boolean;
    autoAdvanceDelay?: number;
    dyslexicFont?: boolean;
    onComplete?: () => void;
    // Phase 2 enrichment
    charactersOnStage?: string[];          // from section.characters_present
    characterFactions?: Record<string, string>; // char_name → faction label
}

// ── Emotion config ─────────────────────────────────────────────────────────────

const EMOTION_EMOJI: Record<Emotion, string> = {
    anger: "😠",
    disgust: "🤢",
    fear: "😨",
    joy: "😄",
    neutral: "😐",
    sadness: "😢",
    surprise: "😲",
};

const EMOTION_LABEL_COLOR: Record<Emotion, string> = {
    anger: "bg-red-100 text-red-700",
    disgust: "bg-green-100 text-green-700",
    fear: "bg-yellow-100 text-yellow-700",
    joy: "bg-yellow-50 text-amber-600",
    neutral: "bg-slate-100 text-slate-500",
    sadness: "bg-blue-100 text-blue-700",
    surprise: "bg-purple-100 text-purple-700",
};

const DEFAULT_ANIM: Record<Emotion, EmotionAnim> = {
    anger: { expression: "angry", eyebrows: "furrowed", mouth: "tight", eyes: "narrowed", color_tint: "#fee2e2" },
    disgust: { expression: "disgusted", eyebrows: "furrowed", mouth: "curled", eyes: "squinted", color_tint: "#d1fae5" },
    fear: { expression: "scared", eyebrows: "raised", mouth: "open", eyes: "wide", color_tint: "#fef9c3" },
    joy: { expression: "happy", eyebrows: "raised", mouth: "smile", eyes: "bright", color_tint: "#fef08a" },
    neutral: { expression: "neutral", eyebrows: "neutral", mouth: "closed", eyes: "normal", color_tint: "#f1f5f9" },
    sadness: { expression: "sad", eyebrows: "drooped", mouth: "frown", eyes: "downcast", color_tint: "#dbeafe" },
    surprise: { expression: "surprised", eyebrows: "raised", mouth: "open", eyes: "wide", color_tint: "#ede9fe" },
};

// ── Character colour palette ───────────────────────────────────────────────────

const CHAR_PALETTE = [
    { bg: "#4F46E5", text: "#FFFFFF", bubble: "#EEF2FF" },
    { bg: "#0891B2", text: "#FFFFFF", bubble: "#ECFEFF" },
    { bg: "#059669", text: "#FFFFFF", bubble: "#ECFDF5" },
    { bg: "#D97706", text: "#FFFFFF", bubble: "#FFFBEB" },
    { bg: "#DC2626", text: "#FFFFFF", bubble: "#FEF2F2" },
    { bg: "#7C3AED", text: "#FFFFFF", bubble: "#F5F3FF" },
    { bg: "#DB2777", text: "#FFFFFF", bubble: "#FDF2F8" },
    { bg: "#065F46", text: "#FFFFFF", bubble: "#D1FAE5" },
];

// Faction-based palettes — characters of the same faction share a hue family
const FACTION_PALETTES: Record<string, (typeof CHAR_PALETTE)[number]> = {
    montague: { bg: "#1D4ED8", text: "#FFFFFF", bubble: "#DBEAFE" },
    capulet: { bg: "#B91C1C", text: "#FFFFFF", bubble: "#FEE2E2" },
    roman: { bg: "#7C3AED", text: "#FFFFFF", bubble: "#EDE9FE" },
    plebeian: { bg: "#065F46", text: "#FFFFFF", bubble: "#D1FAE5" },
    okonkwo: { bg: "#92400E", text: "#FFFFFF", bubble: "#FEF3C7" },
    colonist: { bg: "#374151", text: "#FFFFFF", bubble: "#F3F4F6" },
    danish: { bg: "#1E3A5F", text: "#FFFFFF", bubble: "#DBEAFE" },
    ghost: { bg: "#4B5563", text: "#FFFFFF", bubble: "#F9FAFB" },
};

function getCharColour(
    name: string,
    map: Map<string, (typeof CHAR_PALETTE)[number]>,
    factions?: Record<string, string>,
) {
    if (!map.has(name)) {
        // If faction is known, use faction palette variant
        const faction = factions?.[name]?.toLowerCase().replace(/\s+/g, "_") ?? "";
        const factionColour = faction ? FACTION_PALETTES[faction] : null;
        if (factionColour) {
            map.set(name, factionColour);
        } else {
            map.set(name, CHAR_PALETTE[map.size % CHAR_PALETTE.length]);
        }
    }
    return map.get(name)!;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

interface BlinkingEyeProps {
    isSpeaking: boolean;
    eyeState: string;
}

const BlinkingEye: React.FC<BlinkingEyeProps> = ({ isSpeaking, eyeState }) => {
    const scaleY = eyeState === "wide" ? 1.4
        : eyeState === "narrowed" ? 0.5
            : eyeState === "squinted" ? 0.3
                : eyeState === "downcast" ? 0.7
                    : 1.0;

    return (
        <motion.div
            className="w-3 h-3 rounded-full bg-white"
            animate={
                isSpeaking
                    ? { scaleY: [scaleY, 0.1, scaleY], scaleX: [1, 1.1, 1] }
                    : { scaleY: [scaleY, 0.1, scaleY] }
            }
            style={{ scaleY }}
            transition={{
                repeat: Infinity,
                duration: isSpeaking ? 0.8 : 3.5,
                ease: "easeInOut",
            }}
        />
    );
};

interface AvatarProps {
    name: string;
    colours: (typeof CHAR_PALETTE)[number];
    isSpeaking: boolean;
    initials: string;
    emotion: Emotion;
    anim: EmotionAnim;
}

const Avatar: React.FC<AvatarProps> = ({
    name, colours, isSpeaking, initials, emotion, anim,
}) => {
    const eyebrowTranslateY =
        anim.eyebrows === "raised" ? -4 :
            anim.eyebrows === "drooped" ? 3 :
                anim.eyebrows === "furrowed" ? -2 : 0;

    const eyebrowRotate = anim.eyebrows === "furrowed" ? 8 : 0;

    const mouthShape: React.CSSProperties & { width: number; height: number } = (
        anim.mouth === "smile" ? { width: 20, height: 8, borderRadius: "0 0 12px 12px" } :
            anim.mouth === "frown" ? { width: 20, height: 8, borderRadius: "12px 12px 0 0" } :
                anim.mouth === "open" ? { width: 14, height: 12, borderRadius: "6px" } :
                    anim.mouth === "tight" ? { width: 14, height: 3, borderRadius: "2px" } :
                        anim.mouth === "curled" ? { width: 16, height: 4, borderRadius: "2px 2px 8px 2px" } :
                            { width: 12, height: 3, borderRadius: "2px" }
    ) as React.CSSProperties & { width: number; height: number };

    return (
        <motion.div
            className="relative flex flex-col items-center gap-3 select-none"
            animate={{ scale: isSpeaking ? 1 : 0.88 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
            {/* Emotion tint ring */}
            <motion.div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ background: anim.color_tint }}
                animate={{ opacity: isSpeaking ? [0.3, 0.6, 0.3] : [0.1, 0.2, 0.1], scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            />

            {/* Face circle */}
            <div
                className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl border-4 z-10"
                style={{ background: colours.bg, borderColor: isSpeaking ? "#FDE68A" : "transparent" }}
            >
                {/* Eyebrows */}
                <div
                    className="absolute top-5 flex gap-6"
                    style={{ transform: `translateY(${eyebrowTranslateY}px)` }}
                >
                    {[1, -1].map((dir) => (
                        <motion.div
                            key={dir}
                            className="w-5 h-1.5 rounded-full"
                            style={{
                                background: colours.text,
                                opacity: 0.85,
                                transform: `rotate(${dir * eyebrowRotate}deg)`,
                            }}
                        />
                    ))}
                </div>

                {/* Eyes */}
                <div className="absolute top-8 flex gap-5">
                    <BlinkingEye isSpeaking={isSpeaking} eyeState={anim.eyes} />
                    <BlinkingEye isSpeaking={isSpeaking} eyeState={anim.eyes} />
                </div>

                {/* Mouth */}
                <motion.div
                    className="absolute"
                    style={{
                        bottom: 18,
                        background: colours.text,
                        opacity: 0.9,
                        ...mouthShape,
                    }}
                    animate={
                        isSpeaking && anim.mouth !== "frown"
                            ? { width: [mouthShape.width, mouthShape.width + 6, mouthShape.width] }
                            : {}
                    }
                    transition={
                        isSpeaking
                            ? { repeat: Infinity, duration: 0.45, ease: "easeInOut" }
                            : {}
                    }
                />

                <span className="text-lg font-black z-10 mt-1" style={{ color: colours.text, opacity: 0.22 }}>
                    {initials}
                </span>
            </div>

            {/* Name label */}
            <span
                className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap"
                style={{ background: colours.bg, color: colours.text }}
            >
                {name}
            </span>
        </motion.div>
    );
};

// ── Speech Bubble ─────────────────────────────────────────────────────────────

interface BubbleProps {
    text: string;
    colours: (typeof CHAR_PALETTE)[number];
    dyslexicFont: boolean;
    charName: string;
    emotion: Emotion;
    intensity: number;
    isRight: boolean;
    sceneTitle?: string;
}

const SpeechBubble: React.FC<BubbleProps> = ({
    text, colours, dyslexicFont, charName, emotion, intensity, isRight, sceneTitle
}) => {
    const [translation, setTranslation] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleTranslate = async () => {
        if (translation) {
            setTranslation(null); // toggle off
            return;
        }
        setIsLoading(true);
        try {
            const aiUrl = import.meta.env.VITE_AI_URL || "http://localhost:8000";
            const response = await fetch(`${aiUrl}/simplify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    highlighted_text: text,
                    doc_type: "play",
                    speaker: charName,
                    chapter_context: sceneTitle || "A scene in a play"
                })
            });
            if (response.ok) {
                const data = await response.json();
                setTranslation(data.simple_version);
            } else {
                setTranslation("Could not translate at this time.");
            }
        } catch (e) {
            setTranslation("Error translating.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: isRight ? 40 : -40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="relative flex flex-col gap-2 p-4 rounded-3xl shadow-md border"
            style={{ background: colours.bubble, borderColor: colours.bg + "40", maxWidth: "85%" }}
        >
            <div
                className={`absolute top-6 w-0 h-0 ${isRight ? 'right-[-12px]' : 'left-[-12px]'}`}
                style={{
                    borderTop: "8px solid transparent",
                    borderBottom: "8px solid transparent",
                    [isRight ? "borderLeft" : "borderRight"]: `12px solid ${colours.bubble}`,
                }}
            />

            <div className={`flex items-center gap-2 flex-wrap ${isRight ? 'flex-row-reverse' : ''}`}>
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: colours.bg }}>
                    {charName}
                </span>
                {emotion !== "neutral" && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${EMOTION_LABEL_COLOR[emotion]}`}>
                        {EMOTION_EMOJI[emotion]} {emotion}
                    </span>
                )}
                <button
                    onClick={handleTranslate}
                    className="ml-auto flex items-center justify-center p-1.5 rounded-full hover:bg-black/5"
                    title="Translate to simpler terms"
                >
                    <div className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-xs font-bold border border-blue-200 shadow-sm animate-pulse-once">i</div>
                </button>
            </div>

            <p
                className={`text-base leading-relaxed font-medium text-gray-800 dark:text-gray-100 ${dyslexicFont ? "font-dyslexic" : ""}`}
                style={{ lineHeight: 1.6 }}
            >
                {text}
            </p>

            {isLoading && (
                <div className="text-xs text-blue-500 italic animate-pulse mt-2 border-t pt-2 border-black/10">Translating...</div>
            )}

            {translation && !isLoading && (
                <div className="mt-2 pt-2 border-t border-black/10">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Translation:</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200 mt-1 italic">{translation}</p>
                </div>
            )}

            {intensity > 0.65 && emotion !== "neutral" && (
                <div className="w-full h-0.5 rounded-full bg-gray-200 overflow-hidden mt-1">
                    <motion.div
                        className="h-full rounded-full"
                        style={{ background: colours.bg }}
                        initial={{ width: 0 }}
                        animate={{ width: `${intensity * 100}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                </div>
            )}
        </motion.div>
    );
};

// ── Stage Direction ────────────────────────────────────────────────────────────

const StageDirectionCard: React.FC<{ text: string; isNarrative?: boolean }> = ({ text, isNarrative }) => (
    <motion.div
        key={text}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`w-full py-4 px-6 rounded-2xl ${isNarrative
                ? "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 text-base leading-relaxed"
                : "border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 italic text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center"
            }`}
    >
        {isNarrative ? text : `[${text}]`}
    </motion.div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

const PlayDialogueUI: React.FC<PlayDialogueUIProps> = ({
    lines,
    sceneTitle,
    actTitle,
    autoAdvance = false,
    autoAdvanceDelay = 4000,
    dyslexicFont: initialDyslexic = false,
    onComplete,
    charactersOnStage,
    characterFactions,
}) => {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(autoAdvance);
    const [isMuted, setIsMuted] = useState(false);
    const [dyslexicFont, setDyslexicFont] = useState(initialDyslexic);
    const colourMap = useRef(new Map<string, (typeof CHAR_PALETTE)[number]>());
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const current = lines[currentIdx];
    const total = lines.length;
    const progress = ((currentIdx + 1) / total) * 100;

    const allChars = useMemo(() => {
        const chars = new Set<string>();
        lines.forEach((l) => {
            if (l.type === "dialogue" && l.character) chars.add(l.character.toUpperCase());
        });
        return Array.from(chars);
    }, [lines]);

    useMemo(() => {
        allChars.forEach((c) => getCharColour(c, colourMap.current, characterFactions));
    }, [allChars, characterFactions]);

    const currentEmotion: Emotion = (current?.emotion as Emotion) || "neutral";
    const currentIntensity: number = current?.intensity ?? 0.5;
    const currentAnim: EmotionAnim = current?.anim ?? DEFAULT_ANIM[currentEmotion];

    const speakLine = useCallback(
        (text: string, charName?: string) => {
            if (isMuted || !window.speechSynthesis) return;
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.rate = 0.9;
            utter.pitch = charName ? 0.8 + (allChars.indexOf(charName.toUpperCase()) % 5) * 0.1 : 1.0;
            utteranceRef.current = utter;
            window.speechSynthesis.speak(utter);
        },
        [isMuted, allChars],
    );

    const advance = useCallback(() => {
        setCurrentIdx((prev) => {
            const next = prev + 1;
            if (next >= total) { onComplete?.(); return prev; }
            return next;
        });
    }, [total, onComplete]);

    const retreat = useCallback(() => setCurrentIdx((prev) => Math.max(0, prev - 1)), []);

    useEffect(() => {
        if (!isAutoPlaying) { if (timerRef.current) clearTimeout(timerRef.current); return; }
        timerRef.current = setTimeout(advance, autoAdvanceDelay);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [isAutoPlaying, currentIdx, advance, autoAdvanceDelay]);

    useEffect(() => {
        if (!current) return;
        if (current.type === "dialogue" && current.content) {
            speakLine(current.content, current.character ?? undefined);
        }
    }, [currentIdx, current, speakLine]);

    useEffect(() => () => window.speechSynthesis?.cancel(), []);

    if (!current || lines.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
                No dialogue lines available.
            </div>
        );
    }

    const charName = current.type === "dialogue" && current.character
        ? current.character.toUpperCase()
        : null;

    const colours = charName ? getCharColour(charName, colourMap.current, characterFactions) : CHAR_PALETTE[0];
    const isStageDir = current.type === "stage_direction"
        || current.type === "narrative"
        || current.type === "paragraph";

    return (
        <div className="flex flex-col gap-4 w-full">

            {/* Who's on stage strip (Phase 2) */}
            {charactersOnStage && charactersOnStage.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-secondary/40 border border-border/40">
                    <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">On stage:</span>
                    <div className="flex flex-wrap gap-1.5">
                        {charactersOnStage.map((name) => {
                            const upperName = name.toUpperCase();
                            const col = getCharColour(upperName, colourMap.current, characterFactions);
                            const faction = characterFactions?.[upperName] || characterFactions?.[name];
                            return (
                                <span
                                    key={name}
                                    className="text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1"
                                    style={{ background: col.bg, color: col.text }}
                                    title={faction ? `Faction: ${faction}` : undefined}
                                >
                                    {name.slice(0, 12)}
                                    {faction && <span className="opacity-60 text-[8px]">({faction.slice(0, 4)})</span>}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex flex-col gap-0.5">
                    {actTitle && <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{actTitle}</span>}
                    {sceneTitle && <h3 className="text-base font-bold">{sceneTitle}</h3>}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        {allChars.slice(0, 6).map((c) => {
                            const col = getCharColour(c, colourMap.current, characterFactions);
                            return (
                                <span key={c} className="text-[9px] font-black px-2 py-0.5 rounded-full"
                                    style={{ background: col.bg, color: col.text }}>
                                    {c.slice(0, 3)}
                                </span>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Type className="w-3.5 h-3.5 text-muted-foreground" />
                        <Switch id="dyslexic-toggle" checked={dyslexicFont} onCheckedChange={setDyslexicFont} />
                        <Label htmlFor="dyslexic-toggle" className="text-xs font-bold">Dyslexic Font</Label>
                    </div>
                    <button
                        onClick={() => { setIsMuted((m) => !m); if (!isMuted) window.speechSynthesis?.cancel(); }}
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                    >
                        {isMuted
                            ? <VolumeX className="w-4 h-4 text-muted-foreground" />
                            : <Volume2 className="w-4 h-4 text-primary" />
                        }
                    </button>
                </div>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                    {currentIdx + 1} / {total}
                </span>
                <Progress value={progress} className="h-1.5 flex-1" />
                <Badge variant="secondary" className="text-[10px] font-black rounded-full px-2">
                    {Math.round(progress)}%
                </Badge>
            </div>

            {/* Scene area - Chat Interface */}
            <div className="flex flex-col gap-6 overflow-y-auto pr-4 py-4" style={{ maxHeight: "60vh" }}>
                <AnimatePresence initial={false}>
                    {lines.slice(0, currentIdx + 1).map((line, idx) => {
                        const isStageDir = line.type === "stage_direction" || line.type === "narrative" || line.type === "paragraph";

                        if (isStageDir) {
                            return <StageDirectionCard key={`dir-${idx}`} text={line.content} isNarrative={line.type === "narrative" || line.type === "paragraph"} />;
                        }

                        const lineCharName = line.character ? line.character.toUpperCase() : "UNKNOWN";
                        const lineColours = getCharColour(lineCharName, colourMap.current, characterFactions);
                        const isRight = allChars.indexOf(lineCharName) % 2 !== 0; // Alternating sides
                        const lineEmotion = (line.emotion as Emotion) || "neutral";
                        const lineAnim = line.anim ?? DEFAULT_ANIM[lineEmotion];

                        return (
                            <motion.div
                                key={`chat-${idx}`}
                                className={`flex items-end gap-3 md:gap-4 w-full ${isRight ? 'flex-row-reverse' : 'flex-row'}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            >
                                <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20" style={{ transform: "scale(0.8)", transformOrigin: isRight ? "bottom right" : "bottom left" }}>
                                    <Avatar
                                        name={lineCharName.slice(0, 8)}
                                        colours={lineColours}
                                        isSpeaking={idx === currentIdx && isAutoPlaying}
                                        initials={lineCharName.slice(0, 2)}
                                        emotion={lineEmotion}
                                        anim={lineAnim}
                                    />
                                </div>
                                <div className={`flex flex-col ${isRight ? 'items-end' : 'items-start'} max-w-[85%]`}>
                                    <SpeechBubble
                                        text={line.content}
                                        colours={lineColours}
                                        dyslexicFont={dyslexicFont}
                                        charName={lineCharName}
                                        emotion={lineEmotion}
                                        intensity={line.intensity ?? 0.5}
                                        isRight={isRight}
                                        sceneTitle={sceneTitle}
                                    />
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* Invisible element to scroll to bottom */}
                <div ref={(el) => {
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }} />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-border">
                <Button variant="outline" size="sm" className="gap-1 rounded-xl font-bold" onClick={retreat} disabled={currentIdx === 0}>
                    <ChevronLeft className="w-4 h-4" /> Previous
                </Button>

                <button
                    onClick={() => setIsAutoPlaying((v) => !v)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isAutoPlaying ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground"
                        }`}
                >
                    {isAutoPlaying ? <><Pause className="w-3.5 h-3.5" /> Auto-Play On</> : <><Play className="w-3.5 h-3.5" /> Auto-Play</>}
                </button>

                {currentIdx < total - 1 ? (
                    <Button size="sm" className="gap-1 rounded-xl font-bold bg-primary text-primary-foreground" onClick={advance}>
                        Next <ChevronRight className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button size="sm" className="gap-1 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700" onClick={onComplete}>
                        <SkipForward className="w-4 h-4" /> Finish Scene
                    </Button>
                )}
            </div>
        </div>
    );
};

export default PlayDialogueUI;
