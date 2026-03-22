/**
 * DyslexiaRenderer.tsx
 * ====================
 * Enhanced dyslexia rendering layer for text content.
 *
 * Features:
 *   - Bionic Reading (bold first syllables for faster decoding)
 *   - Syllable color-coding for long words
 *   - Reading ruler (highlight current line)
 *   - Alternating line backgrounds (subtle gray/white bands)
 *   - OpenDyslexic font toggle
 *   - Adjustable letter/word spacing
 *   - Line length limiter (max 60 chars)
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Eye, Type, Minus, Plus, Ruler, Palette } from "lucide-react";

// ── Bionic reading: bold the first part of each word ─────────────────────────

function bionicWord(word: string): React.ReactNode {
    if (word.length <= 1) return word;
    // Bold first ~40% of word (or at least 1 char)
    const boldLen = Math.max(1, Math.ceil(word.length * 0.4));
    const bold = word.slice(0, boldLen);
    const rest = word.slice(boldLen);
    return (
        <span>
            <strong style={{ fontWeight: 800 }}>{bold}</strong>{rest}
        </span>
    );
}

function bionicText(text: string): React.ReactNode {
    const words = text.split(/(\s+)/);
    return words.map((segment, i) => {
        if (/^\s+$/.test(segment)) return segment;
        return <React.Fragment key={i}>{bionicWord(segment)}</React.Fragment>;
    });
}

// ── Syllable color-coding for hard words ─────────────────────────────────────

const SYLLABLE_COLORS = [
    "hsl(210, 70%, 50%)",  // blue
    "hsl(340, 65%, 50%)",  // rose
    "hsl(160, 60%, 40%)",  // teal
    "hsl(30, 70%, 50%)",   // orange
    "hsl(270, 55%, 55%)",  // purple
];

function estimateSyllables(word: string): string[] {
    // Simple syllable estimation
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    if (clean.length <= 3) return [word];

    const syllables: string[] = [];
    let current = "";
    let prevVowel = false;
    const vowels = "aeiouy";

    for (let i = 0; i < clean.length; i++) {
        current += word[i] || clean[i];
        const isVowel = vowels.includes(clean[i]);

        if (isVowel && !prevVowel && syllables.length > 0) {
            // Start new syllable at vowel transitions
            if (current.length > 1) {
                const split = Math.max(1, current.length - 1);
                syllables[syllables.length - 1] += current.slice(0, split);
                current = current.slice(split);
            }
        }

        if (!isVowel && prevVowel && current.length >= 2) {
            syllables.push(current);
            current = "";
        }

        prevVowel = isVowel;
    }

    if (current) {
        if (syllables.length > 0 && current.length <= 1) {
            syllables[syllables.length - 1] += current;
        } else {
            syllables.push(current);
        }
    }

    return syllables.length > 0 ? syllables : [word];
}

function syllableColorWord(word: string, showMarkers: boolean = false): React.ReactNode {
    const clean = word.replace(/[^a-zA-Z]/g, "");
    if (clean.length < 6) return word; // Only color long words

    const syllables = estimateSyllables(word);
    if (syllables.length <= 1) return word;

    return (
        <span className="syllable-colored">
            {syllables.map((syl, i) => (
                <span
                    key={i}
                    style={{
                        color: SYLLABLE_COLORS[i % SYLLABLE_COLORS.length],
                        fontWeight: 600,
                    }}
                >
                    {syl}{showMarkers && i < syllables.length - 1 && "·"}
                </span>
            ))}
        </span>
    );
}

function syllableColorText(text: string, showMarkers: boolean = false): React.ReactNode {
    const words = text.split(/(\s+)/);
    return words.map((segment, i) => {
        if (/^\s+$/.test(segment)) return segment;
        return <React.Fragment key={i}>{syllableColorWord(segment, showMarkers)}</React.Fragment>;
    });
}

// ── Reading ruler (follows mouse/focus) ──────────────────────────────────────

const ReadingRuler: React.FC<{ containerRef: React.RefObject<HTMLDivElement | null> }> = ({
    containerRef,
}) => {
    const [rulerY, setRulerY] = useState<number | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;
            setRulerY(y);
        };

        container.addEventListener("mousemove", handleMouseMove, { passive: true });
        return () => container.removeEventListener("mousemove", handleMouseMove);
    }, [containerRef]);

    if (rulerY === null) return null;

    return (
        <>
            {/* Highlight band */}
            <div
                className="reading-ruler__highlight"
                style={{
                    top: rulerY - 16,
                    height: 32,
                }}
            />
            {/* Dim above */}
            <div
                className="reading-ruler__dim reading-ruler__dim--top"
                style={{ height: Math.max(0, rulerY - 16) }}
            />
            {/* Dim below */}
            <div
                className="reading-ruler__dim reading-ruler__dim--bottom"
                style={{ top: rulerY + 16 }}
            />
        </>
    );
};

