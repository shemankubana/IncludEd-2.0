/**
 * CharacterTooltip.tsx
 * ====================
 * Renders prose text with character names made tappable/clickable.
 * When a character name is tapped, a tooltip card appears showing:
 *   - Who they are (importance + relationship)
 *   - Their comprehension familiarity score
 *   - Which scenes they've appeared in
 *
 * Characters data comes from bookBrain.characters.
 * Familiarity data comes from comprehension summary.
 */

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users } from "lucide-react";

interface Character {
    name: string;
    importance: "major" | "minor" | "background";
    line_count?: number;
    scene_count?: number;
    relationships?: Array<{ character: string; co_appearances: number }>;
    scenes?: string[];
}

interface CharacterTooltipProps {
    text: string;
    characters: Character[];
    familiarityScores?: Record<string, number>; // from comprehension summary
    className?: string;
}

interface TooltipState {
    character: Character;
    x: number;
    y: number;
}

const IMPORTANCE_BADGE: Record<string, string> = {
    major:      "bg-primary/15 text-primary",
    minor:      "bg-amber-100 text-amber-700",
    background: "bg-slate-100 text-slate-600",
};

const CharacterTooltip: React.FC<CharacterTooltipProps> = ({
    text,
    characters,
    familiarityScores = {},
    className,
}) => {
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const containerRef = useRef<HTMLSpanElement>(null);

    const handleCharacterClick = useCallback(
        (char: Character, e: React.MouseEvent) => {
            e.stopPropagation();
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            const containerRect = containerRef.current?.getBoundingClientRect();
            setTooltip({
                character: char,
                x: rect.left - (containerRect?.left ?? 0),
                y: rect.bottom - (containerRect?.top ?? 0) + 4,
            });
        },
        [],
    );

    // Build a map of name → character for quick lookup
    const charMap = new Map<string, Character>(
        characters.map(c => [c.name.toLowerCase(), c])
    );

    // Sort character names longest-first to avoid partial matching
    const charNames = characters
        .map(c => c.name)
        .sort((a, b) => b.length - a.length);

    // Tokenize text, wrapping known character names in clickable spans
    const renderTextWithCharLinks = (): React.ReactNode[] => {
        if (charNames.length === 0) return [text];

        // Build regex from all known character names (first-name matching only for novel)
        const escaped = charNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "g");

        const parts: React.ReactNode[] = [];
        let lastIdx = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(text)) !== null) {
            if (match.index > lastIdx) {
                parts.push(text.slice(lastIdx, match.index));
            }
            const matchedName = match[1];
            const char = charMap.get(matchedName.toLowerCase());
            if (char) {
                parts.push(
                    <button
                        key={`${matchedName}-${match.index}`}
                        onClick={(e) => handleCharacterClick(char, e)}
                        className="font-bold underline decoration-dotted decoration-primary/50 text-primary/80 hover:text-primary hover:decoration-solid transition-colors cursor-pointer"
                        title={`Learn about ${matchedName}`}
                    >
                        {matchedName}
                    </button>
                );
            } else {
                parts.push(matchedName);
            }
            lastIdx = match.index + match[0].length;
        }

        if (lastIdx < text.length) {
            parts.push(text.slice(lastIdx));
        }

        return parts;
    };

    const familiarity = tooltip ? (familiarityScores[tooltip.character.name] ?? 0) : 0;

    return (
        <span ref={containerRef} className={`relative ${className ?? ""}`}>
            {renderTextWithCharLinks()}

            {/* Click-anywhere-else to dismiss */}
            {tooltip && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setTooltip(null)}
                />
            )}

            <AnimatePresence>
                {tooltip && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="absolute z-50 w-64 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                        style={{
                            top: tooltip.y,
                            left: Math.min(tooltip.x, (containerRef.current?.offsetWidth ?? 400) - 264),
                        }}
                    >
                        <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                                        <Users className="w-4 h-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-black text-sm">{tooltip.character.name}</p>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${IMPORTANCE_BADGE[tooltip.character.importance]}`}>
                                            {tooltip.character.importance} character
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setTooltip(null)}
                                    className="p-1 rounded-lg hover:bg-secondary transition-colors"
                                >
                                    <X className="w-3 h-3 text-muted-foreground" />
                                </button>
                            </div>

                            {/* Familiarity */}
                            {familiarity > 0 && (
                                <div className="mb-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your familiarity</span>
                                        <span className="text-[10px] font-bold">{Math.round(familiarity * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-emerald-500 rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${familiarity * 100}%` }}
                                            transition={{ duration: 0.5 }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Relationships */}
                            {tooltip.character.relationships && tooltip.character.relationships.length > 0 && (
                                <div className="mb-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Often with</p>
                                    <div className="flex flex-wrap gap-1">
                                        {tooltip.character.relationships.slice(0, 4).map(r => (
                                            <span key={r.character} className="text-[10px] font-bold px-2 py-0.5 bg-secondary rounded-lg">
                                                {r.character}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Scenes */}
                            {tooltip.character.scene_count !== undefined && (
                                <p className="text-[10px] text-muted-foreground">
                                    Appears in {tooltip.character.scene_count} scene{tooltip.character.scene_count !== 1 ? "s" : ""}
                                    {tooltip.character.line_count ? ` · ${tooltip.character.line_count} line${tooltip.character.line_count !== 1 ? "s" : ""}` : ""}
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </span>
    );
};

export default CharacterTooltip;