// ── Main DyslexiaRenderer ────────────────────────────────────────────────────

export type DyslexiaFontChoice = "default" | "openDyslexic" | "lexend";

export interface DyslexiaSettings {
    bionicReading: boolean;
    syllableColors: boolean;
    readingRuler: boolean;
    alternatingLines: boolean;
    openDyslexicFont: boolean;
    fontChoice: DyslexiaFontChoice;
    syllableMarkers: boolean;
    letterSpacing: number;   // px
    wordSpacing: number;     // px
    lineHeight: number;      // multiplier
    fontSize: number;        // rem
}

export const DEFAULT_DYSLEXIA_SETTINGS: DyslexiaSettings = {
    bionicReading: false,
    syllableColors: false,
    readingRuler: false,
    alternatingLines: false,
    openDyslexicFont: false,
    fontChoice: "default",
    syllableMarkers: true,
    letterSpacing: 2,
    wordSpacing: 4,
    lineHeight: 1.8,
    fontSize: 1.1,
};

const FONT_FAMILIES: Record<DyslexiaFontChoice, string> = {
    default: "inherit",
    openDyslexic: "'OpenDyslexic', 'Comic Sans MS', sans-serif",
    lexend: "'Lexend', 'Inter', sans-serif",
};

interface DyslexiaRendererProps {
    text: string;
    settings: DyslexiaSettings;
    className?: string;
}

export const DyslexiaText: React.FC<DyslexiaRendererProps> = ({
    text,
    settings,
    className = "",
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Process text through rendering pipeline
    let rendered: React.ReactNode;
    if (settings.bionicReading) {
        rendered = bionicText(text);
    } else if (settings.syllableColors) {
        rendered = syllableColorText(text, settings.syllableMarkers);
    } else {
        rendered = text;
    }

    // Split into lines for alternating backgrounds
    const lines = text.split(/\n/);

    // Determine font: fontChoice takes precedence, fall back to openDyslexicFont toggle
    const effectiveFont: DyslexiaFontChoice = settings.fontChoice !== "default"
        ? settings.fontChoice
        : settings.openDyslexicFont ? "openDyslexic" : "default";

    const style: React.CSSProperties = {
        fontFamily: FONT_FAMILIES[effectiveFont],
        letterSpacing: `${settings.letterSpacing}px`,
        wordSpacing: `${settings.wordSpacing}px`,
        lineHeight: settings.lineHeight,
        fontSize: `${settings.fontSize}rem`,
    };

    return (
        <div
            ref={containerRef}
            className={`dyslexia-renderer ${className} ${settings.alternatingLines ? "dyslexia-renderer--alt-lines" : ""}`}
            style={{ ...style, position: "relative", width: "100%", display: "block" }}
        >
            {settings.readingRuler && <ReadingRuler containerRef={containerRef} />}
            <p
                className="dyslexia-renderer__text"
                style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: "inherit",
                    letterSpacing: "inherit",
                    wordSpacing: "inherit",
                    margin: 0
                }}
            >
                {rendered}
            </p>
        </div>
    );
};

// ── Settings control panel ───────────────────────────────────────────────────

interface DyslexiaControlsProps {
    settings: DyslexiaSettings;
    onChange: (settings: DyslexiaSettings) => void;
    alwaysExpanded?: boolean;
}

export const DyslexiaControls: React.FC<DyslexiaControlsProps> = ({
    settings,
    onChange,
    alwaysExpanded = false,
}) => {
    const [expanded, setExpanded] = useState(alwaysExpanded);

    const toggle = (key: keyof DyslexiaSettings) => {
        onChange({ ...settings, [key]: !settings[key] });
    };

    const adjust = (key: keyof DyslexiaSettings, delta: number) => {
        const val = (settings[key] as number) + delta;
        onChange({ ...settings, [key]: Math.max(0, val) });
    };

    return (
        <div className="dyslexia-controls space-y-4">
            {!alwaysExpanded && (
                <button
                    className="dyslexia-controls__toggle flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-all font-bold text-sm shadow-sm"
                    onClick={() => setExpanded(v => !v)}
                >
                    <Eye size={16} className="text-primary" />
                    Reading Settings
                </button>
            )}

            {(expanded || alwaysExpanded) && (
                <div className="dyslexia-controls__panel grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Visual Aids</h4>
                        <label className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/20 border border-border/50 cursor-pointer hover:bg-secondary/30 transition-all group">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-primary text-primary focus:ring-primary"
                                checked={settings.bionicReading}
                                onChange={() => toggle("bionicReading")}
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold group-hover:text-primary transition-colors">Bionic Reading</span>
                                <span className="text-[10px] text-muted-foreground">Bold starts for faster decoding</span>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/20 border border-border/50 cursor-pointer hover:bg-secondary/30 transition-all group">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-primary text-primary focus:ring-primary"
                                checked={settings.syllableColors}
                                onChange={() => toggle("syllableColors")}
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold group-hover:text-primary transition-colors">Color Syllables</span>
                                <span className="text-[10px] text-muted-foreground">Hues for complex words</span>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/20 border border-border/50 cursor-pointer hover:bg-secondary/30 transition-all group">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-primary text-primary focus:ring-primary"
                                checked={settings.readingRuler}
                                onChange={() => toggle("readingRuler")}
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold group-hover:text-primary transition-colors">Reading Ruler</span>
                                <span className="text-[10px] text-muted-foreground">Focus on current line</span>
                            </div>
                        </label>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Typography</h4>
                        
                        <div className="p-3 rounded-2xl bg-secondary/20 border border-border/50 space-y-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-bold">Font Type</span>
                                <select
                                    value={settings.fontChoice}
                                    onChange={(e) => onChange({
                                        ...settings,
                                        fontChoice: e.target.value as DyslexiaFontChoice,
                                        openDyslexicFont: e.target.value === "openDyslexic",
                                    })}
                                    className="text-xs px-2 py-1 rounded-lg border-2 border-primary/20 bg-background font-bold focus:border-primary outline-none"
                                >
                                    <option value="default">Standard</option>
                                    <option value="openDyslexic">OpenDyslexic</option>
                                    <option value="lexend">Lexend (ADHD)</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-3 rounded-2xl bg-secondary/20 border border-border/50 space-y-4">
                            {[
                                { label: "Size", key: "fontSize" as const, step: 0.1, unit: "rem" },
                                { label: "Line Height", key: "lineHeight" as const, step: 0.1, unit: "" },
                                { label: "Letter Gap", key: "letterSpacing" as const, step: 0.5, unit: "px" },
                                { label: "Word Gap", key: "wordSpacing" as const, step: 1, unit: "px" },
                            ].map((s) => (
                                <div key={s.key} className="flex items-center justify-between">
                                    <span className="text-xs font-bold">{s.label}</span>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all"
                                            onClick={() => adjust(s.key, -s.step)}
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <span className="text-xs font-black w-8 text-center">{(settings[s.key] as number).toFixed(s.unit === "px" ? 0 : 1)}{s.unit}</span>
                                        <button 
                                            className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all"
                                            onClick={() => adjust(s.key, s.step)}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DyslexiaText;
